import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'

const ROOT_PREFIX = 'mytracer-tests-'
const ownedRoots = new Set<string>()

export interface TemporaryTestRoot {
  readonly root: string
  readonly electronUserData: string
  readonly database: string
  readonly exports: string
  readonly artifacts: string
}

function isStrictDescendant(parent: string, candidate: string): boolean {
  const pathFromParent = relative(parent, candidate)
  return (
    pathFromParent.length > 0 &&
    pathFromParent !== '..' &&
    !pathFromParent.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) &&
    !isAbsolute(pathFromParent)
  )
}

export async function createTemporaryTestRoot(): Promise<TemporaryTestRoot> {
  const temporaryDirectory = await realpath(tmpdir())
  const root = await realpath(await mkdtemp(join(temporaryDirectory, ROOT_PREFIX)))

  if (dirname(root) !== temporaryDirectory || !basename(root).startsWith(ROOT_PREFIX)) {
    throw new Error('Refusing to use a temporary test root outside the OS temporary directory.')
  }

  const electronUserData = join(root, 'electron-user-data')
  const database = join(root, 'database')
  const exportsDirectory = join(root, 'exports')
  const artifacts = join(root, 'artifacts')

  try {
    await Promise.all(
      [electronUserData, database, exportsDirectory, artifacts].map((path) =>
        mkdir(path, { recursive: false })
      )
    )
  } catch (error) {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    throw error
  }

  ownedRoots.add(root)

  return Object.freeze({
    root,
    electronUserData,
    database,
    exports: exportsDirectory,
    artifacts
  })
}

export async function assertExistingPathWithinRoot(
  root: TemporaryTestRoot,
  candidate: string
): Promise<string> {
  const canonicalRoot = await realpath(root.root)
  const canonicalCandidate = await realpath(candidate)

  if (!ownedRoots.has(canonicalRoot) || !isStrictDescendant(canonicalRoot, canonicalCandidate)) {
    throw new Error(`Path is outside the current temporary test root: ${resolve(candidate)}`)
  }

  return canonicalCandidate
}

export async function removeTemporaryTestRoot(root: TemporaryTestRoot): Promise<void> {
  const temporaryDirectory = await realpath(tmpdir())
  const canonicalRoot = await realpath(root.root)

  if (
    dirname(canonicalRoot) !== temporaryDirectory ||
    !basename(canonicalRoot).startsWith(ROOT_PREFIX) ||
    !isStrictDescendant(temporaryDirectory, canonicalRoot) ||
    !ownedRoots.has(canonicalRoot)
  ) {
    throw new Error(`Refusing to remove an unowned test path: ${canonicalRoot}`)
  }

  await rm(canonicalRoot, { recursive: true, force: false, maxRetries: 5, retryDelay: 100 })
  ownedRoots.delete(canonicalRoot)
}
