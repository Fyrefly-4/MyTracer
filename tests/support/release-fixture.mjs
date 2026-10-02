import { createHash } from 'node:crypto'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describeAsset, hashFile, OWNER, REPOSITORY_ID } from '../../tools/release/provenance.mjs'

export async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'mytracer-release-'))
  const setup = 'MyTracer-0.1.4-x64-setup.exe'
  const data = Buffer.from('synthetic executable fixture; never executed')
  const checksum = createHash('sha512').update(data).digest('base64')
  await writeFile(join(directory, setup), data)
  await writeFile(join(directory, `${setup}.blockmap`), 'synthetic blockmap')
  await writeFile(
    join(directory, 'latest.yml'),
    `version: 0.1.4\nfiles:\n  - url: ${setup}\n    sha512: ${checksum}\n    size: ${data.length}\npath: ${setup}\nsha512: ${checksum}\nreleaseDate: '2026-10-03T00:00:00.000Z'\n`
  )
  const assets = []
  for (const name of [setup, `${setup}.blockmap`, 'latest.yml'])
    assets.push(await describeAsset(directory, name))
  await writeFile(
    join(directory, 'SHA256SUMS.txt'),
    assets.map((a) => `${a.sha256}  ${a.name}`).join('\n') + '\n'
  )
  assets.push(await describeAsset(directory, 'SHA256SUMS.txt'))
  const sha = 'a'.repeat(40)
  const manifest = {
    schemaVersion: 1,
    repository: 'Fyrefly-4/MyTracer',
    sourceRevision: sha,
    version: '0.1.4',
    dataVersion: 3,
    exportVersion: 2,
    signing: 'unsigned',
    compatibleFrom: ['0.1.3'],
    build: {
      workflow: '.github/workflows/update-candidate.yml',
      runId: '100',
      runAttempt: '1',
      event: 'push',
      ref: 'refs/heads/main',
      artifactName: 'update-candidate-100-1'
    },
    assets,
    tests: Object.fromEntries(
      ['aggregate', 'package', 'package-smoke'].map((g) => [
        g,
        { sourceRevision: sha, exitCode: 0, captureStatus: 'complete', commandStatus: 'passed' }
      ])
    )
  }
  const manifestPath = join(directory, 'candidate-manifest.json')
  await writeFile(manifestPath, JSON.stringify(manifest))
  const digest = 'sha256:' + 'b'.repeat(64)
  const manifestSha256 = await hashFile(manifestPath)
  const context = {
    manifest,
    now: Date.parse('2026-10-03T00:00:00Z'),
    repository: { id: REPOSITORY_ID, full_name: 'Fyrefly-4/MyTracer', private: true },
    mainRevisions: [sha],
    existingVersions: [],
    dispatch: {
      actor: OWNER.login,
      actorId: OWNER.id,
      ref: 'refs/heads/main',
      workflowRevision: sha,
      sourceRevision: sha,
      version: '0.1.4',
      tag: 'v0.1.4',
      runId: 100,
      artifactId: 200,
      manifestSha256
    },
    run: {
      id: 100,
      run_attempt: 1,
      path: '.github/workflows/update-candidate.yml',
      status: 'completed',
      conclusion: 'success',
      head_sha: sha,
      head_branch: 'main',
      event: 'push',
      repository: { id: REPOSITORY_ID },
      head_repository: { id: REPOSITORY_ID }
    },
    artifact: {
      id: 200,
      name: 'update-candidate-100-1',
      expired: false,
      digest,
      created_at: '2026-10-02T00:00:00Z',
      expires_at: '2026-10-10T00:00:00Z',
      workflow_run: { id: 100, head_sha: sha, repository_id: REPOSITORY_ID }
    },
    approval: {
      status: 'accepted',
      sourceRevision: sha,
      version: '0.1.4',
      runId: 100,
      artifactId: 200,
      artifactDigest: digest,
      ownerId: OWNER.id,
      manifestSha256
    }
  }
  return {
    directory,
    manifestPath,
    manifest,
    context,
    cleanup: () => rm(directory, { recursive: true, force: true })
  }
}
