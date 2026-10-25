# Assistant renderer integration handoff

C owns only `features/assistant`, three entry pages, and focused renderer tests. This branch starts at `c4405a8` on `assistant/exploration`; it does not change the shared contracts, shell, preload, App, workflows, dependencies or main process.

## Dependencies and exports

Import B's `src/contracts/assistant.ts` from `400cb2b` and A's `src/contracts/assistant-service.ts` from `6d21253` through their owner PRs. No duplicate DTO is maintained here. C's local verification temporarily read those exact files from their owner branches, without committing them.

- `AssistantController` from `features/assistant/assistant-controller`: construct once with `(api: AssistantApi, service: Pick<AssistantServiceStatus, 'endpoint' | 'model' | 'enabled' | 'credentialPresent'>, simulation = false)`.
- `AssistantHost` from `features/assistant/AssistantHost`: `{ controller, children, scopeChoices?: {ref: AssistantObjectRef, label: string}[], onSource?: (ref) => void }`. Wrap the existing shell once; do not conditionally unmount the shell or pages when the modal opens. The host supplies the Context and one native modal dialog. Underlying drafts, DOM and scroll position stay mounted. Native modal focus containment and Escape are retained; closing restores the launch control's focus without scrolling.
- `AssistantSettings` from `features/assistant/AssistantSettings`: `{ api: AssistantServiceApi, simulation?: boolean, onChanged?: (status: AssistantServiceStatus) => void }`. Mount in the normal settings surface. Call `controller.updateService(status)` in `onChanged`. Main must independently cancel B requests and invalidate previews on configuration change; renderer cancellation is only an additional UI safeguard.
- `AssistantEntryButton` from `features/assistant/AssistantContext`: `{entry, label, children, disabled?, apply?: (payload) => boolean}`. The three pages already use this. Without a host, entries are absent. `apply` changes only the local editor state and is guarded by a live revision and component lifetime, both before and after the preview request.

Minimal owner wiring (not a replacement for lifecycle integration):

```tsx
const controller = new AssistantController(assistantApi, initialServiceStatus)
// Keep this controller stable for the shell lifetime.
<AssistantHost
  controller={controller}
  scopeChoices={explicitSelectableSources}
  onSource={navigateToExistingObject}
>
  {existingShell}
</AssistantHost>
// Inside the existing settings page:
<AssistantSettings
  api={assistantServiceApi}
  onChanged={(status) => controller.updateService(status)}
/>
```

`controller.close()` cancels its active request, invalidates async UI work and discards a temporary session; persistent sessions stay in B's store. `controller.canStop()` distinguishes a cancellable turn from preview/confirmation operations. `controller.stop()` is for active turns only. Main/update installation must still cancel and drain B/A operations through their owner-provided lifecycle APIs; renderer close cannot certify persistence flush or install safety.

Add `src/renderer/src/features/assistant/**/*.ts` and `src/renderer/src/features/assistant/**/*.tsx` to `tsconfig.test.json` include when reconciling A's additions. C deliberately does not modify this shared include concurrently. The browser harness TSX can optionally be included as `tests/renderer/**/*.tsx`; its Vite transpilation and Chromium execution are already covered separately.

## Entry and command semantics

- Action/routine history editors: `organize` with the record ID, current note and a revision including saved-record version, summary and note. The candidate may replace summary or append note in the current unsaved editor; it never presses Save.
- Goal detail: `resume`, with no Today requirement or date filter. Controller restores an available local session for the exact object, without calling send. B should return summaries newest-first (the fake adapter does).
- Review selected fact: `review`, object `{kind:'review', id:contextId}`, selected citation as `editorText`, editor revision includes current review fields and selected fact state. The selected fact is explicit, not the full fact browser. B/integration must resolve this live review context ID and validate the selected source, or return a clear unsupported/stale result. Review candidate fields remain independent (`confirmedProgress`, `mainObstacle`, `nextAdjustment`). Do not silently reinterpret the transient review context ID as a persisted review record ID.
- Scope choices come from the integration owner; selection calls B's `setScope`, discarding old run/preview. Allowed scope and actual manifest are labelled separately. Source links call the owner's existing navigation callback.
- Formal changes always go through `previewWrite` then `confirmWrite(previewId, operationId)`. A failed/uncertain confirmation retains the operation ID for safe retry. Editing a candidate discards its preview. Action creation explicitly does **not** set next step. No unsupported next-step command is fabricated.
- Filling an editor uses B's preview validation too, to reject stale source/target revisions, then separately checks the live editor revision and applies only an exact matching target. Therefore B must permit a validated preview for draft filling; no formal write runs on fill.
- Remove the old `AiStartHelpPanel` entry only when enabling the common host, under the integration owner's migration decision. This branch does not alter old confirmation semantics or AppShell.

