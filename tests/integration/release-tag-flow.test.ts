import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { beforeAll, describe, expect, test } from 'vitest'

const { fixture } = await import(
  pathToFileURL(join(process.cwd(), 'tests/support/release-fixture.mjs')).href
)
let archiveBase64: string

function recordPhases(phases: Record<string, unknown>) {
  const record = JSON.stringify({ suite: 'release-tag-flow', ...phases })
  console.log(`Release fixture phases: ${record}`)
  const output = join(process.env.RUNNER_TEMP ?? '.tmp', 'mytracer-ci-phases')
  mkdirSync(output, { recursive: true })
  appendFileSync(join(output, 'release-tag-flow.ndjson'), record + '\n')
}

// Only immutable ZIP bytes are shared. Every scenario still creates its own context,
// staging directories and API call log, and invokes the real extraction script.
beforeAll(async () => {
  const start = performance.now()
  const f = await fixture()
  const root = await mkdtemp(join(tmpdir(), 'mytracer-publish-archive-'))
  try {
    const zipScript = join(root, 'zip.ps1'),
      zip = join(root, 'candidate.zip')
    await writeFile(
      zipScript,
      'param($Source,$Archive)\nCompress-Archive -Path (Join-Path $Source "*") -DestinationPath $Archive'
    )
    const compressionStart = performance.now()
    try {
      execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-File',
          zipScript,
          '-Source',
          f.directory,
          '-Archive',
          zip
        ],
        { windowsHide: true, timeout: 60000 }
      )
      archiveBase64 = (await readFile(zip)).toString('base64')
    } finally {
      recordPhases({
        phase: 'shared-archive-compression',
        durationMs: Math.round(performance.now() - compressionStart)
      })
    }
  } finally {
    try {
      await f.cleanup()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
    recordPhases({
      phase: 'shared-archive-setup-and-cleanup',
      durationMs: Math.round(performance.now() - start)
    })
  }
})

function scenario(body: string) {
  const start = performance.now()
  const result = spawnSync(process.execPath, ['--input-type=module'], {
    input: `
      import assert from 'node:assert/strict';
      import {createHash} from 'node:crypto';
      import {copyFile,mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
      import {tmpdir} from 'node:os';
      import {join} from 'node:path';
      import {fixture} from './tests/support/release-fixture.mjs';
      import {runPublication} from './tools/release/publish.mjs';
      import {validateCandidateSource} from './tools/release/validate-candidate-source.mjs';
      const phases=[], started=performance.now();
      const phase=async(name,run)=>{const start=performance.now();let outcome='rejected';try{const result=await run();outcome='returned';return result;}finally{phases.push({phase:name,outcome,durationMs:Math.round(performance.now()-start)});}};
      const cwd=process.cwd(), f=await fixture(), root=await mkdtemp(join(tmpdir(),'mytracer-publish-flow-'));
      const sha=f.manifest.sourceRevision, calls=[], stored=new Map();
      try {
        await mkdir(join(root,'tools/release'),{recursive:true});
        await copyFile('tools/release/extract-artifact.ps1',join(root,'tools/release/extract-artifact.ps1'));
        await writeFile(join(root,'package.json'),JSON.stringify({version:'0.1.4'}));
        await writeFile(join(root,'package-lock.json'),JSON.stringify({version:'0.1.4',packages:{'':{version:'0.1.4'}}}));
        const archive=Buffer.from(${JSON.stringify(archiveBase64)},'base64');
        f.context.artifact.digest='sha256:'+createHash('sha256').update(archive).digest('hex');
        f.context.artifact.created_at=new Date(Date.now()-60000).toISOString();
        f.context.artifact.expires_at=new Date(Date.now()+86400000).toISOString();
        const eventPath=join(root,'event.json'),output=join(root,'outputs');
        await writeFile(eventPath,JSON.stringify({created:true,deleted:false,forced:false,ref:'refs/tags/v0.1.4',after:sha,sender:{login:'Fyrefly-4',id:183197199}}));
        const env={GITHUB_EVENT_PATH:eventPath,GITHUB_OUTPUT:output,GITHUB_STEP_SUMMARY:join(root,'summary'),GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/tags/v0.1.4',GITHUB_SHA:sha,GITHUB_ACTOR:'Fyrefly-4',GITHUB_TRIGGERING_ACTOR:'Fyrefly-4'};
        const api={
          get:async path=>{calls.push('get:'+path);if(path==='')return f.context.repository;if(path==='/actions/runs/100')return f.context.run;if(path==='/actions/artifacts/200')return f.context.artifact;throw Error('unexpected-read');},
          assertMainSource:async()=>calls.push('main'),
          resolveTag:async()=>({sourceRevision:sha,tagObjectRevision:sha}),
          assertTagTarget:async()=>calls.push('tag'),
          assertReleaseAvailable:async()=>calls.push('available'),
          allReleases:async()=>[],
          candidateRuns:async()=>{calls.push('discover');return [f.context.run];},
          runArtifacts:async()=>[f.context.artifact],
          request:async()=>archive,
          createDraft:async input=>{calls.push('draft');assert.equal(input.target_commitish,undefined);assert.equal(input.tag_name,'v0.1.4');return {id:1,draft:true};},
          uploadAsset:async(id,name,bytes)=>{calls.push('upload');stored.set(name,bytes);return {name,size:bytes.length,state:'uploaded'};},
          verifyAssets:async(id,files)=>{calls.push('verify');for(const file of files)assert.equal(createHash('sha256').update(stored.get(file.name)).digest('hex'),file.sha256);},
          makeVisible:async()=>{calls.push('visible');return {id:1,draft:false,prerelease:false,tag_name:'v0.1.4'};}
        };
        process.chdir(root);
        phases.push({phase:'isolated-scenario-setup',durationMs:Math.round(performance.now()-started)});
        const prepare=()=>phase('prepare-extract-validate',()=>runPublication('prepare',env,api,()=>sha));
        const publish=()=>phase('publish-extract-validate',()=>runPublication('publish',env,api,()=>sha));
        ${body}
      } finally {
        try {await phase('isolated-scenario-cleanup',async()=>{process.chdir(cwd);try{await f.cleanup();}finally{await rm(root,{recursive:true,force:true});}});}
        finally {process.stdout.write('RELEASE_PHASES '+JSON.stringify(phases)+'\\n');}
      }
    `,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000
  })
  const phaseLine = result.stdout?.split(/\r?\n/).find((line) => line.startsWith('RELEASE_PHASES '))
  recordPhases({
    scenario: expect.getState().currentTestName,
    subprocessExitCode: result.status,
    subprocessDurationMs: Math.round(performance.now() - start),
    signal: result.signal,
    phases: phaseLine ? JSON.parse(phaseLine.slice('RELEASE_PHASES '.length)) : [],
    phaseReportMissing: !phaseLine
  })
  return result
}

