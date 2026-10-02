import { spawnSync } from 'node:child_process'
import { describe, expect, test } from 'vitest'

// Exercise the shipped Node module without a second implementation or TS module shim.
function run(expression: string) {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import {validateManifest, validatePublication, isHigherVersion} from './tools/release/provenance.mjs';
    const sha='a'.repeat(40), digest='b'.repeat(64), now=Date.parse('2026-10-03T00:00:00Z');
    const manifest={schemaVersion:1,repository:'Fyrefly-4/MyTracer',sourceRevision:sha,version:'0.1.4',
      dataVersion:3,exportVersion:2,signing:'unsigned',compatibleFrom:['0.1.3'],
      build:{workflow:'.github/workflows/update-candidate.yml',runId:'100',runAttempt:'1',event:'push',ref:'refs/heads/main',artifactName:'update-candidate-100-1'},
      assets:['MyTracer-0.1.4-x64-setup.exe','MyTracer-0.1.4-x64-setup.exe.blockmap','latest.yml','SHA256SUMS.txt'].map(name=>({name,size:10,sha256:digest,sha512:'A'.repeat(86)+'=='})),
      tests:Object.fromEntries(['aggregate','package','package-smoke'].map(g=>[g,{sourceRevision:sha,exitCode:0,captureStatus:'complete',commandStatus:'passed'}]))};
    const context={manifest,now,repository:{id:1326905280,full_name:'Fyrefly-4/MyTracer',private:true},
      mainRevisions:[sha],existingVersions:[],dispatch:{actor:'Fyrefly-4',actorId:183197199,ref:'refs/heads/main',workflowRevision:sha,sourceRevision:sha,version:'0.1.4',tag:'v0.1.4',runId:100,artifactId:200,manifestSha256:digest},
      run:{id:100,run_attempt:1,path:'.github/workflows/update-candidate.yml',status:'completed',conclusion:'success',head_sha:sha,head_branch:'main',event:'push',repository:{id:1326905280},head_repository:{id:1326905280}},
      artifact:{id:200,name:'update-candidate-100-1',expired:false,digest:'sha256:'+digest,created_at:'2026-10-02T00:00:00Z',expires_at:'2026-10-10T00:00:00Z',workflow_run:{id:100,head_sha:sha,repository_id:1326905280}},
      approval:{status:'accepted',sourceRevision:sha,version:'0.1.4',runId:100,artifactId:200,artifactDigest:'sha256:'+digest,ownerId:183197199,manifestSha256:digest}};
    ${expression}
  `
    ],
    { cwd: process.cwd(), encoding: 'utf8', windowsHide: true }
  )
  return result
}

describe('release acceptance binds exact trusted artifacts before publication', () => {
  test('accepts exact owner/main/run/artifact/approval and stable source compatibility', () => {
    expect(run('validatePublication(context);').status).toBe(0)
  })
  test.each([
    "context.dispatch.actor='someone';",
    'context.dispatch.actorId=1;',
    "context.dispatch.ref='refs/heads/dev';",
    "context.dispatch.workflowRevision='abc';",
    'context.repository.private=false;',
    'context.repository.id=1;',
    "context.repository.full_name='other/repo';",
    'context.mainRevisions=[];',
    "context.dispatch.sourceRevision='abc';",
    "context.dispatch.version='0.1.5';",
    "context.dispatch.tag='latest';",
    "context.existingVersions=['v0.1.4'];",
    "context.run.conclusion='failure';",
    "context.run.status='in_progress';",
    "context.run.path='.github/workflows/other.yml';",
    'context.run.head_repository.id=1;',
    "context.run.event='pull_request';",
    "context.run.head_branch='dev';",
    'context.run.run_attempt=2;',
    'context.artifact.id=201;',
    "context.artifact.name='latest';",
    'context.artifact.workflow_run.id=101;',
    'context.artifact.expired=true;',
    "context.artifact.created_at='2026-09-01T00:00:00Z';",
    "context.artifact.expires_at='2026-10-01T00:00:00Z';",
    "context.artifact.created_at='invalid';",
    'context.approval=null;',
    "context.approval.status='pending';",
    'context.approval.artifactId=201;',
    "context.approval.manifestSha256='c'.repeat(64);",
    "context.approval.artifactDigest='sha256:'+'c'.repeat(64);",
    "manifest.version='0.1.4-beta.1';",
    "manifest.compatibleFrom=['0.1.4'];",
    "manifest.assets[0].name='../setup.exe';",
    'manifest.assets.push(manifest.assets[0]);',
    'manifest.dataVersion=4;',
    "manifest.tests.aggregate.commandStatus='failed';",
    "manifest.tests.aggregate.sourceRevision='c'.repeat(40);"
  ])('rejects %s', (mutation) => {
    expect(run(`${mutation} validatePublication(context);`).status).not.toBe(0)
  })
  test('compares stable numeric versions without coercion or integer overflow', () => {
    expect(
      run(
        `if(!isHigherVersion('0.1.10','0.1.9') || isHigherVersion('0.1.4-beta.1','0.1.3') || isHigherVersion('0.1.3','0.1.3') || isHigherVersion('0.1.2','0.1.3')) throw Error();`
      ).status
    ).toBe(0)
  })
})
