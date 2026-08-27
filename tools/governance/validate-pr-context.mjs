import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const REQUIRED_SECTIONS = [
  { name: 'Summary', aliases: ['Summary', 'Goal'] },
  { name: 'Validation', aliases: ['Validation', 'Verification'] },
  { name: 'Evidence', aliases: ['Evidence'] },
  { name: 'Risk', aliases: ['Risk', 'Risks and gaps'] }
]

function parseArguments(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument.startsWith('--')) {
      throw new Error(`Unexpected argument: ${argument}`)
    }
    const key = argument.slice(2)
    const value = argv[index + 1]
    if (value !== undefined && !value.startsWith('--')) {
      options[key] = value
      index += 1
    } else {
      options[key] = 'true'
    }
  }
  return options
}

function loadEvent(options) {
  const eventPath = options['event-file'] ?? process.env.GITHUB_EVENT_PATH
  if (!eventPath || !existsSync(eventPath)) {
    return {}
  }
  return JSON.parse(readFileSync(eventPath, 'utf8'))
}

function stripComments(value) {
  return value.replace(/<!--[\s\S]*?-->/g, '')
}

function parseSections(body) {
  const sections = new Map()
  let current = ''

  for (const line of stripComments(body).split(/\r?\n/)) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*$/)
    if (heading) {
      current = heading[1].trim().toLowerCase()
      if (!sections.has(current)) {
        sections.set(current, [])
      }
      continue
    }
    if (current) {
      sections.get(current).push(line)
    }
  }

  return new Map([...sections.entries()].map(([name, lines]) => [name, lines.join('\n').trim()]))
}

function sectionValue(sections, names) {
  return names
    .map((name) => sections.get(name.toLowerCase()) ?? '')
    .filter(Boolean)
    .join('\n')
}

function hasActualContext(value) {
  const lines = value
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^(?:[-*+]|\d+[.)])\s+/, '')
        .replace(/^\[[ xX]\]\s*/, '')
        .replace(/[*_`~]/g, '')
        .trim()
    )
    .filter(Boolean)

  return lines.some((line) => !/^(?:tbd|todo|pending|not yet|not run|n\/?a)(?:[.!])?$/i.test(line))
}

function firstContextLine(value) {
  return value
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^(?:[-*+]|\d+[.)])\s+/, '')
        .replace(/^\[[ xX]\]\s*/, '')
        .replace(/[*_`~]/g, '')
        .trim()
    )
    .find(Boolean)
}

function parseTaskDeclaration(value) {
  const declaration = firstContextLine(value)
  if (!declaration) {
    return { taskId: undefined, invalidTaskId: false }
  }

  if (!/^T\d/i.test(declaration)) {
    return { taskId: undefined, invalidTaskId: false }
  }

  const taskId = declaration.match(/^T\d{3}(?=$|[\s:/|\-—])/i)?.[0]
  if (!taskId) {
    return { taskId: undefined, invalidTaskId: true }
  }

  return { taskId: taskId.toUpperCase(), invalidTaskId: false }
}

function escapeWorkflowMessage(value) {
  return String(value).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')
}

function emit(level, message) {
  const title = level === 'error' ? 'PR context' : 'PR context warning'
  const stream = level === 'error' ? process.stderr : process.stdout
  stream.write(`::${level} title=${title}::${escapeWorkflowMessage(message)}\n`)
}

function validateCommitTitles(pullRequest, titlePattern) {
  const baseRevision = pullRequest.base?.sha
  const headRevision = pullRequest.head?.sha
  if (!baseRevision || !headRevision) {
    return
  }

  const result = spawnSync(
    'git',
    ['log', '--format=%s', '--no-merges', `${baseRevision}..${headRevision}`],
    { encoding: 'utf8', shell: false, windowsHide: true }
  )
  if (result.status !== 0) {
    emit('warning', 'Commit title convention could not be checked from the available history')
    return
  }

  for (const title of result.stdout.split(/\r?\n/).filter(Boolean)) {
    if (!titlePattern.test(title)) {
      emit('warning', `Commit title should follow type(Txxx): summary: ${title}`)
    }
  }
}

function validatePullRequest(pullRequest) {
  const body = pullRequest.body ?? ''
  const title = pullRequest.title ?? ''
  const draft = pullRequest.draft === true
  const sections = parseSections(body)
  const missing = []

  const task = sectionValue(sections, ['Task'])
  if (!hasActualContext(task)) {
    missing.push('Task must contain actual context')
  }
  const { taskId, invalidTaskId } = parseTaskDeclaration(task)
  if (invalidTaskId) {
    missing.push('Task must use a valid Txxx identifier when declaring a task ID')
  }
  for (const { name, aliases } of REQUIRED_SECTIONS) {
    if (!hasActualContext(sectionValue(sections, aliases))) {
      missing.push(`${name} must contain actual context`)
    }
  }

  const titlePattern = taskId
    ? /^(?:feat|fix|test|docs|refactor|chore|build|ci)\(T\d{3}\):\s+\S/i
    : /^(?:feat|fix|test|docs|refactor|chore|build|ci):\s+\S/i
  if (!titlePattern.test(title) || (taskId && !title.toUpperCase().includes(`(${taskId})`))) {
    emit(
      'warning',
      taskId
        ? 'PR title should follow type(Txxx): summary and match the Task section'
        : 'PR title should follow type: summary when the PR has no single task ID'
    )
  }
  validateCommitTitles(pullRequest, titlePattern)

  if (missing.length > 0 && draft) {
    for (const issue of missing) {
      emit('warning', `Draft PR: ${issue}`)
    }
    process.stdout.write('Draft PR context is incomplete; warnings do not fail validation.\n')
    return
  }

  if (missing.length > 0) {
    for (const issue of missing) {
      emit('error', issue)
    }
    process.exitCode = 1
    return
  }

  process.stdout.write('PR context satisfies the structural requirements.\n')
}

try {
  const options = parseArguments(process.argv.slice(2))
  const event = loadEvent(options)
  if (!event.pull_request) {
    process.stdout.write('PR context validation is not applicable to this event.\n')
  } else {
    validatePullRequest(event.pull_request)
  }
} catch (error) {
  process.stderr.write(`::error title=PR context::${escapeWorkflowMessage(error.message)}\n`)
  process.exitCode = 1
}
