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
  await api.assertVersionAbsent(context.dispatch.tag)
  // Verify immediately before creating the first externally visible side effect.
  await validateBundle(manifestPath)
  const draft = await api.createDraft({
    tag_name: context.dispatch.tag,
    target_commitish: manifest.sourceRevision,
    name: `MyTracer ${manifest.version}`,
    body: `Windows x64 NSIS; unsigned. Source: ${manifest.sourceRevision}.\nData version: 3. Export version: 2.`,
    draft: true,
    prerelease: false
  })
  requireCondition(
    Number.isSafeInteger(draft.id) && draft.id > 0 && draft.draft === true,
    'release-draft'
  )
  const files = [...manifest.assets, { name: 'candidate-manifest.json', sha256: manifestHash }]
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
