import { spawnSync } from 'node:child_process'
import { describe, expect, test } from 'vitest'

function run(body: string) {
  return spawnSync(process.execPath, ['--input-type=module'], {
    input: `
      import assert from 'node:assert/strict';
      import {readTagApproval,selectCandidateRun,selectCandidateArtifact,validateSelection} from './tools/release/tag-approval.mjs';
      const sha='a'.repeat(40), object='b'.repeat(40);
      const event={created:true,deleted:false,forced:false,ref:'refs/tags/v0.1.5',after:object,sender:{login:'Fyrefly-4',id:183197199}};
      const env={GITHUB_EVENT_NAME:'push',GITHUB_REF:event.ref,GITHUB_SHA:sha,GITHUB_ACTOR:'Fyrefly-4',GITHUB_TRIGGERING_ACTOR:'Fyrefly-4'};
      const candidate={id:100,run_attempt:2,path:'.github/workflows/update-candidate.yml',head_sha:sha,head_branch:'main',event:'push',status:'completed',conclusion:'success',repository:{id:1326905280},head_repository:{id:1326905280}};
      const selected={sourceRevision:sha,tagObjectRevision:object,version:'0.1.5',runId:100,runAttempt:2,artifactId:200,artifactDigest:'sha256:'+'c'.repeat(64),manifestSha256:'d'.repeat(64)};
      ${body}
    `,
    encoding: 'utf8',
    windowsHide: true
  })
}

describe('owner tag approval and exact candidate discovery', () => {
  test('binds the authenticated push owner, commit and annotated tag object separately', () => {
    const result = run(
      "const approval=readTagApproval(event,env);assert.equal(approval.version,'0.1.5');assert.equal(approval.workflowRevision,sha);assert.equal(approval.eventRevision,object);validateSelection(selected);"
    )
    expect(result.status, result.stderr).toBe(0)
  })
  test.each([
    "event.sender.login='other';",
    'event.sender.id=1;',
    "env.GITHUB_TRIGGERING_ACTOR='other';",
    "env.GITHUB_ACTOR='other';",
    "env.GITHUB_EVENT_NAME='workflow_dispatch';",
    'event.created=false;',
    'event.deleted=true;',
    'event.forced=true;',
    "env.GITHUB_REF='refs/heads/main';",
    "event.after='invalid';",
    "env.GITHUB_SHA='invalid';",
    "event.ref=env.GITHUB_REF='refs/tags/v01.1.5';",
    "event.ref=env.GITHUB_REF='refs/tags/v0.1.5-beta.1';",
    "event.ref=env.GITHUB_REF='refs/tags/v0.1.5\\nmalicious';"
  ])('rejects invalid tag approval: %s', (mutation) => {
    const result = run(`${mutation}assert.throws(()=>readTagApproval(event,env));`)
    expect(result.status, result.stderr).toBe(0)
  })
  test('chooses the newest successful run for the exact main source, independent of API ordering', () => {
    const result = run(`
      const newer={...candidate,id:101}, pr={...candidate,id:200,event:'pull_request'}, other={...candidate,id:300,head_sha:object}, failed={...candidate,id:400,conclusion:'failure'};
      assert.equal(selectCandidateRun([pr,newer,other,candidate,failed],sha).id,101);
      const artifact={id:200,name:'update-candidate-100-2'};
      assert.equal(selectCandidateArtifact([{id:201,name:'update-candidate-100-1'},artifact],candidate),artifact);
      assert.throws(()=>selectCandidateArtifact([artifact,artifact],candidate));
      assert.throws(()=>selectCandidateArtifact([],candidate));
    `)
    expect(result.status, result.stderr).toBe(0)
  })
  test('accepts only a manual rebuild on the exact approved stable tag', () => {
    const result = run(`
      const rebuilt={...candidate,event:'workflow_dispatch',head_branch:'v0.1.5'};
      assert.equal(selectCandidateRun([rebuilt],sha,'v0.1.5'),rebuilt);
      assert.throws(()=>selectCandidateRun([rebuilt],sha,'v0.1.6'));
      assert.throws(()=>selectCandidateRun([{...rebuilt,event:'push'}],sha,'v0.1.5'));
    `)
    expect(result.status, result.stderr).toBe(0)
  })
  test.each([
    "candidate.path='.github/workflows/other.yml';",
    "candidate.head_branch='dev';",
    'candidate.head_sha=object;',
    "candidate.event='pull_request';",
    "candidate.status='in_progress';",
    "candidate.conclusion='failure';",
    'candidate.repository.id=1;',
    'candidate.head_repository.id=1;',
    'candidate.run_attempt=0;',
    'candidate.id=Number.MAX_SAFE_INTEGER+1;'
  ])('cannot discover an ineligible run: %s', (mutation) => {
    const result = run(`${mutation}assert.throws(()=>selectCandidateRun([candidate],sha));`)
    expect(result.status, result.stderr).toBe(0)
  })
  test.each([
    'selected.runAttempt=0;',
    'selected.runId="100";',
    'selected.artifactId=-1;',
    "selected.manifestSha256='invalid';",
    "selected.artifactDigest='invalid';",
    "selected.sourceRevision='invalid';",
    "selected.version='0.1.5-beta.1';",
    'selected.extra=true;'
  ])('rejects malformed job-boundary metadata: %s', (mutation) => {
    const result = run(`${mutation}assert.throws(()=>validateSelection(selected));`)
    expect(result.status, result.stderr).toBe(0)
  })
})
