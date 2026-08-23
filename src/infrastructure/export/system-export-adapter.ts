import { open, readFile, rename, stat, unlink, type FileHandle } from 'node:fs/promises'
import type { Stats } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import {
  ExportDeliveryError,
  type CompleteExportDocumentPort,
  type ExportPort
} from '../../application/ports/export'
import {
  CompleteExportApplicationError,
  validateCompleteExport
} from '../../application/complete-export'

export interface SystemSaveDialog {
  showSaveDialog(options: {
    readonly title: string
    readonly defaultPath: string
    readonly filters: { name: string; extensions: string[] }[]
  }): Promise<{ readonly canceled: boolean; readonly filePath?: string }>
}

interface ExportFileHandle {
  writeFile(data: Uint8Array): Promise<void>
  sync(): Promise<void>
  close(): Promise<void>
}

export interface ExportFileOperations {
  openExclusive(path: string): Promise<ExportFileHandle>
  readFile(path: string): Promise<Uint8Array>
  stat(path: string): Promise<Stats>
  rename(from: string, to: string): Promise<void>
  unlink(path: string): Promise<void>
}

interface FileFingerprint {
  readonly size: number
  readonly mtimeMs: number
  readonly ctimeMs: number
  readonly ino: number
  readonly dev: number
}

function systemFileOperations(): ExportFileOperations {
  return {
    openExclusive: async (path) => open(path, 'wx') as unknown as FileHandle,
    readFile,
    stat,
    rename,
    unlink
  }
}

function fingerprint(stats: Stats): FileFingerprint {
  return Object.freeze({
    size: stats.size,
    mtimeMs: stats.mtimeMs,
    ctimeMs: stats.ctimeMs,
    ino: stats.ino,
    dev: stats.dev
  })
}

function equalFingerprint(left: FileFingerprint | null, right: FileFingerprint | null): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function isMissing(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && (error as { code?: unknown }).code === 'ENOENT'
  )
}

function replaceUnsupported(error: unknown): boolean {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined
  return code === 'EEXIST' || code === 'EPERM' || code === 'ENOTSUP'
}

export interface SystemExportAdapterDependencies {
  readonly dialog: SystemSaveDialog
  readonly generateToken: () => string
  readonly files?: ExportFileOperations
}

export class SystemExportAdapter implements ExportPort {
  private readonly files: ExportFileOperations

  public constructor(private readonly dependencies: SystemExportAdapterDependencies) {
    this.files = dependencies.files ?? systemFileOperations()
  }

  public async deliverCompleteExport(
    document: CompleteExportDocumentPort,
    suggestedName: string
  ): Promise<
    | { readonly kind: 'cancelled' }
    | { readonly kind: 'exported'; readonly fileName: string; readonly byteLength: number }
  > {
    try {
      validateCompleteExport(document)
    } catch {
      throw new ExportDeliveryError('export-validation-failed', 'The export document is invalid.')
    }
    const selection = await this.dependencies.dialog.showSaveDialog({
      title: '导出 MyTracer 完整数据',
      defaultPath: suggestedName,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (selection.canceled) return Object.freeze({ kind: 'cancelled' as const })
    if (!selection.filePath)
      throw new ExportDeliveryError('write-failed', 'No export destination was selected.')

    const destination = selection.filePath
    const originalDestination = await this.readFingerprint(destination)
    const temporary = join(
      dirname(destination),
      `.${basename(destination)}.${this.dependencies.generateToken()}.tmp`
    )
    const bytes = Buffer.from(JSON.stringify(document, null, 2), 'utf8')
    let temporaryOwned = false
    let handle: ExportFileHandle | null = null
    try {
      handle = await this.files.openExclusive(temporary)
      temporaryOwned = true
      await handle.writeFile(bytes)
      await handle.sync()
      await handle.close()
      handle = null
      const reparsed = JSON.parse(
        Buffer.from(await this.files.readFile(temporary)).toString('utf8')
      )
      try {
        validateCompleteExport(reparsed)
      } catch {
        throw new ExportDeliveryError(
          'export-validation-failed',
          'The temporary export failed validation.'
        )
      }
      const currentDestination = await this.readFingerprint(destination)
      if (!equalFingerprint(originalDestination, currentDestination)) {
        throw new ExportDeliveryError(
          'destination-changed',
          'The export destination changed before delivery.'
        )
      }
      try {
        await this.files.rename(temporary, destination)
      } catch (error) {
        if (replaceUnsupported(error) && originalDestination !== null) {
          throw new ExportDeliveryError(
            'replace-not-supported',
            'This destination cannot be safely replaced on this system.'
          )
        }
        throw error
      }
      temporaryOwned = false
      return Object.freeze({
        kind: 'exported' as const,
        fileName: basename(destination),
        byteLength: bytes.byteLength
      })
    } catch (error) {
      if (handle) {
        try {
          await handle.close()
        } catch {
          // Cleanup below remains restricted to this adapter-owned temporary sibling.
        }
      }
      if (temporaryOwned) await this.cleanup(temporary)
      if (error instanceof ExportDeliveryError) throw error
      if (error instanceof CompleteExportApplicationError) {
        throw new ExportDeliveryError(
          'export-validation-failed',
          'The temporary export failed validation.'
        )
      }
      if (error instanceof SyntaxError) {
        throw new ExportDeliveryError(
          'export-validation-failed',
          'The temporary export did not parse.'
        )
      }
      throw new ExportDeliveryError(
        'write-failed',
        'The export file could not be safely delivered.'
      )
    }
  }

  private async readFingerprint(path: string): Promise<FileFingerprint | null> {
    try {
      return fingerprint(await this.files.stat(path))
    } catch (error) {
      if (isMissing(error)) return null
      throw new ExportDeliveryError('write-failed', 'Could not inspect the export destination.')
    }
  }

  private async cleanup(path: string): Promise<void> {
    try {
      await this.files.unlink(path)
    } catch (error) {
      if (!isMissing(error)) {
        // The caller gets the original export failure without exposing filesystem details.
      }
    }
  }
}
