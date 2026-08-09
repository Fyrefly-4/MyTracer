import { join } from 'node:path'

export function resolveProductionDatabasePath(electronUserDataPath: string): string {
  return join(electronUserDataPath, 'data', 'mytracer.sqlite3')
}
