import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'

const repositoryRoot = process.cwd()
const classifier = join(repositoryRoot, 'tools', 'ci', 'classify-changes.mjs')
const temporaryDirectories: string[] = []

function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'mytracer-ci-'))
  temporaryDirectories.push(directory)
  return directory
}

function run(command: string, options: string[] = []) {
  const environment = { ...process.env }
  for (const name of [
    'GITHUB_EVENT_NAME',
    'GITHUB_EVENT_PATH',
    'GITHUB_SHA',
    'GITHUB_OUTPUT',
    'BASE_REVISION',
    'HEAD_REVISION'
  ]) {
    delete environment[name]
  }
  return spawnSync(process.execPath, [classifier, command, ...options], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    windowsHide: true,
    env: environment
  })
}

function classify(paths: string[], options: string[] = []) {
  const file = join(temporaryDirectory(), 'paths.txt')
  writeFileSync(file, paths.join('\n'), 'utf8')
  const result = run('classify', ['--paths-file', file, '--event-name', 'pull_request', ...options])
  expect(result.status, result.stderr).toBe(0)
  return JSON.parse(result.stdout.trim())
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('CI check selection', () => {
  test.each([
    'README.md',
    'AGENTS.md',
    'docs/MAINTENANCE.md',
    'docs/maintenance/RELEASE.md',
    'docs/implementation/TASK_TEMPLATE.md',
    '.github/pull_request_template.md',
    '.agents/skills/example/SKILL.md',
    '.agents/skills/example/agents/openai.yaml'
  ])('keeps documentation and skill metadata lightweight: %s', (file) => {
    expect(classify([file])).toMatchObject({ category: 'documentation', run_verification: false })
  })

  test.each(
    [
      ['src/main/index.ts'],
      ['tests/unit/example.test.ts'],
      ['tools/ci/check.mjs'],
      ['.github/workflows/verify.yml'],
      ['package-lock.json'],
      ['electron-builder.yml'],
      ['.agents/skills/example/scripts/run.py'],
      ['docs/implementation/profiles/standard-task@1.json'],
      ['src/renderer/help.md'],
      ['tools/example/agents/openai.yaml'],
      ['docs/MAINTENANCE.md', 'src/main/index.ts'],
      ['assets/unknown.bin'],
      []
    ].map((files) => ({ files }))
  )('fully verifies executable, mixed, unknown, and empty changes: $files', ({ files }) => {
    expect(classify(files)).toMatchObject({ category: 'source', run_verification: true })
  })

  test('does not escalate documentation for Ready, main, or PR body instructions', () => {
    const event = join(temporaryDirectory(), 'event.json')
    writeFileSync(
      event,
      JSON.stringify({
        pull_request: { draft: false, base: { ref: 'main' }, body: 'CI mode: milestone' }
      })
    )
    expect(classify(['README.md'], ['--event-file', event])).toMatchObject({
      category: 'documentation',
      run_verification: false
    })
  })

  test('manual verification always runs the complete suite', () => {
    expect(classify(['README.md'], ['--event-name', 'workflow_dispatch'])).toMatchObject({
      category: 'source',
      run_verification: true
    })
  })

  test('uses the actual PR test merge revision and reports comparison failures', () => {
    const directory = temporaryDirectory()
    const event = join(directory, 'event.json')
    const output = join(directory, 'outputs.txt')
    const revision = 'a'.repeat(40)
    writeFileSync(event, JSON.stringify({ pull_request: { head: { sha: 'b'.repeat(40) } } }))
    const paths = join(directory, 'paths.txt')
    writeFileSync(paths, 'README.md')
    const result = spawnSync(process.execPath, [classifier, 'classify', '--paths-file', paths], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      windowsHide: true,
      env: {
        ...process.env,
        GITHUB_EVENT_NAME: 'pull_request',
        GITHUB_EVENT_PATH: event,
        GITHUB_SHA: revision,
        GITHUB_OUTPUT: output
      }
    })
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout).head_revision).toBe(revision)
    expect(readFileSync(output, 'utf8')).toContain(`head_revision=${revision}`)
    expect(run('classify', ['--base', 'missing-revision', '--head', 'HEAD']).status).toBe(1)
  })
})

describe('dependency-free documentation checks', () => {
  function fixture(content: string) {
    const root = temporaryDirectory()
    mkdirSync(join(root, 'docs'))
    writeFileSync(join(root, 'docs', 'guide.md'), content)
    writeFileSync(join(root, 'docs', 'target.md'), '# Target\n')
    const paths = join(root, 'paths.txt')
    writeFileSync(paths, 'docs/guide.md\n')
    return { root, paths }
  }

  test('accepts valid local links and ignores remote links and code examples', () => {
    const { root, paths } = fixture(
      '# Guide\n\n[Target](target.md)\n[Remote](https://example.com/)\n\n```md\n[Example](missing.md)\n```\n'
    )
    expect(run('docs', ['--repository-root', root, '--paths-file', paths]).status).toBe(0)
  })

  test('accepts a PR template fragment without imposing body sections', () => {
    const root = temporaryDirectory()
    mkdirSync(join(root, '.github'))
    writeFileSync(join(root, '.github', 'pull_request_template.md'), '## A short description\n')
    const paths = join(root, 'paths.txt')
    writeFileSync(paths, '.github/pull_request_template.md\n')
    expect(run('docs', ['--repository-root', root, '--paths-file', paths]).status).toBe(0)
  })

  test('accepts an absent comparison base on manual execution without empty shell arguments', () => {
    const result = spawnSync(process.execPath, [classifier, 'docs'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, BASE_REVISION: '', HEAD_REVISION: 'HEAD' }
    })
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toMatch(/Validated \d+ changed documentation file/)
  })

  test.each([
    ['# Guide\n\n[Missing](missing.md)\n', 'broken local link'],
    ['# Guide\n\n### Skipped heading\n', 'heading levels must not skip'],
    ['# Guide\n\n[Outside](../../outside.md)\n', 'link leaves the repository'],
    ['# Guide\n\n<<<<<<< HEAD\n', 'unresolved conflict marker']
  ])('rejects invalid documentation: %s', (content, error) => {
    const { root, paths } = fixture(content)
    const result = run('docs', ['--repository-root', root, '--paths-file', paths])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(error)
  })
})

