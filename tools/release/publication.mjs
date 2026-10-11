import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { hashFile, requireCondition, validateBundle, validatePublication } from './provenance.mjs'

// The transport is injectable for offline tests; only the CLI supplies a real GitHub transport.
// Nothing from a candidate bundle is executable, and no write occurs before all checks pass.
export async function publishCandidate({ context, directory, api }) {
  const manifestPath = join(directory, 'candidate-manifest.json')
  const manifest = await validateBundle(manifestPath)
  const manifestHash = await hashFile(manifestPath)
  requireCondition(manifestHash === context.dispatch.manifestSha256, 'manifest-integrity')
  validatePublication({ ...context, manifest })
  await api.assertMainSource(manifest.sourceRevision)
  await api.assertReleaseAvailable(
    context.dispatch.tag,
    manifest.sourceRevision,
    context.dispatch.tagObjectRevision
  )
  validatePublication({
    ...context,
    manifest,
    existingVersions: (await api.allReleases()).map((release) => release.tag_name)
  })
  // Verify immediately before creating the first externally visible side effect.
  await validateBundle(manifestPath)
  const draft = await api.createDraft({
    tag_name: context.dispatch.tag,
    name: `MyTracer ${manifest.version}`,
    body: `Windows x64 NSIS; unsigned. Source: ${manifest.sourceRevision}.\nData version: 3. Export version: 2.\nApproved by owner tag: ${context.dispatch.tag}.\nCandidate run/attempt: ${context.dispatch.runId}/${context.dispatch.runAttempt}. Artifact: ${context.dispatch.artifactId}.\nArchive digest: ${context.dispatch.artifactDigest}.\nManifest SHA-256: ${manifestHash}.`,
    draft: true,
    prerelease: false
  })
  requireCondition(
    Number.isSafeInteger(draft.id) && draft.id > 0 && draft.draft === true,
    'release-draft'
  )
  const files = [
    ...manifest.assets,
    {
      name: 'candidate-manifest.json',
      sha256: manifestHash,
      size: (await readFile(manifestPath)).length
    }
  ]
  for (const asset of files) {
    requireCondition(
      (await hashFile(join(directory, asset.name))) === asset.sha256,
      'pre-upload-integrity'
    )
    const bytes = await readFile(join(directory, asset.name))
    const uploaded = await api.uploadAsset(draft.id, asset.name, bytes)
    requireCondition(
      uploaded.name === asset.name &&
        uploaded.size === bytes.length &&
        uploaded.state === 'uploaded',
      'upload-result'
    )
  }
  // Re-read every uploaded byte before allowing the stable client to consume the release.
  await api.verifyAssets(draft.id, files)
  await api.assertTagTarget(
    context.dispatch.tag,
    manifest.sourceRevision,
    context.dispatch.tagObjectRevision
  )
  await api.assertMainSource(manifest.sourceRevision)
  validatePublication({
    ...context,
    manifest,
    existingVersions: (await api.allReleases())
      .filter((release) => release.id !== draft.id)
      .map((release) => release.tag_name)
  })
  const visible = await api.makeVisible(draft.id)
  requireCondition(
    visible.id === draft.id &&
      visible.draft === false &&
      visible.prerelease === false &&
      visible.tag_name === context.dispatch.tag,
    'release-visibility'
  )
  return { releaseId: draft.id, version: manifest.version, sourceRevision: manifest.sourceRevision }
}
