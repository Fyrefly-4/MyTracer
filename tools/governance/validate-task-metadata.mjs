#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises'
import { join, basename } from 'node:path'

const RELATIONS = ['requires', 'blocks', 'can_parallel', 'prefer_after', 'conflicts_with']
const SURFACE_LISTS = ['files', 'modules', 'schema_tables', 'ipc_contracts', 'domain_invariants']
const RISKS = new Set(['low', 'medium', 'high'])
const INTEGRATION_POLICIES = new Set(['serial', 'parallel', 'owner-review'])

function parseArguments(argv) {
  const options = {
    metadataDir: 'docs/implementation/metadata',
    taskIndex: 'docs/implementation/TASK_INDEX_V0.1.md'
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--metadata-dir') {
      options.metadataDir = argv[++index]
    } else if (argument === '--task-index') {
      options.taskIndex = argv[++index]
    } else {
      throw new Error(`Unknown option: ${argument}`)
    }
  }
  return options
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isTaskId(value) {
  return typeof value === 'string' && /^T\d{3,}$/.test(value)
}

function validateStringArray(value, path, errors, { allowEmpty = true } = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`)
    return
  }
  if (!allowEmpty && value.length === 0) {
    errors.push(`${path} must not be empty`)
  }
  const seen = new Set()
  for (const [index, item] of value.entries()) {
    if (typeof item !== 'string' || item.length === 0) {
      errors.push(`${path}[${index}] must be a non-empty string`)
      continue
    }
    if (seen.has(item)) {
      errors.push(`${path} contains duplicate ${item}`)
    }
    seen.add(item)
  }
}

function hasSurfaceIdentifier(surface) {
  return SURFACE_LISTS.some((key) => Array.isArray(surface[key]) && surface[key].length > 0)
}

function validateSidecar(value, filename, knownTasks) {
  const errors = []
  if (!isRecord(value)) {
    return [`${filename}: root must be an object`]
  }
  if (value.schemaVersion !== 1) {
    errors.push(`${filename}: schemaVersion must be 1`)
  }
  if (!isTaskId(value.task)) {
    errors.push(`${filename}: task must be a Txxx id`)
  }
  const expectedFilename = `${value.task ?? 'unknown'}.json`
  if (basename(filename) !== expectedFilename) {
    errors.push(`${filename}: filename must be ${expectedFilename}`)
  }
  if (value.task && knownTasks.has(value.task) === false) {
    errors.push(`${filename}: task ${value.task} is not present in TASK_INDEX`)
  }

  if (!isRecord(value.dependencies)) {
    errors.push(`${filename}: dependencies must be an object`)
  } else {
    for (const relation of Object.keys(value.dependencies)) {
      if (!RELATIONS.includes(relation)) {
        errors.push(`${filename}:dependencies.${relation} is an unsupported relation`)
      }
    }
    for (const relation of RELATIONS) {
      validateStringArray(
        value.dependencies[relation],
        `${filename}:dependencies.${relation}`,
        errors
      )
      for (const task of value.dependencies[relation] ?? []) {
        if (!isTaskId(task)) {
          errors.push(`${filename}:dependencies.${relation} contains invalid task ${task}`)
        } else if (!knownTasks.has(task)) {
          errors.push(`${filename}:dependencies.${relation} references unknown task ${task}`)
        }
      }
    }
    for (const relation of RELATIONS) {
      if ((value.dependencies[relation] ?? []).includes(value.task)) {
        errors.push(`${filename}:dependencies.${relation} cannot reference itself`)
      }
    }
  }

  const conflicts = Array.isArray(value.dependencies?.conflicts_with)
    ? value.dependencies.conflicts_with
    : []
  if (!isRecord(value.conflict_basis)) {
    errors.push(`${filename}:conflict_basis must be an object`)
  } else {
    for (const task of Object.keys(value.conflict_basis)) {
      if (!conflicts.includes(task)) {
        errors.push(`${filename}:conflict_basis has no conflicts_with entry for ${task}`)
      }
      if (
        typeof value.conflict_basis[task] !== 'string' ||
        value.conflict_basis[task].trim() === ''
      ) {
        errors.push(`${filename}:conflict_basis.${task} must be a non-empty string`)
      }
    }
    for (const task of conflicts) {
      if (!(task in value.conflict_basis)) {
        errors.push(`${filename}:conflict_basis is missing basis for ${task}`)
      }
    }
  }

  if (!Array.isArray(value.shared_surfaces) || value.shared_surfaces.length === 0) {
    errors.push(`${filename}:shared_surfaces must be a non-empty array`)
  } else {
    for (const [index, surface] of value.shared_surfaces.entries()) {
      const path = `${filename}:shared_surfaces[${index}]`
      if (!isRecord(surface)) {
        errors.push(`${path} must be an object`)
        continue
      }
      for (const key of SURFACE_LISTS) {
        validateStringArray(surface[key], `${path}.${key}`, errors)
      }
      if (!hasSurfaceIdentifier(surface)) {
        errors.push(
          `${path} must identify at least one shared file, module, table, contract or invariant`
        )
      }
      if (!RISKS.has(surface.risk)) {
        errors.push(`${path}.risk must be low, medium or high`)
      }
      if (!INTEGRATION_POLICIES.has(surface.integration_policy)) {
        errors.push(`${path}.integration_policy is invalid`)
      }
    }
  }

  validateStringArray(value.external, `${filename}:external`, errors)
  if (conflicts.length > 0 && !value.shared_surfaces?.some(hasSurfaceIdentifier)) {
    errors.push(`${filename}:conflicts_with requires a shared-surface basis`)
  }
  return errors
}

async function run(argv) {
  const options = parseArguments(argv)
  const taskIndex = await readFile(options.taskIndex, 'utf8')
  const knownTasks = new Set()
  for (const match of taskIndex.matchAll(/\|\s*(T\d{3,})\s*\|/g)) {
    knownTasks.add(match[1])
  }
  const entries = (await readdir(options.metadataDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .sort((left, right) => left.name.localeCompare(right.name))
  if (entries.length === 0) {
    throw new Error('No metadata sidecars found.')
  }

  const errors = []
  const seenTasks = new Set()
  for (const entry of entries) {
    const filename = join(options.metadataDir, entry.name)
    let value
    try {
      value = JSON.parse(await readFile(filename, 'utf8'))
    } catch {
      errors.push(`${filename}: invalid JSON`)
      continue
    }
    if (value.task && seenTasks.has(value.task)) {
      errors.push(`${filename}: duplicate task ${value.task}`)
    }
    if (value.task) seenTasks.add(value.task)
    errors.push(...validateSidecar(value, filename, knownTasks))
  }

  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`metadata: ${error}\n`)
    return 1
  }
  process.stdout.write(`Metadata checks passed: ${entries.length} sidecar(s).\n`)
  return 0
}

try {
  process.exitCode = await run(process.argv.slice(2))
} catch (error) {
  process.stderr.write(
    `metadata: ${error instanceof Error ? error.message : 'validation failed'}\n`
  )
  process.exitCode = 1
}