## Synthetic harness and verification

`createFakeAssistantAdapter` is an explicit in-memory UI test adapter, not a production fallback or persistence implementation. It accepts only three synthetic object IDs, has no fetch/filesystem/provider access, never stores credentials, and states that reload clears its memory. Its tiny UI fixture is separate from the parent's application/database journey seeder; it does not duplicate the parent's two-record/15-minute scope assertions. Use the parent `seedAssistantJourney` for integrated Main/SQLite journeys.

```sh
npx vitest run --project unit tests/unit/assistant-renderer.test.ts
npx tsc -p tsconfig.web.json --pretty false
npx tsc -p tsconfig.test.json --composite false --incremental false --pretty false
MYTRACER_TEST_CHROMIUM=/usr/bin/chromium npx playwright test --config tests/renderer/assistant.playwright.config.ts
```

Local Linux verification: 9 unit tests and 2 Chromium tests passed, including late responses, temporary cleanup, revision races, preview/confirmation separation, idempotent retry, focus restoration, draft preservation, settings capability wording and 420px width/800px height bounds. Focused lint and format/diff checks passed. Chromium screenshots are generated under `.tmp/assistant-browser-results/`; no real data or credentials were used.

Normal composite `npm run typecheck` remains pending the owner include additions and integration of A/B contract files. Windows Electron/Mica/C1 appearance, real preload/Main APIs, restart persistence, installation drain, and actual model quality are not certified by this renderer harness. No real service request, main merge or release was performed.

## Real B alignment follow-up

Aligned against B `819b123` / `ee7af91` without changing or duplicating DTOs:

- Editor snapshot text remains local; `AssistantEntryButton` converts changes to a fresh short UUID revision token (B caps this field at 128 characters). Empty or over-12,000-character entry text is explicitly disabled. Candidate field limits follow B's payload validator.
- Turn progress is read while the final-result `sendTurn` promise is pending. Poll results are epoch- and completion-guarded and cannot overwrite a later final response.
- Cancellation awaits cancel settlement and refreshes the authoritative session before allowing further work. Sending also reads the latest session revision. Successful confirmation refreshes both session and run; sibling candidates reflect B's stale state. A failed refresh after a successful command is labelled as saved with refresh failure, not a failed write.
- `controller.createNew(launch, mode)` is separate from `open`/resume. The New conversation control never silently resumes an existing goal conversation. Temporary sessions are excluded from the local-history list.
- The fake adapter now increments revisions at turn start and completion and invalidates sibling candidates after confirmation, matching the relevant B behavior. It also rejects review previews, matching B's current unsupported path.

**Review draft is currently blocked, not delivered as a working integrated flow.** At B `ee7af91`, `createSession` requires `entry.object` to exist in projected persistent objects; an active review context ID is not a persisted review ID. Separately, `previewWrite` rejects review-draft before source validation. C therefore hides formal review-save controls and displays an explicit source-validation-unavailable status if draft fill is attempted. It does not catch unsupported and blindly copy the candidate.

B/parent must provide a validated read-only review draft preview (or a concrete validation port), including current selected-fact source revisions and the live review-context target. Keep formal review confirmation unsupported so the original review complete command remains the only save path. Once that capability is implemented, the existing C fill path applies the three returned fields after its live editor-token check; add the integrated real-B preview→fill test then. This is a pending API capability, not a permissions denial.

Follow-up verification: 15 unit tests and 2 Chromium tests passed, including cancel→scope/send, confirm→send/authoritative sibling stale, explicit-new vs resume, pending-step visibility, long editor text with bounded version token, and underlying pane scroll equality after close. Renderer/test type checks and focused lint passed as described above. No real provider or data was used.
