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
