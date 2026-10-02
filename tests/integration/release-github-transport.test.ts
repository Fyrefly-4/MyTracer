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
    `const api=new GithubApi('synthetic-token',false,async()=>new Response('{}',{status:403}));await assert.rejects(()=>api.assertVersionAbsent('v0.1.4'),/github-http-403/);`
  )
  expect(result.status, result.stderr).toBe(0)
})

test('readback verifies every uploaded byte including the provenance manifest', () => {
  const result = run(
    `const {createHash}=await import('node:crypto');const payload=Buffer.from('synthetic manifest');const hash=createHash('sha256').update(payload).digest('hex');const api=new GithubApi('synthetic-token',true,async(url)=>url.includes('/assets?')?new Response(JSON.stringify([{id:10,name:'candidate-manifest.json',state:'uploaded',size:payload.length}])):new Response(payload));await api.verifyAssets(1,[{name:'candidate-manifest.json',size:payload.length,sha256:hash}]);await assert.rejects(()=>api.verifyAssets(1,[{name:'candidate-manifest.json',size:payload.length+1,sha256:hash}]),/remote-integrity/);await assert.rejects(()=>api.verifyAssets(1,[{name:'candidate-manifest.json',size:payload.length,sha256:'0'.repeat(64)}]),/remote-integrity/);`
  )
  expect(result.status, result.stderr).toBe(0)
})
