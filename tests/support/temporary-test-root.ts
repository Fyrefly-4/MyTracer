import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'

const ROOT_PREFIX = 'mytracer-tests-'
const ownedRoots = new WeakMap<TemporaryTestRoot, string>()

export interface TemporaryTestRoot {
  readonly root: string
  readonly electronUserData: string
  readonly database: string
  readonly exports: string
  readonly artifacts: string
  readonly roamingAppData: string
  readonly localAppData: string
  readonly temporary: string
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
  const appData = join(root, 'AppData')
  const roamingAppData = join(appData, 'Roaming')
  const localAppData = join(appData, 'Local')
  const temporary = join(localAppData, 'Temp')

  try {
    await Promise.all(
      [electronUserData, database, exportsDirectory, artifacts].map((path) =>
        mkdir(path, { recursive: false })
      )
    )
    await mkdir(appData, { recursive: false })
    await mkdir(roamingAppData, { recursive: false })
    await mkdir(localAppData, { recursive: false })
    await mkdir(temporary, { recursive: false })
  } catch (error) {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    throw error
  }

  const testRoot = Object.freeze({
    root,
    electronUserData,
    database,
    exports: exportsDirectory,
    artifacts,
    roamingAppData,
    localAppData,
    temporary
  })
  ownedRoots.set(testRoot, root)
  return testRoot
}

export async function assertExistingPathWithinRoot(
  root: TemporaryTestRoot,
  candidate: string
): Promise<string> {
  const canonicalRoot = await realpath(root.root)
  const canonicalCandidate = await realpath(candidate)

  if (
    ownedRoots.get(root) !== canonicalRoot ||
    !isStrictDescendant(canonicalRoot, canonicalCandidate)
  ) {
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
    ownedRoots.get(root) !== canonicalRoot
  ) {
    throw new Error(`Refusing to remove an unowned test path: ${canonicalRoot}`)
  }

  await rm(canonicalRoot, { recursive: true, force: false, maxRetries: 5, retryDelay: 100 })
  ownedRoots.delete(root)
}
