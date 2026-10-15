import { appendFileSync, existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

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

function stripComments(value) {
  return value.replace(/<!--[\s\S]*?-->/g, '')
}

function normalizePath(filePath) {
  return filePath.replaceAll('\\', '/').replace(/^\.\//, '')
}

export function classifyPath(filePath) {
  const normalized = normalizePath(filePath).toLowerCase()
  // Executable locations take precedence, even for Markdown or YAML files.
  if (/^(?:src|tests|tools)\//.test(normalized) || normalized.startsWith('.github/workflows/')) {
    return 'source'
  }
  if (
    /\.(?:md|mdx)$/.test(normalized) ||
    /^\.agents\/skills\/[^/]+\/agents\/openai\.yaml$/.test(normalized)
  ) {
    return 'documentation'
  }
  return 'source'
}

export function classifyPaths(paths) {
  return paths.length > 0 && paths.every((filePath) => classifyPath(filePath) === 'documentation')
    ? 'documentation'
    : 'source'
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

export function buildClassification({ paths, eventName, baseRevision, headRevision }) {
  const category = eventName === 'workflow_dispatch' ? 'source' : classifyPaths(paths)
  return {
    category,
    run_verification: category === 'source',
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
  const baseRevision = options.base ?? event.pull_request?.base?.sha ?? event.before ?? ''
  // On PRs, CI checks the test-merge revision rather than only the source head.
  const headRevision =
    options.head ?? process.env.GITHUB_SHA ?? event.pull_request?.head?.sha ?? event.after ?? ''
  const paths = readChangedPaths(options, baseRevision, headRevision)
  const classification = buildClassification({ paths, eventName, baseRevision, headRevision })
  appendGitHubOutputs(classification)
  process.stdout.write(JSON.stringify(classification) + '\n')
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
  // GitHub inserts this fragment into a PR body, where H2 sections are conventional.
  if (!headings.includes(1) && filePath !== '.github/pull_request_template.md') {
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

function validateDocumentationFile(root, filePath) {
  const absoluteFile = resolve(root, filePath)
  if (!existsSync(absoluteFile) || !statSync(absoluteFile).isFile()) return []
  const content = readFileSync(absoluteFile, 'utf8')
  return [
    ...validateMarkdownStructure(content, filePath),
    ...validateMarkdownLinks(root, absoluteFile, filePath, content)
  ]
}

async function runDocs(options) {
  const root = resolve(options['repository-root'] ?? process.cwd())
  const paths = readChangedPaths(
    options,
    options.base ?? process.env.BASE_REVISION ?? '',
    options.head ?? process.env.HEAD_REVISION ?? ''
  )
  const documentationPaths = paths.filter(
    (filePath) => /\.(?:md|mdx)$/i.test(filePath) && existsSync(resolve(root, filePath))
  )
  const results = documentationPaths.map((filePath) => validateDocumentationFile(root, filePath))
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
