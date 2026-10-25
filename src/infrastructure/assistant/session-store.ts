import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import type {
  AssistantSessionStore,
  AssistantStoredState
} from '../../application/assistant/service'
import { AssistantError } from '../../application/assistant/validation'
/** Isolated from the business database and product export. Single Main-process owner. */
export class FileAssistantSessionStore implements AssistantSessionStore {
  private readonly file: string
  constructor(private readonly directory: string) {
    this.file = join(directory, 'assistant-sessions-v1.json')
  }
  load(): AssistantStoredState {
    if (!existsSync(this.file)) return { version: 1, sessions: [], operations: [] }
    try {
      if (statSync(this.file).size > 8 * 1024 * 1024) throw new Error('size')
      const value = JSON.parse(readFileSync(this.file, 'utf8')) as AssistantStoredState
      if (
        value.version !== 1 ||
        !Array.isArray(value.sessions) ||
        value.sessions.length > 100 ||
        !Array.isArray(value.operations) ||
        value.operations.length > 1000
      )
        throw new Error('shape')
      return value
    } catch {
      throw new AssistantError('persistence-failed')
    }
  }
  save(state: AssistantStoredState): void {
    const contents = JSON.stringify(state)
    if (contents.length > 8 * 1024 * 1024) throw new AssistantError('persistence-failed')
    mkdirSync(this.directory, { recursive: true, mode: 0o700 })
    const temporary = this.file + '.tmp'
    let fd: number | undefined
    try {
      fd = openSync(temporary, 'w', 0o600)
      writeFileSync(fd, contents, 'utf8')
      fsyncSync(fd)
      closeSync(fd)
      fd = undefined
      renameSync(temporary, this.file)
    } catch {
      throw new AssistantError('persistence-failed')
    } finally {
      if (fd !== undefined) closeSync(fd)
      if (existsSync(temporary)) unlinkSync(temporary)
    }
  }
}
