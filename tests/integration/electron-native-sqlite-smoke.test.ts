import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createTemporaryTestRoot,
  removeTemporaryTestRoot,
  type TemporaryTestRoot
} from '../support/temporary-test-root'

const createdRoots: TemporaryTestRoot[] = []

function minimalEnvironment(root: TemporaryTestRoot): Record<string, string> {
  const environment: Record<string, string> = {
    HOME: root.root,
    USERPROFILE: root.root,
    APPDATA: root.artifacts,
    LOCALAPPDATA: root.artifacts,
    TEMP: root.artifacts,
    TMP: root.artifacts,
    ELECTRON_RUN_AS_NODE: '1'
  }

  for (const name of ['PATH', 'SystemRoot', 'WINDIR', 'ComSpec', 'PATHEXT']) {
    const value = process.env[name]
    if (value) {
      environment[name] = value
    }
  }
  return environment
}

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => removeTemporaryTestRoot(root)))
})

describe('Electron native SQLite smoke', () => {
  it('loads better-sqlite3 from the Electron 43 executable against an isolated database', async () => {
    const root = await createTemporaryTestRoot()
    createdRoots.push(root)
    const databasePath = join(root.database, 'electron-native-smoke.sqlite3')
    const scriptPath = join(root.artifacts, 'electron-native-smoke.cjs')
    await writeFile(
      scriptPath,
      [
        'const Database = require(process.argv[3])',
        'const database = new Database(process.argv[2])',
        "database.pragma('foreign_keys = ON')",
        "database.prepare('CREATE TABLE smoke (value TEXT NOT NULL)').run()",
        "database.prepare('INSERT INTO smoke (value) VALUES (?)').run('bound value')",
        "const value = database.prepare('SELECT value FROM smoke').get().value",
        'database.close()',
        'process.stdout.write(JSON.stringify({ value, electron: process.versions.electron, napi: process.versions.napi }))'
      ].join('\n')
    )

    const result = spawnSync(
      join(process.cwd(), 'node_modules', 'electron', 'dist', 'electron.exe'),
      [scriptPath, databasePath, join(process.cwd(), 'node_modules', 'better-sqlite3')],
      { cwd: process.cwd(), encoding: 'utf8', env: minimalEnvironment(root), timeout: 30_000 }
    )

    expect(result.error).toBeUndefined()
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      value: 'bound value',
      electron: '43.3.0',
      napi: '10'
    })
  })
})
