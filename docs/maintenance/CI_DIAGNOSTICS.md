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
[40118727700](https://github.com/Fyrefly-4/MyTracer/actions/runs/40118727700).
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

The goal-content-draft and routine-content-draft suites call
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
