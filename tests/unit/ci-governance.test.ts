import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, test } from 'vitest'

const repositoryRoot = process.cwd()
const classifier = join(repositoryRoot, 'tools', 'ci', 'classify-changes.mjs')
const temporaryDirectories: string[] = []

function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'mytracer-ci-'))
  temporaryDirectories.push(directory)
  return directory
}

function cleanEnvironment() {
  const environment = { ...process.env }
  for (const name of [
    'GITHUB_EVENT_NAME',
    'GITHUB_EVENT_PATH',
    'GITHUB_SHA',
    'GITHUB_OUTPUT',
    'BASE_REVISION',
    'HEAD_REVISION',
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE'
  ]) {
    delete environment[name]
  }
  return environment
}

function run(command: string, options: string[] = []) {
  return spawnSync(process.execPath, [classifier, command, ...options], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    windowsHide: true,
    env: cleanEnvironment()
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

  test.each([
    'release-please-config.json',
    '.release-please-manifest.json',
    'tools/release/check-app-config.mjs',
    'tools/release/extract-artifact.ps1',
    'tools/release/github-api.mjs',
    'tools/release/provenance.mjs',
    'tools/release/publication.mjs',
    'tools/release/publish.mjs',
    'tools/release/release-pr.mjs',
    'tools/release/select-run-assets.mjs',
    'tools/release/tag-approval.mjs',
    'tools/release/validate-candidate-source.mjs',
    'tools/release/validate.mjs',
    'tests/unit/release-provenance.test.ts',
    'tests/unit/release-tag-approval.test.ts',
    'tests/integration/release-artifact-extraction.test.ts',
    'tests/integration/release-github-transport.test.ts',
    'tests/integration/release-pr-flow.test.ts',
    'tests/integration/release-publication.test.ts',
    'tests/integration/release-tag-flow.test.ts',
    'tests/support/release-fixture.mjs',
    'tests/support/release-pr-scenarios.mjs'
  ])('selects release regressions for allowlisted paths, including mixed docs: %s', (file) => {
    expect(classify([file])).toMatchObject({ category: 'release-tooling', run_verification: false })
    expect(classify(['README.md', file])).toMatchObject({ category: 'release-tooling' })
  })

  test.each(
    [
      ['tools/release/create-candidate.mjs'],
      ['tools/release/run-installed-test.mjs'],
      ['tools/release/new-script.mjs'],
      ['tools/ci/classify-changes.mjs'],
      ['tests/unit/ci-governance.test.ts'],
      ['tests/unit/update-release-metadata.test.ts'],
      ['package.json'],
      ['vitest.config.ts'],
      ['playwright.config.ts'],
      ['eslint.config.js'],
      ['tsconfig.test.json'],
      ['.github/workflows/release.yml'],
      ['tools/release/README.md'],
      ['tools/release/release-pr.mjs', 'src/main/index.ts'],
      ['release-please-config.json', 'package-lock.json'],
      [' tools/release/release-pr.mjs'],
      ['TOOLS/release/release-pr.mjs'],
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

  test.each(['README.md', 'release-please-config.json'])(
    'manual verification always runs the complete suite: %s',
    (file) => {
      expect(classify([file], ['--event-name', 'workflow_dispatch'])).toMatchObject({
        category: 'source',
        run_verification: true
      })
    }
  )

  test('does not downgrade executable Markdown renames', () => {
    const root = temporaryDirectory()
    const git = (...args: string[]) => {
      const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true })
      expect(result.status, result.stderr).toBe(0)
      return result.stdout.trim()
    }
    git('init', '--quiet')
    mkdirSync(join(root, 'src'))
    writeFileSync(join(root, 'src', 'help.md'), '# Help\n')
    git('add', '.')
    const base = git('write-tree')
    git('mv', 'src/help.md', 'README.md')
    const head = git('write-tree')
    const result = spawnSync(
      process.execPath,
      [classifier, 'classify', '--base', base, '--head', head, '--event-name', 'pull_request'],
      { cwd: root, encoding: 'utf8', windowsHide: true }
    )
    expect(result.status, result.stderr).toBe(0)
    const classification = JSON.parse(result.stdout)
    expect(classification).toMatchObject({ category: 'source', run_verification: true })
    expect(classification.changed_paths).toEqual(['README.md', 'src/help.md'])
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

  test.each(['full', 'shallow'])(
    'checks an absent comparison base in an isolated %s history',
    (history) => {
      const root = temporaryDirectory()
      const source = join(root, 'source')
      mkdirSync(source)
      const environment = {
        ...cleanEnvironment(),
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: join(root, 'gitconfig')
      }
      writeFileSync(environment.GIT_CONFIG_GLOBAL, '')
      const git = (...args: string[]) => {
        const result = spawnSync('git', args, {
          cwd: source,
          encoding: 'utf8',
          windowsHide: true,
          env: environment
        })
        expect(result.status, result.stderr).toBe(0)
      }
      git('init', '--quiet')
      // An old broken link must not be scanned as a change in complete history.
      writeFileSync(join(source, 'old.md'), '# Old\n\n[Missing](missing.md)\n')
      git('add', '.')
      const commit = ['-c', 'user.name=CI', '-c', 'user.email=ci@example.invalid', 'commit', '-qm']
      git(...commit, 'old documentation')
      writeFileSync(join(source, 'guide.md'), '# Guide\n')
      git('add', '.')
      git(...commit, 'current documentation')
      const checkout = history === 'shallow' ? join(root, 'shallow') : source
      if (history === 'shallow') {
        git('clone', '--quiet', '--depth', '1', pathToFileURL(source).href, checkout)
      }
      const result = spawnSync(process.execPath, [classifier, 'docs'], {
        cwd: checkout,
        encoding: 'utf8',
        windowsHide: true,
        env: { ...environment, BASE_REVISION: '', HEAD_REVISION: 'HEAD' }
      })
      if (history === 'full') {
        expect(result.status, result.stderr).toBe(0)
        expect(result.stdout).toContain('Validated 1 changed documentation file(s).')
      } else {
        // Git sees a shallow boundary as a root: keep the link checker strict.
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('old.md: broken local link: missing.md')
      }
    },
    15_000
  )

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
  test.each(['installer', 'electron-focus'])(
    'covers Assistant integration PRs in %s without changing the publication branch',
    (name) => {
      const workflow = readFileSync(join(repositoryRoot, `.github/workflows/${name}.yml`), 'utf8')
      expect(workflow.match(/^\s+branches: \[([^\]]+)\]/m)?.[1]).toBe('main, assistant/exploration')
      expect(workflow).toContain('contents: read')
      expect(workflow).not.toContain('pull_request_target')
      const release = readFileSync(join(repositoryRoot, '.github/workflows/release.yml'), 'utf8')
      expect(release).not.toContain('assistant/exploration')
      expect(release).toContain('target-branch: main')
    }
  )

  test('keeps one stable required job, PR updates and manual execution, without publication', () => {
    const source = readFileSync(join(repositoryRoot, '.github/workflows/verify.yml'), 'utf8')
    expect(
      source
        .split(/\r?\njobs:\r?\n/)[1]
        .match(/^ {2}\w+:\r?$/gm)
        ?.map((line) => line.trim())
    ).toEqual(['ci:'])
    expect(source).toContain('name: CI Gate')
    expect(source).toContain('runs-on: windows-2025')
    expect(source).toContain("@('documentation', 'release-tooling', 'source')")
    expect(source).toContain("throw 'Missing or invalid CI classification'")
    expect(source).toContain("if: steps.changes.outputs.category == 'release-tooling'")
    expect(source).toContain('run: npm.cmd ci --ignore-scripts')
    expect(source).toContain('run: npm.cmd run verify:release-tooling')
    expect(source.match(/^\s+branches: \[([^\]]+)\]/m)?.[1]).toBe(
      'main, experiment/ui-ux-20261022, assistant/exploration'
    )
    expect(source).toContain('types: [opened, synchronize, reopened]')
    expect(source).toContain('workflow_dispatch:')
    expect(source).not.toMatch(/^ {2}push:|^\s+paths(?:-ignore)?:/m)
    expect(source).not.toContain('pull_request_target')
    expect(source).not.toContain('validate-pr-context')
    expect(source).not.toContain('governance:metadata:check')
    expect(source).not.toContain('Windows required gate')
    expect(source).not.toMatch(/contents: write|run: .*package/)
    for (const phase of [
      'install',
      'electron',
      'format',
      'lint',
      'types',
      'unit',
      'integration',
      'build',
      'diagnostics',
      'scroll',
      'e2e'
    ]) {
      expect(source).toContain(`run: node tools/ci/run-phase.mjs ${phase}`)
    }
    expect(source).not.toContain('continue-on-error:')
    expect(source).toContain("if: steps.changes.outputs.category == 'source'")
  })

  test('the tooling command retains governance and every allowlisted release regression', () => {
    const { scripts } = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8'))
    const command = scripts['verify:release-tooling'] as string
    expect(command).toContain('npm run format:check && npm run lint && npm run typecheck')
    expect(command).toContain('tests/unit/ci-governance.test.ts')
    expect(command).toContain('vitest run --project unit')
    expect(command).toContain('vitest run --project integration')
    const source = readFileSync(classifier, 'utf8')
    const testPaths = [...source.matchAll(/'(tests\/(?:unit|integration)\/release-[^']+)'/g)]
    expect(testPaths.length).toBeGreaterThan(0)
    for (const [, path] of testPaths) expect(command).toContain(path)
    expect(command).not.toMatch(/test:e2e|npm run build|package|publish|test:installed/)
  })

  test('uses job-local App tokens for draft access without passing them to builds', () => {
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
    expect(source.match(/steps\.release-app\.outputs\.token/g)).toHaveLength(3)
    expect(releaseJob).toContain('token: ${{ steps.release-app.outputs.token }}')
    expect(releaseJob).toContain('GH_TOKEN: ${{ steps.release-app.outputs.token }}')
    expect(downstream.split('\n  publish:')[0]).not.toMatch(
      /release-app|RELEASE_APP|create-github-app-token/
    )
    expect(downstream).toContain('GH_TOKEN: ${{ steps.release-app.outputs.token }}')
    expect(downstream).toContain('Create repository-scoped release App token')
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
    const release = readFileSync(
      join(repositoryRoot, '.github/workflows/release.yml'),
      'utf8'
    ).replaceAll('\r\n', '\n')
    expect(release).toContain('branches: [main]')
    expect(release).toContain('workflow_dispatch:')
    expect(release).toContain("github.ref == 'refs/heads/main'")
    expect(release).toContain("if: github.event_name == 'push'")
    for (const input of ['release_id', 'tag', 'source_sha'])
      expect(release).toContain(`inputs.${input}`)
    expect(release).toContain('path: .tmp/release-tooling')
    expect(release).toContain('node .tmp/release-tooling/tools/release/release-pr.mjs publish')
    expect(release).not.toContain('pull_request_target')
    expect(release).not.toContain('tags:')
    expect(release).toContain('googleapis/release-please-action@')
    expect(release).toContain('release-pr.mjs select')
    expect(release).toContain('release-pr.mjs bundle')
    expect(release).toContain('release-pr.mjs publish')
    expect(release).toContain('sourceRevision')
    expect(release).toContain('--publish never')
    const build = release.split('\n  build:')[1].split('\n  publish:')[0]
    expect(build).toContain(
      'ref: ${{ fromJSON(needs.release-pr.outputs.selection).sourceRevision }}\n' +
        '          fetch-depth: 0\n          persist-credentials: false'
    )
    expect(release).toContain('npm.cmd run verify')
    expect(release).toContain('npm.cmd run test:package-smoke')
    expect(release).not.toContain('verify:release-tooling')
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
      'always-update': true,
      draft: true,
      'force-tag-creation': true,
      packages: { '.': {} }
    })
  })
})