describe('tag publication resolves and pins a real safely extracted bundle', () => {
  test.each([true, false])(
    'prepare/publish preserves exact selection with repository.private=%s',
    (visibility) => {
      const result = scenario(`
      f.context.repository.private=${visibility};const selection=await prepare();assert(!calls.includes('draft'));assert.equal(selection.artifactId,200);
      assert.equal(await readFile(output,'utf8'),'selection='+JSON.stringify(selection)+'\\n');
      env.MYTRACER_RELEASE_SELECTION=JSON.stringify(selection);calls.length=0;
      await publish();assert(!calls.includes('discover'));assert.equal(calls.filter(c=>c==='upload').length,5);
      assert(calls.includes('verify'));assert(calls.includes('visible'));assert(calls.indexOf('verify')<calls.indexOf('visible'));assert.equal(calls.at(-1),'visible');
    `)
      expect(result.status, result.error?.message ?? result.stderr).toBe(0)
    }
  )
  test('pins an annotated tag even when the event reports its peeled commit', () => {
    const result = scenario(
      `api.resolveTag=async()=>({sourceRevision:sha,tagObjectRevision:'b'.repeat(40)});const selection=await prepare();assert.equal(selection.tagObjectRevision,'b'.repeat(40));env.MYTRACER_RELEASE_SELECTION=JSON.stringify(selection);await publish();assert(calls.includes('visible'));`
    )
    expect(result.status, result.error?.message ?? result.stderr).toBe(0)
  })
  test('allows owner tag rebuild only after verifying its main ancestry', () => {
    const result = scenario(`
      const event=JSON.parse(await readFile(eventPath,'utf8'));env.GITHUB_EVENT_NAME='workflow_dispatch';
      await validateCandidateSource({event,environment:env,api,sourceRevision:sha,version:'0.1.4'});assert(calls.includes('main'));assert(!calls.includes('draft'));
      api.assertMainSource=async()=>{throw Error('non-main-source')};
      await assert.rejects(()=>validateCandidateSource({event,environment:env,api,sourceRevision:sha,version:'0.1.4'}));
      env.GITHUB_ACTOR='other';
      await assert.rejects(()=>validateCandidateSource({event,environment:env,api,sourceRevision:sha,version:'0.1.4'}));
    `)
    expect(result.status, result.error?.message ?? result.stderr).toBe(0)
  })
  test.each([
    'selection.runAttempt=2;',
    "selection.manifestSha256='c'.repeat(64);",
    "selection.artifactDigest='sha256:'+'c'.repeat(64);",
    "selection.sourceRevision='c'.repeat(40);",
    "selection.tagObjectRevision='c'.repeat(40);",
    'f.context.run.run_attempt=2;',
    'f.context.artifact.expired=true;',
    "f.context.run.conclusion='failure';"
  ])('a changed selection or remote candidate cannot cause a write: %s', (mutation) => {
    const result = scenario(
      `const selection=await prepare();${mutation}env.MYTRACER_RELEASE_SELECTION=JSON.stringify(selection);calls.length=0;await assert.rejects(publish);assert(!calls.includes('draft'));assert(!calls.includes('discover'));`
    )
    expect(result.status, result.error?.message ?? result.stderr).toBe(0)
  })
  test.each([
    "await writeFile('package.json',JSON.stringify({version:'0.1.5'}));",
    "await writeFile('package-lock.json',JSON.stringify({version:'0.1.4',packages:{'':{version:'0.1.5'}}}));",
    "api.resolveTag=async()=>({sourceRevision:'c'.repeat(40),tagObjectRevision:sha});",
    'f.context.artifact.expires_at=new Date(Date.now()-1000).toISOString();',
    "api.allReleases=async()=>[{tag_name:'v0.1.5'}];",
    "f.context.repository.private='false';",
    'api.candidateRuns=async()=>[];',
    "f.context.artifact.digest='sha256:'+'c'.repeat(64);",
    'api.runArtifacts=async()=>[f.context.artifact,f.context.artifact];',
    "api.assertMainSource=async()=>{throw Error('non-main-source')};",
    "api.assertReleaseAvailable=async()=>{throw Error('tag-changed')};"
  ])('preparation failure emits no selection and performs no write: %s', (mutation) => {
    const result = scenario(
      `${mutation}await assert.rejects(prepare);await assert.rejects(()=>readFile(output));assert(!calls.includes('draft'));`
    )
    expect(result.status, result.error?.message ?? result.stderr).toBe(0)
  })
})
