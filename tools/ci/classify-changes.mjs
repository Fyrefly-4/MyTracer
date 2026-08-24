import { appendFileSync, existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const LEVEL_RANK = {
  documentation: 0,
  governance: 1,
  full: 2,
  milestone: 3
}

const SOURCE_EXACT = new Set([
  '.editorconfig',
  '.eslintignore',
  '.eslintrc',
  '.eslintrc.cjs',
  '.eslintrc.js',
  '.eslintrc.json',
  '.npmrc',
  '.prettierignore',
  '.prettierrc',
  '.prettierrc.cjs',
  '.prettierrc.js',
  '.prettierrc.json',
  'electron-builder.yml',
  'electron.vite.config.ts',
  'package-lock.json',
  'package.json',
  'playwright.config.ts',
  'tsconfig.json',
  'tsconfig.node.json',
  'tsconfig.test.json',
  'vite.config.ts',
  'vitest.config.ts'
])

const GOVERNANCE_EXACT = new Set([
  'AGENTS.md',
  'README.md',
  '.github/pull_request_template.md',
  'docs/DECISIONS.md',
  'docs/PRODUCT_REQUIREMENTS_V0.1.md',
  'docs/REQUIREMENTS_CHANGE_POLICY.md'
])

const DOCUMENTATION_EXACT = new Set(['CHANGELOG.md'])
const DOCUMENTATION_PREFIXES = ['docs/guides/', 'docs/reference/', 'docs/release-notes/', 'user/']

function parseArguments(argv) {
  const [command = 'classify', ...rest] = argv
  const options = {}

  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index]
    if (!argument.startsWith('--')) {
      throw new Error(`Unexpected argument: ${argument}`)
    }

    const key = argument.slice(2)
    const next = rest[index + 1]
    if (next !== undefined && !next.startsWith('--')) {
      options[key] = next
      index += 1
    } else {
      options[key] = 'true'
    }
  }

  return { command, options }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function readBoolean(value, fallback = false) {
  if (value === undefined || value === '') {
    return fallback
  }

  return String(value).toLowerCase() === 'true'
}

function stripComments(value) {
  return value.replace(/<!--[\s\S]*?-->/g, '')
}

