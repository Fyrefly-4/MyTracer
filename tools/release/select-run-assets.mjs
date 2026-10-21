import { cp, readdir } from 'node:fs/promises'

// A publish-only retry retains an earlier successful build job's artifact.
// Never mix attempts or fetch another run's files.
const run = process.env.GITHUB_RUN_ID
const attempt = Number(process.env.GITHUB_RUN_ATTEMPT)
const selection = JSON.parse(process.env.MYTRACER_RELEASE_SELECTION)
if (!/^[a-f0-9]{40}$/.test(selection.sourceRevision)) throw new Error('invalid-source')
if (!/^[1-9]\d*$/.test(run ?? '') || !Number.isSafeInteger(attempt) || attempt < 1) {
  throw new Error('invalid-run')
}
const prefix = `release-assets-${selection.sourceRevision}-${run}-`
const entries = await readdir('.tmp/release-download', { withFileTypes: true })
const candidates = entries
  .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
  .map((entry) => ({ name: entry.name, attempt: Number(entry.name.slice(prefix.length)) }))
  .filter(
    (entry) => Number.isSafeInteger(entry.attempt) && entry.attempt > 0 && entry.attempt <= attempt
  )
  .sort((a, b) => b.attempt - a.attempt)
if (!candidates.length) throw new Error('missing-build-artifact')
await cp(`.tmp/release-download/${candidates[0].name}`, '.tmp/release-pr', {
  recursive: true,
  errorOnExist: true,
  force: false
})
