import { spawnSync } from 'node:child_process'
import { describe, expect, test } from 'vitest'

function scenario(body: string) {
  return spawnSync(process.execPath, ['--input-type=module'], {
    input: `
    import assert from 'node:assert/strict';
    import {writeFile, readFile, symlink} from 'node:fs/promises';
    import {spawnSync} from 'node:child_process';
    import {join} from 'node:path';
    import {createHash} from 'node:crypto';
    import {fixture} from './tests/support/release-fixture.mjs';
    import {publishCandidate} from './tools/release/publication.mjs';
    import {validateBundle} from './tools/release/provenance.mjs';
    const f=await fixture(), calls=[], stored=new Map();
    const api={
      assertMainSource:async()=>{},
      allReleases:async()=>[],
      assertTagTarget:async()=>{},
      assertReleaseAvailable:async()=>calls.push('available'),
      createDraft:async input=>{assert.equal(input.draft,true);calls.push('draft');return {id:1,draft:true};},
      uploadAsset:async(id,name,bytes)=>{calls.push('upload');stored.set(name,bytes);return {name,size:bytes.length,state:'uploaded'};},
      verifyAssets:async(id,files)=>{calls.push('verify');for(const file of files){assert.equal(stored.get(file.name).length,file.size);assert.equal(createHash('sha256').update(stored.get(file.name)).digest('hex'),file.sha256);}},
      makeVisible:async()=>{calls.push('visible');return {id:1,draft:false,prerelease:false,tag_name:'v0.1.4'};}
    };
    try { ${body} } finally {await f.cleanup();}
  `,
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true
  })
}

describe('publication transactions stay hidden until all assets are verified', () => {
  test('validates a real bundle and publishes after all five assets are round-trip checked', () => {
    const result = scenario(
      `await validateBundle(f.manifestPath);await publishCandidate({...f,api});assert.deepEqual(calls,['available','draft',...Array(5).fill('upload'),'verify','visible']);`
    )
    expect(result.status, result.error?.message ?? result.stderr).toBe(0)
  })
  test('read-only validation CLI accepts the exact bundle and rejects changed bytes', () => {
    const result = scenario(
      `const args=['tools/release/validate.mjs','--manifest',f.manifestPath];assert.equal(spawnSync(process.execPath,args,{encoding:'utf8'}).status,0);await writeFile(join(f.directory,'MyTracer-0.1.4-x64-setup.exe'),'tampered');const rejected=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(rejected.status,1);assert.equal(rejected.stderr,'Release bundle validation failed.\\n');assert.deepEqual(calls,[]);`
    )
    expect(result.status, result.error?.message ?? result.stderr).toBe(0)
  })
  test.each([
    "await writeFile(join(f.directory,'MyTracer-0.1.4-x64-setup.exe'),'tampered');",
    "await writeFile(join(f.directory,'latest.yml'),'version: 0.1.5');",
    "await writeFile(join(f.directory,'unexpected.txt'),'unapproved');",
    "await writeFile(join(f.directory,'SHA256SUMS.txt'),'forged');",
    "f.context.dispatch.actor='other';",
    "f.context.dispatch.ref='refs/heads/main';",
    "f.context.dispatch.manifestSha256='c'.repeat(64);"
  ])('performs no write on invalid bundle/context: %s', (mutation) => {
    const result = scenario(
      `${mutation}await assert.rejects(()=>publishCandidate({...f,api}));assert.deepEqual(calls,[]);`
    )
    expect(result.status, result.error?.message ?? result.stderr).toBe(0)
  })
  test('rejects a checksum-correct bundle with malicious metadata', () => {
    const result = scenario(String.raw`
      await writeFile(join(f.directory,'latest.yml'),'version: 0.1.4\nfiles:\n  - url: https://evil.invalid/setup.exe');
      const bytes=await readFile(join(f.directory,'latest.yml'));
      const a=f.manifest.assets.find(a=>a.name==='latest.yml');a.size=bytes.length;a.sha256=createHash('sha256').update(bytes).digest('hex');a.sha512=createHash('sha512').update(bytes).digest('base64');
      await writeFile(f.manifestPath,JSON.stringify(f.manifest));
      await assert.rejects(()=>validateBundle(f.manifestPath),/updater-metadata/);
    `)
    expect(result.status, result.stderr).toBe(0)
  })
  test('rechecks version before creating draft and preserves failure without visible release', () => {
    const result = scenario(
      `api.assertReleaseAvailable=async()=>{throw Error('already-exists')};await assert.rejects(()=>publishCandidate({...f,api}));assert.deepEqual(calls,[]);`
    )
    expect(result.status, result.stderr).toBe(0)
  })
  test.each(['uploadAsset', 'verifyAssets', 'assertTagTarget', 'makeVisible'])(
    'preserves %s failure and stops subsequent operations',
    (stage) => {
      const result = scenario(
        `api.${stage}=async()=>{calls.push('failure');throw Error('synthetic failure')};await assert.rejects(()=>publishCandidate({...f,api}));assert.equal(calls.at(-1),'failure');assert(!calls.includes('visible'));`
      )
      expect(result.status, result.stderr).toBe(0)
    }
  )
})
