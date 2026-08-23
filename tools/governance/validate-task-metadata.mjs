#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises'
import { join, basename } from 'node:path'

const RELATIONS = ['requires', 'blocks', 'can_parallel', 'prefer_after', 'conflicts_with']
const SURFACE_LISTS = ['files', 'modules', 'schema_tables', 'ipc_contracts', 'domain_invariants']
const RISKS = new Set(['low', 'medium', 'high'])
const INTEGRATION_POLICIES = new Set(['serial', 'parallel', 'owner-review'])
const TASK_KINDS = new Set([
  'implementation',
  'fix',
  'governance',
  'aggregate',
  'milestone',
  'hotfix'
])
const PROFILE_LIFECYCLE_STATES = new Set(['ready', 'active', 'review', 'done'])
const PROFILE_PHASES = new Set([
  'local_development',
  'validation_execution',
  'task_branch_publish',
  'draft_pr_maintenance',
  'review_handoff'
])
const OWNER_GATES = new Set([
  'docs_closeout_scope',
  'ready_for_review',
  'merge_dev',
  'merge_main',
  'tag',
  'release',
  'dependency_change',
  'migration_change',
  'non_task_publication_external_write',
  'ai_provider_or_permission_change'
])
const ADDITIONAL_CONSTRAINTS = new Set(['disable_phase', 'pause_before'])
const CLEANUP_STATES = new Set(['merged', 'owner-released'])
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/

function parseArguments(argv) {
  const options = {
    metadataDir: 'docs/implementation/metadata',
    profilesDir: 'docs/implementation/profiles',
    taskIndex: 'docs/implementation/TASK_INDEX_V0.1.md'
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--metadata-dir') {
      options.metadataDir = argv[++index]
    } else if (argument === '--profiles-dir') {
      options.profilesDir = argv[++index]
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

function isProfileId(value) {
  return typeof value === 'string' && /^[a-z][a-z0-9-]*@[1-9]\d*$/.test(value)
}

function validateStringArray(value, path, errors, { allowEmpty = true, allowed } = {}) {
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
    if (allowed && !allowed.has(item)) {
      errors.push(`${path} contains unsupported value ${item}`)
    }
    seen.add(item)
  }
}

function parseTimestamp(value, path, errors) {
  if (typeof value !== 'string' || !RFC3339.test(value)) {
    errors.push(`${path} must be an RFC3339 timestamp with timezone`)
    return null
  }
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) {
    errors.push(`${path} must be a valid timestamp`)
    return null
  }
  return timestamp
}

function hasSurfaceIdentifier(surface) {
  return SURFACE_LISTS.some((key) => Array.isArray(surface[key]) && surface[key].length > 0)
}

function expectedProfileFilename(profileId) {
  if (!isProfileId(profileId)) return null
  const [name, version] = profileId.split('@')
  return `${name}-v${version}.json`
}

function validateProfile(value, filename) {
  const errors = []
  if (!isRecord(value)) {
    return [`${filename}: root must be an object`]
  }
  if (value.schemaVersion !== 1) {
    errors.push(`${filename}: schemaVersion must be 1`)
  }
  if (!isProfileId(value.id)) {
    errors.push(`${filename}: id must use name@positive-version format`)
  }
  const expectedFilename = expectedProfileFilename(value.id)
  if (expectedFilename && basename(filename) !== expectedFilename) {
    errors.push(`${filename}: filename must be ${expectedFilename}`)
  }
  validateStringArray(value.taskKinds, `${filename}:taskKinds`, errors, {
    allowEmpty: false,
    allowed: TASK_KINDS
  })
  validateStringArray(value.automaticPhases, `${filename}:automaticPhases`, errors, {
    allowEmpty: false,
    allowed: PROFILE_PHASES
  })
  validateStringArray(value.ownerGates, `${filename}:ownerGates`, errors, {
    allowEmpty: false,
    allowed: OWNER_GATES
  })
  for (const gate of OWNER_GATES) {
    if (Array.isArray(value.ownerGates) && !value.ownerGates.includes(gate)) {
      errors.push(`${filename}:ownerGates is missing repository safety gate ${gate}`)
    }
  }
  if (
    !Number.isInteger(value.maxValidityDays) ||
    value.maxValidityDays < 1 ||
    value.maxValidityDays > 30
  ) {
    errors.push(`${filename}:maxValidityDays must be an integer from 1 through 30`)
  }
  validateStringArray(
    value.allowedAdditionalConstraints,
    `${filename}:allowedAdditionalConstraints`,
    errors,
    { allowed: ADDITIONAL_CONSTRAINTS }
  )
  if (!isRecord(value.worktree)) {
    errors.push(`${filename}:worktree must be an object`)
  } else {
    if (typeof value.worktree.isolationRequired !== 'boolean') {
      errors.push(`${filename}:worktree.isolationRequired must be boolean`)
    }
    if (typeof value.worktree.disposable !== 'boolean') {
      errors.push(`${filename}:worktree.disposable must be boolean`)
    }
    validateStringArray(value.worktree.cleanupAfter, `${filename}:worktree.cleanupAfter`, errors, {
      allowEmpty: false,
      allowed: CLEANUP_STATES
    })
  }
  if (!isRecord(value.extensionPoints)) {
    errors.push(`${filename}:extensionPoints must be an object`)
  } else {
    if (value.extensionPoints.compatibility !== 'additive-within-v1') {
      errors.push(`${filename}:extensionPoints.compatibility must be additive-within-v1`)
    }
    if (value.extensionPoints.breakingChanges !== 'require-new-profile-version') {
      errors.push(`${filename}:extensionPoints.breakingChanges must be require-new-profile-version`)
    }
  }
  return errors
}

