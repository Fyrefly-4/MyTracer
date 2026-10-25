# CI measurements and Electron failure evidence

Related: [issue #153](https://github.com/Fyrefly-4/MyTracer/issues/153).

The source tier keeps one required **CI Gate**, serial checks, pinned tools, npm cache,
old-run cancellation and read-only permissions. Its install, Electron installation,
format, lint, types, unit, integration, build and E2E phases now have separate Actions
steps. Each phase records its actual child-process wall time and exit code in JSON,
with run, attempt, PR head, base and actual checkout (the PR test merge) identifiers.
A failed phase stops normal subsequent steps; artifact upload cannot make it green.
Documentation and release-tooling tiers retain their existing commands.

`ci-phases-*` contains phase JSON and the Playwright JSON report. Missing phase files
mean **not measured/not run**, never zero seconds or success. Cancellation can interrupt
recording; consult the Actions conclusion. Timings include command startup and are not
CPU time. Compare the same head, base/test merge, attempt, image, dependency cache state
and test selection before attributing a difference to the runner. Preserve the first
failure and diagnose it before any purposeful repeat; retries remain zero.

## Bounded historical baseline

[Machine-readable samples](ci-baseline.json) cover successful runs
[40112670799](https://github.com/Fyrefly-4/MyTracer/actions/runs/40112670799) and
[40118727700](https://github.com/Fyrefly-4/MyTracer/actions/runs/40118727700), plus
[40147942580](https://github.com/Fyrefly-4/MyTracer/actions/runs/40147942580).
The job logs identify exact head, base and merge commits, the same Windows image,
and runner-reported unit/integration/E2E durations. Attempt was not exposed by the
retrieved connector metadata or logs and remains explicitly unknown. Installation,
fast checks and build have no directly instrumented wall time in these old aggregate
runs; do not substitute API job duration or gaps between log lines for test duration.
These different-head observations establish context, not a speedup or flaky-test claim.

PR #151's incorrect exact label locator was a deterministic test error; restored-draft
autofocus subsequently exposed a real scroll displacement. PR #154's stale schema/export
expectations, hidden textbox lookup, collapsed-content layout assumption and broad text
locators were also concrete failures. Their fixes are already merged. This slice adds
observation, not speculative waits, tolerance changes or unrelated product repairs.

## Actual Electron contexts

The goal-content-draft, routine-content-draft and Data reading regression call
`startElectronDiagnostics` on the application returned by `electron.launch`, before
fixture setup and assertions. Named steps distinguish launch, first window, trace
startup and the draft continuity/race scenario; Playwright API/assertion steps provide
locator and expected/actual details inside it. Tracing the standard browser fixture
would not capture these manually created Electron contexts.

On failure, capture occurs before closing windows: each window screenshot, actual
context trace, bounded main/renderer console errors, renderer errors and crashes.
Successful traces are discarded. This helper is only for isolated synthetic roots
with `minimalElectronEnvironment`; never use it with developer/user profiles, real
providers or credentials. No environment dump, database, export directory or arbitrary
application log files are uploaded. Trace snapshots can contain synthetic text.
Artifacts expire after seven days. Start-up failures before the helper attaches remain
in the named launch step and Playwright report; a crashed window may not yield a screenshot.

`npm run test:diagnostics` runs a separate deliberate failing probe after build. It
requires the original assertion failure and nonempty PNG/trace/application-error
attachments. A green, skipped, launch-failed or unrelated failed probe fails the checker.
The controlled child failure remains visible in JSON; the checker passes only when
that exact negative control is proven. The probe is outside the ordinary E2E testDir,
while the complete original regression suite still runs before merge. Its synthetic
attachments are uploaded even on success so the control can be inspected.

On Windows, after build, focused validation remains:

```powershell
npm.cmd run test:diagnostics
npm.cmd run test:e2e:run -- tests/e2e/goal-content-draft.e2e.test.ts tests/e2e/routine-content-draft.e2e.test.ts
```

Focused success does not replace the full gate. Linux sandbox failures are environment
limits: do not disable the sandbox or change host permissions. Hosted Windows evidence
is required to establish native capture behavior. Sharding, desktop parallelism,
additional classification and speed claims remain deferred until comparable measurements
justify them. Extend the small helper to other isolated suites only with a demonstrated
need and keep semantic assertions intact.


## Release integration fixture timing

In [run 40145815296](https://github.com/Fyrefly-4/MyTracer/actions/runs/40145815296),
the first `release-tag-flow` visibility scenario took 8.852 s and exceeded Vitest's
unchanged 5 s test limit; the next visibility case took 1.345 s. The old wrapper
included fixture creation, a fresh PowerShell compression process and two real
PowerShell extractions in each happy-path case. It did not measure these separately,
so cold-start compression versus extraction, filesystem work or runner contention
cannot be assigned a proven share of that outlier.

The suite now creates its immutable synthetic ZIP once in `beforeAll`, using the
same PowerShell compression. Each of the 23 scenarios keeps independent mutable
metadata, working directory, API call log and cleanup, and continues calling the
production extractor for prepare/publish. No selection, visibility, hash or write
ordering assertions are moved out of their tests. Default test/hook limits and the
existing child-process bound are unchanged; setup failures still fail the suite.

`release-tag-flow.ndjson` in the phase artifact records shared compression/setup,
isolated setup, prepare/extraction/validation, publish/extraction/validation and
cleanup times. The subprocess duration includes Node startup/imports. A child exit
zero does not override a Vitest timeout; consult the test runner's conclusion.
A phase rejection can be expected by a negative test; the child/test result determines
whether its assertion passed. These measurements will determine whether remaining
work is in setup, actual extraction or elsewhere. Removing 22 redundant compressions
is a bounded fixture change, not evidence that the original outlier was conclusively
caused by compression or a claim of general CI speedup.


## Windows evidence and Data scroll restoration

[Verification 40146912058](https://github.com/Fyrefly-4/MyTracer/actions/runs/40146912058)
on head `d108e84432fdf4c033d72396134420e54dd227a6`, test merge
`fe0cc7722e712e67282c813f4c2ec1d7d4fe2944`, passed integration (277, one skipped),
build and the **actual Electron diagnostic negative control**. The checker confirmed
that the controlled assertion stayed failed and that PNG, real-context trace and
main/renderer synthetic errors were attached. This is native Windows proof, not
inference from configuring Playwright's browser fixture. Artifact `12580239282` was
published; connector download access was unavailable, so its visual contents have not
been independently inspected. Installer run `40146912060` also succeeded.

Shared ZIP compression measured 1047 ms (1071 ms including setup/cleanup); the two
visibility subprocesses measured 883/894 ms, including real prepare extraction and
validation at 388/386 ms and publish extraction/validation at 385/398 ms. All 23
release-tag scenarios passed. This single new sample does not prove the cause of the
previous 8.852 s outlier or a general speedup.

Full E2E still failed one Data reading assertion (130 passed, five skipped): after
returning from Progress, the long note was open but detail `scrollTop` was 0 instead
of 180. That suite did not yet use the context diagnostic helper, so the old log cannot
establish whether the outgoing native scroll event was delivered. Source inspection
also identified a real readiness gap: `data !== null` became true before the subsequent
selection reconciliation commit mounted the selected record. The one-shot frame could
then restore into an empty pane and clamp its offset to zero.

Data now waits for its selected record (or an actually empty result) before restoring.
The regression awaits native scroll-event delivery before leaving, retains the exact
180 assertion, and captures bounded numeric scroll events with pane height, mounted
record and disclosure state alongside the real-context trace. It does not synthesize
scroll events or use sleeps. Both possible timing boundaries are now explicit; the
old failure's exact interleaving remains unproven.

The Windows source gate runs that focused scenario three independent times with
`--repeat-each=3`, serially and with zero retries, before the unchanged full E2E suite.
Every repetition must pass. `scroll-repeat.json` is separate from the full-suite JSON;
a focused failure still fails the gate. This is bounded regression evidence, not a
retry-until-green policy or a replacement for full premerge coverage.


## Bounded Windows focused entrypoint (next batch after #158)

PR #158 was merged at `c8b0112ac6fa965a745f3f937caa9e88119ada2f`.
Its final successful run `40147942580` reports unit 15.68 s, integration 45.53 s,
three Data repetitions 16.0 s, and full E2E 5.3 minutes (rounded by Playwright).
All 593 unit, 277 integration plus one skip, three focused runs and 131 E2E plus
five skips passed. The actual Electron diagnostic negative control passed too.
These are runner-reported measurements at head `f56cd3f`, base `926636a`,
test merge `54463f3`; they do not establish a cross-head speed improvement.

The log shows the Data focused command starts after format/lint/types/unit/integration
and build. That ordering explains why a developer needing one native check still waits
for unrelated checks in the full workflow. Exact first-feedback savings are **not yet
measured**. The earlier phase JSON exists in artifacts, but download access was unavailable;
step-boundary gaps are not substituted for exact phase durations. `run-phase.mjs` now
prints the same bounded `CI_PHASE` JSON record it writes to the artifact, including
failures, so subsequent analysis can use exact measurements from readable logs.

The next small change is [Focused Electron](../../.github/workflows/electron-focus.yml),
a separate Windows workflow for development evidence. Its checkout, locked installation,
build and actual-context diagnostic control precede the chosen profile:

| Profile | Existing tests | Purpose |
| --- | --- | --- |
| `data-reading` | History-reading scenario only | Exact pane restoration, pagination and protected edits |
| `content-drafts` | Goal and routine content draft suites (11 scenarios at introduction) | Selection, navigation, delayed responses and draft continuity |
| `recovery-context` | Existing Recovery reopen scenario | Distinguish launch, body, reopen and cleanup stalls |

Select **Actions → Focused Electron → Run workflow**, select the intended branch/ref,
and choose a profile and `1` or `3` independent runs. Inspect the recorded checkout SHA,
run/attempt and selection before interpreting results. A manual branch run does not
verify a PR's test merge. Alternatively, with an authorized GitHub CLI:

```powershell
gh workflow run electron-focus.yml --ref <branch> -f profile=data-reading -f repeat=3
```

GitHub exposes manual dispatch only once the workflow exists on the default branch.
Before that first merge, this workflow self-checks its entrypoint on PR changes to its
workflow, selector, runner, adapter tests or Recovery scenario; it currently runs
`recovery-context` three times on the PR test merge. The initial content-drafts self-check
passed on Windows in run `40159955911` (head `143dcba`). It does not run automatically on every product change. The existing Verification
workflow still runs the complete required `CI Gate` for applicable source PRs, unchanged.
The focused job has a distinct name and concurrency group, so it neither substitutes
for nor cancels full verification. Do not make this path-filtered optional job a required
check without a separate branch-protection design.

The selector rejects arbitrary files, grep expressions, shell flags, worker counts and
retry settings. Workers remain one, retries zero, and every selected repetition must
pass. A child exit zero is insufficient: the selector requires a fresh Playwright report
with executed passing tests, no skips/failures/flaky outcomes, and complete repetition
counts. Before execution, the same selection is collected with `--list --forbid-only`.
Every selected file must be represented, and the fresh discovery manifest must contain
unique identities for each scenario/repetition. Execution must exactly match those IDs,
file/title/location identities and every successful result (one attempt, no retries).
Both collection and execution forbid `.only`; totals divisible by the repeat count are
not sufficient. This discovers current scenarios instead of hard-coding today's count.
A stale discovery or execution report is removed before launch. The focus phase duration
includes collection plus execution; `focusStage` identifies which child supplied its exit code. The workflow does not change test timeouts or assertions. Reuse only isolated
synthetic fixtures and the existing sandbox-preserving Electron launch code. Profiles
are intentionally limited to tests already using actual-context diagnostics.

`electron-focus-phases-*` contains the phase identity/timing JSON, `focus-discovery.json` and `focus-repeat.json`;
`electron-focus-evidence-*` contains the diagnostic negative control and any failed
profile captures. Retention is seven days. Both upload on failure; cancellation or missing
output is not success. The summary explicitly says focused-only, not CI Gate. This job
runs no packaging, publication, real data or live-provider work.

### What remains measurement-led

Compare focused and full feedback only after recording matched head/test merge, image,
cache status, selection and actual phase durations. Separate queue/install/build/diagnostic
cost from the selected test time; a shorter test list does not remove those fixed costs.
A single self-check run proves execution, not a performance distribution or reliability rate.
No extra benchmark runs were launched merely to manufacture a speed claim.

The fourth-round candidate is review of unusually long, unrelated scenarios, but the
current Data reading and draft tests expose cross-navigation state loss. Splitting those
flows or moving scroll/focus assertions to unit tests could remove the very trigger they
protect. Keep them intact. Pure schema/DTO/text failures already have lower-level coverage;
no demonstrated redundant case justifies deleting premerge checks in this batch. Sharding,
more workers, release/installer trigger changes and broad test migration remain deferred.


### Recovery timeout investigation (PR #159)

The original failed run [40159955914](https://github.com/Fyrefly-4/MyTracer/actions/runs/40159955914),
job `121069480138`, head `143dcba15f075084aa5a7bc86853ef3a2730dd7f`,
test merge `14219ef27339f2192b5fea17c15d56d8aa8a9b37`, attempt 1, remains evidence.
The full suite reported 130 passed, five skipped and the unchanged Recovery scenario
failed at its 30-second test budget, followed by a 30-second worker-teardown timeout.
Its E2E phase measured 295689 ms. Earlier phases, the real Electron diagnostic negative
control and the repeated Data scroll assertions passed. This is not evidence of a
specific product race or a proven flaky test.

The readable log has no call stack identifying launch, assertions, close or root removal.
The failure artifact `12586181267` exists, but its returned download URL gave HTTP 403;
its error-context contents have not been read. The scenario previously lacked actual-context
tracing and lifecycle markers. Its last source change predates this maintenance branch.

The bounded next experiment instruments the same scenario with static step names and
durations, including both launches, controlled dates, synthetic setup, factual assertions,
close/reopen and cleanup. Both manually launched contexts use the existing diagnostics
helper. Cleanup errors cannot replace an earlier failure; cleanup alone still fails a test.
Traces stop before successful close; lifecycle start/done markers locate a close stall even
when trace capture cannot finish. No user data, environment dump or database is collected.
Windows focused validation executes all three independent repetitions with exact manifest
matching and zero retries; full premerge E2E still includes the scenario. Neither passing
repetitions nor a passing full run alone establish the original root cause. No timeout,
assertion, sandbox setting or product behavior was changed for this experiment.