function requestedMode(body) {
  const content = stripComments(body ?? '')
  const inline = content.match(/^\s*CI mode\s*:\s*(full|milestone)\s*$/im)
  if (inline) {
    return inline[1].toLowerCase()
  }

  const lines = content.split(/\r?\n/)
  const headingIndex = lines.findIndex((line) => /^#{1,6}\s+CI mode\s*$/i.test(line))
  if (headingIndex < 0) {
    return undefined
  }
  const sectionLines = []
  for (const line of lines.slice(headingIndex + 1)) {
    if (/^#{1,6}\s+/.test(line)) {
      break
    }
    sectionLines.push(line)
  }
  return sectionLines
    .join('\n')
    .match(/\b(full|milestone)\b/i)?.[1]
    ?.toLowerCase()
}

function normalizePath(filePath) {
  return filePath.replaceAll('\\', '/').replace(/^\.\//, '')
}

export function classifyPath(filePath) {
  const normalized = normalizePath(filePath)
  const lower = normalized.toLowerCase()

  if (
    lower.startsWith('src/') ||
    lower.startsWith('tests/') ||
    lower.startsWith('tools/') ||
    lower.startsWith('.github/workflows/') ||
    SOURCE_EXACT.has(normalized) ||
    /^tsconfig(?:\.[^.]+)?\.json$/i.test(normalized) ||
    /^(?:vite|vitest|playwright|electron-vite|eslint|prettier)\.config\.[cm]?[jt]s$/i.test(
      normalized
    )
  ) {
    return 'source'
  }

  if (
    GOVERNANCE_EXACT.has(normalized) ||
    lower.startsWith('.agents/') ||
    lower.startsWith('docs/architecture/') ||
    lower.startsWith('docs/implementation/')
  ) {
    return 'governance'
  }

  if (
    /\.(?:md|mdx)$/i.test(normalized) &&
    (DOCUMENTATION_EXACT.has(normalized) ||
      DOCUMENTATION_PREFIXES.some((prefix) => lower.startsWith(prefix)))
  ) {
    return 'documentation'
  }

  return 'source'
}

export function classifyPaths(paths) {
  if (paths.length === 0) {
    return 'source'
  }

  const categories = new Set(paths.map(classifyPath))
  if (categories.has('source')) {
    return 'source'
  }
  if (categories.has('governance')) {
    return 'governance'
  }
  return 'documentation'
}

function raiseLevel(current, requested) {
  return LEVEL_RANK[requested] > LEVEL_RANK[current] ? requested : current
}

function readEvent(options) {
  const eventPath = options['event-file'] ?? process.env.GITHUB_EVENT_PATH
  if (eventPath && existsSync(eventPath)) {
    return readJson(eventPath)
  }
  return {}
}

function readChangedPaths(options, baseRevision, headRevision) {
  if (options['paths-file']) {
    return readFileSync(options['paths-file'], 'utf8')
      .split(/\0|\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map(normalizePath)
  }

  if (!headRevision) {
    return []
  }

  const zeroRevision = /^0+$/.test(baseRevision ?? '')
  const args =
    baseRevision && !zeroRevision
      ? ['diff', '--name-only', '-z', baseRevision, headRevision]
      : ['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', '-z', headRevision]
  const result = spawnSync('git', args, { encoding: 'utf8', shell: false })
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`)
  }

  return result.stdout
    .split('\0')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(normalizePath)
}

export function buildClassification({
  paths,
  eventName,
  targetBranch,
  draft,
  body,
  explicitMode,
  baseRevision,
  headRevision
}) {
  const pathCategory = classifyPaths(paths)
  let level = pathCategory === 'source' ? 'full' : pathCategory
  const isPullRequest = eventName === 'pull_request'

  if (targetBranch === 'main') {
    level = 'milestone'
  }
  if (isPullRequest && !draft) {
    level = raiseLevel(level, 'full')
  }

  const bodyMode = requestedMode(body)
  if (bodyMode) {
    level = raiseLevel(level, bodyMode)
  }
  if (explicitMode === 'full' || explicitMode === 'milestone') {
    level = raiseLevel(level, explicitMode)
  }

  return {
    category: level === 'milestone' ? 'milestone' : pathCategory,
    path_category: pathCategory,
    level,
    run_pr_quality: isPullRequest,
    run_documentation: pathCategory === 'documentation',
    run_governance: ['governance', 'full', 'milestone'].includes(level),
    run_verification: ['full', 'milestone'].includes(level),
    run_milestone: level === 'milestone',
    base_revision: baseRevision,
    head_revision: headRevision,
    changed_paths: paths
  }
}

function escapeWorkflowMessage(value) {
  return String(value).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')
}

function appendGitHubOutputs(classification) {
  const outputPath = process.env.GITHUB_OUTPUT
  if (!outputPath) {
    return
  }

  const lines = Object.entries(classification).map(([key, value]) => {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    return `${key}=${serialized}`
  })
  appendFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8')
}

function runClassify(options) {
  const event = readEvent(options)
  const eventName = options['event-name'] ?? process.env.GITHUB_EVENT_NAME ?? 'workflow_dispatch'
  const pullRequest = event.pull_request
  const targetBranch =
    options['target-branch'] ??
    pullRequest?.base?.ref ??
    event.ref?.replace(/^refs\/heads\//, '') ??
    process.env.GITHUB_REF_NAME ??
    ''
  const draft = readBoolean(options.draft, pullRequest?.draft ?? false)
  const body = options['body-file']
    ? readFileSync(options['body-file'], 'utf8')
    : (pullRequest?.body ?? '')
  const explicitMode =
    options['ci-mode'] ?? event.inputs?.ci_mode ?? process.env.MYTRACER_CI_MODE ?? ''
  const baseRevision =
    options.base ??
    pullRequest?.base?.sha ??
    event.before ??
    process.env.MYTRACER_BASE_REVISION ??
    ''
  const headRevision =
    options.head ?? pullRequest?.head?.sha ?? event.after ?? process.env.GITHUB_SHA ?? ''
  const paths = readChangedPaths(options, baseRevision, headRevision)
  const classification = buildClassification({
    paths,
    eventName,
    targetBranch,
    draft,
    body,
    explicitMode,
    baseRevision,
    headRevision
  })

  appendGitHubOutputs(classification)
  process.stdout.write(`${JSON.stringify(classification)}\n`)
}

function optionOrEnvironment(options, optionName, environmentName, fallback = '') {
  return options[optionName] ?? process.env[environmentName] ?? fallback
}

function runGate(options) {
  const checks = [
    {
      name: 'classify',
      expected: true,
      result: optionOrEnvironment(options, 'result-classify', 'MYTRACER_RESULT_CLASSIFY')
    },
    {
      name: 'pr-quality',
      expected: readBoolean(
        optionOrEnvironment(options, 'expect-pr-quality', 'MYTRACER_EXPECT_PR_QUALITY')
      ),
      result: optionOrEnvironment(options, 'result-pr-quality', 'MYTRACER_RESULT_PR_QUALITY')
    },
    {
      name: 'documentation',
      expected: readBoolean(
        optionOrEnvironment(options, 'expect-documentation', 'MYTRACER_EXPECT_DOCUMENTATION')
      ),
      result: optionOrEnvironment(options, 'result-documentation', 'MYTRACER_RESULT_DOCUMENTATION')
    },
    {
      name: 'governance',
      expected: readBoolean(
        optionOrEnvironment(options, 'expect-governance', 'MYTRACER_EXPECT_GOVERNANCE')
      ),
      result: optionOrEnvironment(options, 'result-governance', 'MYTRACER_RESULT_GOVERNANCE')
    },
    {
      name: 'verification',
      expected: readBoolean(
        optionOrEnvironment(options, 'expect-verification', 'MYTRACER_EXPECT_VERIFICATION')
      ),
      result: optionOrEnvironment(options, 'result-verification', 'MYTRACER_RESULT_VERIFICATION')
    },
    {
      name: 'milestone',
      expected: readBoolean(
        optionOrEnvironment(options, 'expect-milestone', 'MYTRACER_EXPECT_MILESTONE')
      ),
      result: optionOrEnvironment(options, 'result-milestone', 'MYTRACER_RESULT_MILESTONE')
    }
  ]

  const ciGateResult = optionOrEnvironment(options, 'result-ci-gate', 'MYTRACER_RESULT_CI_GATE')
  if (ciGateResult) {
    checks.push({ name: 'CI Gate', expected: true, result: ciGateResult })
  }

  const errors = []
  for (const check of checks) {
    if (check.expected && check.result !== 'success') {
      errors.push(`${check.name} was required but finished as ${check.result || 'missing'}`)
      continue
    }
    if (
      !check.expected &&
      ['failure', 'cancelled', 'timed_out', 'action_required'].includes(check.result)
    ) {
      errors.push(`${check.name} unexpectedly finished as ${check.result}`)
    }
  }

  if (errors.length > 0) {
    for (const error of errors) {
      process.stderr.write(`::error title=CI Gate::${escapeWorkflowMessage(error)}\n`)
    }
    process.exitCode = 1
    return
  }

  process.stdout.write('All required CI jobs completed successfully.\n')
}

function removeFragmentAndQuery(target) {
  return target.split('#', 1)[0].split('?', 1)[0]
}

function validateLocalLink(root, absoluteFile, filePath, rawTarget) {
  let target = rawTarget
  if (target.startsWith('<') && target.endsWith('>')) {
    target = target.slice(1, -1)
  }
  if (!target || target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(target)) {
    return undefined
  }

  const pathOnly = removeFragmentAndQuery(target)
  if (!pathOnly) {
    return undefined
  }

  let decoded
  try {
    decoded = decodeURIComponent(pathOnly)
  } catch {
    return `${filePath}: link has invalid percent encoding: ${target}`
  }

  const resolvedTarget = decoded.startsWith('/')
    ? resolve(root, decoded.slice(1))
    : resolve(dirname(absoluteFile), decoded)
  const relativeTarget = relative(root, resolvedTarget)
  if (
    relativeTarget === '..' ||
    relativeTarget.startsWith('../') ||
    relativeTarget.startsWith('..\\') ||
    isAbsolute(relativeTarget)
  ) {
    return `${filePath}: link leaves the repository: ${target}`
  }
  if (!existsSync(resolvedTarget)) {
    return `${filePath}: broken local link: ${target}`
  }
  return undefined
}

function visibleMarkdown(content) {
  return stripComments(content).replace(/^(?:```|~~~)[\s\S]*?^(?:```|~~~)\s*$/gm, '')
}

function validateMarkdownStructure(content, filePath) {
  const visible = visibleMarkdown(content)
  const errors = []
  if (/^(?:<{7}|={7}|>{7})(?:\s|$)/m.test(visible)) {
    errors.push(`${filePath}: unresolved conflict marker`)
  }

  const headings = [...visible.matchAll(/^(#{1,6})\s+\S.*$/gm)].map((match) => match[1].length)
  if (!headings.includes(1)) {
    errors.push(`${filePath}: documentation must contain a level-one heading`)
  }
  for (let index = 1; index < headings.length; index += 1) {
    if (headings[index] > headings[index - 1] + 1) {
      errors.push(
        `${filePath}: heading levels must not skip from H${headings[index - 1]} to H${headings[index]}`
      )
    }
  }

  return errors
}

function validateMarkdownLinks(root, absoluteFile, filePath, content) {
  const visible = visibleMarkdown(content)
  const errors = []
  const inlineLinks = visible.matchAll(/!?\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+['"][^)]*['"])?\)/g)

  for (const match of inlineLinks) {
    const error = validateLocalLink(root, absoluteFile, filePath, match[1])
    if (error) {
      errors.push(error)
    }
  }

  const definitions = new Map()
  for (const match of visible.matchAll(/^\s{0,3}\[([^\]]+)\]:\s*(<[^>]+>|\S+)/gm)) {
    const label = match[1].trim().replace(/\s+/g, ' ').toLowerCase()
    if (definitions.has(label)) {
      errors.push(`${filePath}: duplicate reference link definition: ${match[1]}`)
      continue
    }
    definitions.set(label, match[2])
    const error = validateLocalLink(root, absoluteFile, filePath, match[2])
    if (error) {
      errors.push(error)
    }
  }

  for (const match of visible.matchAll(/!?\[([^\]]+)\]\[([^\]]*)\]/g)) {
    const label = (match[2] || match[1]).trim().replace(/\s+/g, ' ').toLowerCase()
    if (!definitions.has(label)) {
      errors.push(`${filePath}: missing reference link definition: ${label}`)
    }
  }

  return errors
}

async function validateDocumentationFile(prettier, root, filePath) {
  const absoluteFile = resolve(root, filePath)
  if (!existsSync(absoluteFile) || !statSync(absoluteFile).isFile()) {
    return []
  }

  const content = readFileSync(absoluteFile, 'utf8')
  const errors = [
    ...validateMarkdownStructure(content, filePath),
    ...validateMarkdownLinks(root, absoluteFile, filePath, content)
  ]

  try {
    const configuration = await prettier.resolveConfig(absoluteFile)
    const formatted = await prettier.check(content, {
      ...(configuration ?? {}),
      filepath: absoluteFile
    })
    if (!formatted) {
      errors.push(`${filePath}: documentation is not formatted with Prettier`)
    }
  } catch (error) {
    errors.push(`${filePath}: documentation format check failed: ${error.message}`)
  }

  return errors
}

async function runDocs(options) {
  const root = resolve(options['repository-root'] ?? process.cwd())
  const paths = readChangedPaths(options, options.base ?? '', options.head ?? '')
  const documentationPaths = paths.filter(
    (filePath) => /\.(?:md|mdx)$/i.test(filePath) && existsSync(resolve(root, filePath))
  )
  const prettier = await import('prettier')
  const results = await Promise.all(
    documentationPaths.map((filePath) => validateDocumentationFile(prettier, root, filePath))
  )
  const errors = results.flat()

  if (errors.length > 0) {
    for (const error of errors) {
      process.stderr.write(`::error title=Documentation check::${escapeWorkflowMessage(error)}\n`)
    }
    process.exitCode = 1
    return
  }

  process.stdout.write(`Validated ${documentationPaths.length} changed documentation file(s).\n`)
}

async function main() {
  const { command, options } = parseArguments(process.argv.slice(2))
  if (command === 'classify') {
    runClassify(options)
    return
  }
  if (command === 'gate') {
    runGate(options)
    return
  }
  if (command === 'docs') {
    await runDocs(options)
    return
  }
  throw new Error(`Unknown command: ${command}`)
}

try {
  await main()
} catch (error) {
  process.stderr.write(`::error title=CI governance::${escapeWorkflowMessage(error.message)}\n`)
  process.exitCode = 1
}
