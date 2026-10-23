import { spawnSync } from 'node:child_process'
import { expect, test } from 'vitest'

function run(body: string) {
  return spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import assert from 'node:assert/strict';
    import {GithubApi} from './tools/release/github-api.mjs';
    const calls=[];
    ${body}
  `
    ],
    { encoding: 'utf8', cwd: process.cwd(), windowsHide: true }
  )
}

test('never forwards private API authentication to the signed asset host', () => {
  const result = run(
    `const api=new GithubApi('synthetic-token',false,async(url,options)=>{calls.push({url,options});return calls.length===1?new Response(null,{status:302,headers:{location:'https://release-assets.githubusercontent.com/fixed?synthetic=1'}}):new Response('synthetic bytes');});await api.request('/repos/Fyrefly-4/MyTracer/releases/assets/10',{binary:true});assert.equal(calls[0].options.headers.Authorization,'Bearer synthetic-token');assert.equal(calls[1].options.headers,undefined);assert.equal(calls[1].options.redirect,'error');`
  )
  expect(result.status, result.stderr).toBe(0)
  expect(result.error).toBeUndefined()
  expect(result.stderr).toBe('')
})

test('unexpected JSON redirects still fail with a diagnostic', () => {
  const result = run(`
    const api=new GithubApi('synthetic-token',false,async()=>{
      calls.push('get');
      return new Response(null,{status:302,headers:{location:'https://evil.invalid/?token=private'}});
    });
    await assert.rejects(()=>api.allReleases(),/github-http-302/);
    assert.equal(calls.length,1);
  `)
  expect(result.error).toBeUndefined()
  expect(result.status, result.stderr).toBe(0)
  expect(result.stderr).toContain('HTTP 302')
  expect(result.stderr).not.toMatch(/synthetic-token|evil.invalid|token=private/)
})
test.each([
  'http://release-assets.githubusercontent.com/file',
  'https://evil.invalid/file',
  'https://user:pass@release-assets.githubusercontent.com/file'
])('refuses untrusted asset redirect %s', (url) => {
  const result = run(
    `const api=new GithubApi('synthetic-token',false,async(url,options)=>{calls.push({url,options});return new Response(null,{status:302,headers:{location:${JSON.stringify(url)}}});});await assert.rejects(()=>api.request('/repos/Fyrefly-4/MyTracer/releases/assets/10',{binary:true}));assert.equal(calls.length,1);`
  )
  expect(result.status, result.stderr).toBe(0)
})
test('read-only preparation cannot mutate releases or access other repositories', () => {
  const result = run(
    `const api=new GithubApi('synthetic-token',false,async()=>{calls.push('network');throw Error();});await assert.rejects(()=>api.createDraft({}));await assert.rejects(()=>api.request('/repos/other/repo/releases'));assert.deepEqual(calls,[]);`
  )
  expect(result.status, result.stderr).toBe(0)
})
test('permission failure does not masquerade as absent release', () => {
  const result = run(
    `const api=new GithubApi('synthetic-token',false,async()=>new Response('{}',{status:403}));await assert.rejects(()=>api.assertReleaseAvailable('v0.1.4','a'.repeat(40),'a'.repeat(40)),/github-http-403/);`
  )
  expect(result.status, result.stderr).toBe(0)
})

test('retries transient GET failures with bounded exponential backoff', () => {
  const result = run(`
    const waits=[];
    const api=new GithubApi('synthetic-token',false,async()=>{
      calls.push('get');
      return calls.length<4?new Response('private response',{status:[500,502,503][calls.length-1]}):new Response('[]');
    },async ms=>waits.push(ms));
    assert.deepEqual(await api.allReleases(),[]);
    assert.deepEqual(waits,[1000,2000,4000]);
    assert.equal(calls.length,4);
  `)
  expect(result.status, result.stderr).toBe(0)
  expect(result.stderr).not.toMatch(/synthetic-token|private response/)
})

test('stops after four failed reads and emits safe request diagnostics', () => {
  const result = run(`
    const api=new GithubApi('synthetic-token',false,async()=>{
      calls.push('get');return new Response('private response',{status:504,headers:{'x-github-request-id':'ABC:123'}});
    },async()=>{});
    await assert.rejects(()=>api.allReleases(),/github-http-504/);
    assert.equal(calls.length,4);
  `)
  expect(result.status, result.stderr).toBe(0)
  expect(result.stderr).toContain('GitHub GET /repos/Fyrefly-4/MyTracer/releases: HTTP 504')
  expect(result.stderr).toContain('request ABC:123; attempt 4')
  expect(result.stderr).not.toMatch(/synthetic-token|private response|per_page/)
})

test.each(['POST', 'PATCH', 'DELETE'])('never automatically retries %s writes', (method) => {
  const result = run(`
    const api=new GithubApi('synthetic-token',true,async()=>{
      calls.push('write');return new Response('{}',{status:503});
    },async()=>assert.fail('must not retry'));
    await assert.rejects(()=>api.request('/repos/Fyrefly-4/MyTracer/releases/10',{method:'${method}'}),/github-http-503/);
    assert.equal(calls.length,1);
  `)
  expect(result.status, result.stderr).toBe(0)
})

test('readback verifies every uploaded byte including the provenance manifest', () => {
  const result = run(
    `const {createHash}=await import('node:crypto');const payload=Buffer.from('synthetic manifest');const hash=createHash('sha256').update(payload).digest('hex');const api=new GithubApi('synthetic-token',true,async(url)=>url.includes('/assets?')?new Response(JSON.stringify([{id:10,name:'candidate-manifest.json',state:'uploaded',size:payload.length}])):new Response(payload));await api.verifyAssets(1,[{name:'candidate-manifest.json',size:payload.length,sha256:hash}]);await assert.rejects(()=>api.verifyAssets(1,[{name:'candidate-manifest.json',size:payload.length+1,sha256:hash}]),/remote-integrity/);await assert.rejects(()=>api.verifyAssets(1,[{name:'candidate-manifest.json',size:payload.length,sha256:'0'.repeat(64)}]),/remote-integrity/);`
  )
  expect(result.status, result.stderr).toBe(0)
})

test.each(['lightweight', 'annotated'])(
  'accepts an existing %s tag with the exact approved commit',
  (kind) => {
    const result = run(`
    const sha='a'.repeat(40), object=${kind === 'annotated' ? "'b'.repeat(40)" : 'sha'};
    const api=new GithubApi('synthetic-token',false,async url=>{
      calls.push(url);
      if(url.includes('/releases/tags/'))return new Response('{}',{status:404});
      if(url.includes('/releases?'))return new Response('[]');
      if(url.includes('/git/ref/'))return new Response(JSON.stringify({ref:'refs/tags/v0.1.5',object:{type:'${kind === 'annotated' ? 'tag' : 'commit'}',sha:object}}));
      if(url.includes('/git/tags/'))return new Response(JSON.stringify({object:{type:'commit',sha}}));
      if(url.includes('/compare/'))return new Response(JSON.stringify({status:'ahead',merge_base_commit:{sha}}));
      throw Error('unexpected');
    });
    await api.assertReleaseAvailable('v0.1.5',sha,object);await api.assertMainSource(sha);
    assert(calls.every(url=>url.startsWith('https://api.github.com/repos/Fyrefly-4/MyTracer/')));
  `)
    expect(result.status, result.stderr).toBe(0)
  }
)

test.each([
  "{ref:'refs/tags/v0.1.5',object:{type:'commit',sha:'c'.repeat(40)}}",
  "{ref:'refs/tags/v0.1.5',object:{type:'tree',sha:'a'.repeat(40)}}",
  "{ref:'refs/tags/other',object:{type:'commit',sha:'a'.repeat(40)}}"
])('rejects changed or invalid existing tag %s', (reference) => {
  const result = run(
    `const api=new GithubApi('synthetic-token',false,async()=>new Response(JSON.stringify(${reference})));await assert.rejects(()=>api.assertTagTarget('v0.1.5','a'.repeat(40),'a'.repeat(40)));`
  )
  expect(result.status, result.stderr).toBe(0)
})

test('does not mistake a hidden draft release for an available version', () => {
  const result = run(
    `const api=new GithubApi('synthetic-token',false,async url=>url.includes('/releases/tags/')?new Response('{}',{status:404}):new Response(JSON.stringify([{tag_name:'v0.1.5',draft:true}])));await assert.rejects(()=>api.assertReleaseAvailable('v0.1.5','a'.repeat(40),'a'.repeat(40)),/existing-version/);`
  )
  expect(result.status, result.stderr).toBe(0)
})

test.each(['behind', 'diverged'])('rejects a source outside main ancestry: %s', (status) => {
  const result = run(
    `const api=new GithubApi('synthetic-token',false,async()=>new Response(JSON.stringify({status:'${status}',merge_base_commit:{sha:'a'.repeat(40)}})));await assert.rejects(()=>api.assertMainSource('a'.repeat(40)),/non-main-source/);`
  )
  expect(result.status, result.stderr).toBe(0)
})