describe('workflow safety boundaries', () => {
  test('keeps one stable required job, PR updates and manual execution, without publication', () => {
    const source = readFileSync(join(repositoryRoot, '.github/workflows/verify.yml'), 'utf8')
    expect(
      source
        .split(/\r?\njobs:\r?\n/)[1]
        .match(/^ {2}\w+:\r?$/gm)
        ?.map((line) => line.trim())
    ).toEqual(['ci:'])
    expect(source).toContain('name: CI Gate')
    expect(source.match(/^\s+branches: \[([^\]]+)\]/m)?.[1]).toBe('main')
    expect(source).toContain('types: [opened, synchronize, reopened]')
    expect(source).toContain('workflow_dispatch:')
    expect(source).not.toMatch(/^ {2}push:|^\s+paths(?:-ignore)?:/m)
    expect(source).not.toContain('pull_request_target')
    expect(source).not.toContain('validate-pr-context')
    expect(source).not.toContain('governance:metadata:check')
    expect(source).not.toContain('Windows required gate')
    expect(source).not.toMatch(/contents: write|run: .*package/)
    expect(source).toContain('run: npm.cmd run verify')
    expect(source).toContain("if: steps.changes.outputs.run_verification == 'true'")
  })

  test('isolates the release App token from selection, builds and publication', () => {
    const source = readFileSync(
      join(repositoryRoot, '.github/workflows/release.yml'),
      'utf8'
    ).replaceAll('\r\n', '\n')
    const [releaseJob, downstream] = source.split('\n  build:')
    expect(releaseJob).toContain('contents: write\n      pull-requests: read')
    expect(releaseJob).toContain('run: node tools/release/check-app-config.mjs')
    expect(releaseJob).toContain(
      'actions/create-github-app-token@64ab729a6294000f5aa4a4bc0b73d1f32bc45510'
    )
    expect(releaseJob).toContain('client-id: ${{ vars.MYTRACER_RELEASE_APP_CLIENT_ID }}')
    expect(releaseJob).toContain('private-key: ${{ secrets.MYTRACER_RELEASE_APP_PRIVATE_KEY }}')
    expect(releaseJob).toContain('owner: ${{ github.repository_owner }}')
    expect(releaseJob).toContain('repositories: MyTracer')
    expect(releaseJob).toContain('permission-contents: write')
    expect(releaseJob).toContain('permission-pull-requests: write')
    expect(releaseJob).toContain('skip-token-revoke: false')
    expect(source.match(/steps\.release-app\.outputs\.token/g)).toHaveLength(1)
    expect(releaseJob).toContain('token: ${{ steps.release-app.outputs.token }}')
    expect(releaseJob).toContain('GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}')
    expect(downstream).not.toMatch(/release-app|RELEASE_APP|create-github-app-token/)
    expect(downstream).toContain('GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}')
    expect(source).not.toMatch(/permission-(actions|administration|workflows|issues):/)
    expect(source).not.toContain('|| secrets.GITHUB_TOKEN')
  })

  test.each([
    ['', '', 1],
    ['fake-client-id', '', 1],
    ['', 'fake-private-key', 1],
    [' ', 'fake-private-key', 1],
    ['fake-client-id', 'fake-private-key', 0]
  ])('checks App setup without revealing credentials: case %#', (clientId, privateKey, status) => {
    const result = spawnSync(process.execPath, ['tools/release/check-app-config.mjs'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      windowsHide: true,
      env: {
        ...process.env,
        RELEASE_APP_CLIENT_ID: String(clientId),
        RELEASE_APP_PRIVATE_KEY: String(privateKey)
      }
    })
    expect(result.status).toBe(status)
    expect(result.stdout).toBe('')
    expect(result.stderr).not.toMatch(/fake-client-id|fake-private-key/)
    if (status === 1) expect(result.stderr).toContain('release-app-not-configured')
  })

  test('uses a release PR as the only publication decision', () => {
    const release = readFileSync(join(repositoryRoot, '.github/workflows/release.yml'), 'utf8')
    expect(release).toContain('branches: [main]')
    expect(release).not.toContain('workflow_dispatch:')
    expect(release).not.toContain('pull_request_target')
    expect(release).not.toContain('tags:')
    expect(release).toContain('googleapis/release-please-action@')
    expect(release).toContain('release-pr.mjs select')
    expect(release).toContain('release-pr.mjs bundle')
    expect(release).toContain('release-pr.mjs publish')
    expect(release).toContain('sourceRevision')
    expect(release).toContain('--publish never')
    expect(release).toContain('cancel-in-progress: false')
    expect(release).not.toContain('create-candidate.mjs')
    expect(release).not.toContain('publish.mjs prepare')
    const config = JSON.parse(
      readFileSync(join(repositoryRoot, 'release-please-config.json'), 'utf8')
    )
    expect(config).toMatchObject({
      'release-type': 'node',
      'include-component-in-tag': false,
      'bump-minor-pre-major': true,
      'bump-patch-for-minor-pre-major': false,
      draft: true,
      'force-tag-creation': true,
      packages: { '.': {} }
    })
  })
})
