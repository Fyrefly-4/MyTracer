import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'

export async function verifyDownloadedPackage(
  path: string,
  expectedSha512: string
): Promise<boolean> {
  const hash = createHash('sha512')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('base64') === expectedSha512
}