function validateExecution(value, filename, taskKind, taskState, profiles, errors) {
  const path = `${filename}:execution`
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`)
    return
  }
  const profile = profiles.get(value.profile)
  if (!profile) {
    errors.push(`${path}.profile references unknown profile ${value.profile}`)
  }
  if (!TASK_KINDS.has(taskKind)) {
    errors.push(`${filename}:task_kind is required and must be supported when execution is present`)
  } else if (profile && !profile.taskKinds.includes(taskKind)) {
    errors.push(`${path}.profile does not support task kind ${taskKind}`)
  }
  if (!PROFILE_LIFECYCLE_STATES.has(taskState)) {
    errors.push(`${path} is incompatible with TASK_INDEX state ${taskState ?? 'unknown'}`)
  }

  const activatedAt = parseTimestamp(value.activated_at, `${path}.activated_at`, errors)
  const validUntil = parseTimestamp(value.valid_until, `${path}.valid_until`, errors)
  if (activatedAt !== null && validUntil !== null) {
    if (validUntil <= activatedAt) {
      errors.push(`${path}.valid_until must be later than activated_at`)
    } else if (profile && validUntil - activatedAt > profile.maxValidityDays * 86_400_000) {
      errors.push(`${path} validity exceeds ${profile.maxValidityDays} days`)
    }
  }

  if (!Array.isArray(value.additional_constraints)) {
    errors.push(`${path}.additional_constraints must be an array`)
    return
  }
  const seen = new Set()
  for (const [index, constraint] of value.additional_constraints.entries()) {
    const constraintPath = `${path}.additional_constraints[${index}]`
    if (!isRecord(constraint)) {
      errors.push(`${constraintPath} must be an object`)
      continue
    }
    if (!profile?.allowedAdditionalConstraints.includes(constraint.type)) {
      errors.push(`${constraintPath}.type is not allowed by profile ${value.profile}`)
    }
    if (!profile?.automaticPhases.includes(constraint.phase)) {
      errors.push(`${constraintPath}.phase is not defined by profile ${value.profile}`)
    }
    const key = `${constraint.type}:${constraint.phase}`
    if (seen.has(key)) errors.push(`${path}.additional_constraints contains duplicate ${key}`)
    seen.add(key)
  }
}

function validateSidecar(value, filename, knownTasks, taskStates, profiles) {
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
  if (value.task_kind !== undefined && !TASK_KINDS.has(value.task_kind)) {
    errors.push(`${filename}:task_kind is unsupported`)
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
  if (value.execution !== undefined) {
    validateExecution(
      value.execution,
      filename,
      value.task_kind,
      taskStates.get(value.task),
      profiles,
      errors
    )
  }
  return errors
}

function readTaskIndex(taskIndex) {
  const knownTasks = new Set()
  const taskStates = new Map()
  for (const line of taskIndex.split(/\r?\n/)) {
    const columns = line.split('|').map((column) => column.trim())
    const task = columns[1]
    if (!isTaskId(task)) continue
    knownTasks.add(task)
    const state = columns[6]?.replaceAll('`', '')
    if (state) taskStates.set(task, state)
  }
  return { knownTasks, taskStates }
}

async function loadProfiles(directory, errors) {
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .sort((left, right) => left.name.localeCompare(right.name))
  if (entries.length === 0) throw new Error('No automation profiles found.')

  const profiles = new Map()
  for (const entry of entries) {
    const filename = join(directory, entry.name)
    let value
    try {
      value = JSON.parse(await readFile(filename, 'utf8'))
    } catch {
      errors.push(`${filename}: invalid JSON`)
      continue
    }
    const profileErrors = validateProfile(value, filename)
    errors.push(...profileErrors)
    if (isProfileId(value.id) && profileErrors.length === 0) {
      if (profiles.has(value.id)) errors.push(`${filename}: duplicate profile ${value.id}`)
      profiles.set(value.id, value)
    }
  }
  return profiles
}

async function run(argv) {
  const options = parseArguments(argv)
  const taskIndex = await readFile(options.taskIndex, 'utf8')
  const { knownTasks, taskStates } = readTaskIndex(taskIndex)
  const errors = []
  const profiles = await loadProfiles(options.profilesDir, errors)
  if (!profiles.has('standard-task@1')) {
    errors.push(`${options.profilesDir}: required profile standard-task@1 is missing`)
  }
  const entries = (await readdir(options.metadataDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .sort((left, right) => left.name.localeCompare(right.name))
  if (entries.length === 0) {
    throw new Error('No metadata sidecars found.')
  }

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
    errors.push(...validateSidecar(value, filename, knownTasks, taskStates, profiles))
  }

  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`metadata: ${error}\n`)
    return 1
  }
  process.stdout.write(
    `Metadata checks passed: ${entries.length} sidecar(s), ${profiles.size} profile(s).\n`
  )
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
