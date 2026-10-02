import { pathToFileURL } from 'node:url'
import { validateBundle } from './provenance.mjs'

export async function main(argv) {
  if (argv.length !== 2 || argv[0] !== '--manifest') throw new Error('validate-arguments')
  const manifest = await validateBundle(argv[1])
  process.stdout.write(`Validated ${manifest.version} ${manifest.sourceRevision}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(() => {
    process.stderr.write('Release bundle validation failed.\n')
    process.exitCode = 1
  })
}
