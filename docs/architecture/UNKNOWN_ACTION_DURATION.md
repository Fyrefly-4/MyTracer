# Unknown action duration (#129)

Approved scenario: a person knows they acted, but cannot or does not want to estimate minutes. An explicit `durationMinutes: null` records that fact. Zero still means actual activity under one minute; existing numeric records are never reinterpreted. Missing/undefined action duration remains invalid at the command boundary.

Scope: normal recording, dated backfill, edits, all read paths, progress/week/review facts, existing AI context and complete export. Known minute totals are accompanied by unknown-duration counts among real action facts (actions plus acted/target_met routines). Rest/not_done routines remain excluded. No estimation, date uncertainty, new dependencies, provider/permission changes or #125 quick-entry work.

## Migration and compatibility plan (recorded before applying)

Schema 3 → 4 uses the existing migration transaction. Create a replacement action_records table with nullable non-negative duration; copy every column verbatim. Temporarily copy understandings/confusions into transaction-local backup tables before dropping the old action table (its existing FK cascade removes dependent rows); rename the replacement, recreate its index, and restore the exact child rows including revoked/resolved history. Drop backups, verify foreign keys, and advance metadata only within the same transaction. Foreign-key enforcement stays enabled. Any error rolls everything back. Routine tables are untouched. No user profile is used for development or tests.

Old apps reject schema 4 via the existing forward-version guard. There is no lossy downgrade; returning to an old app requires a pre-upgrade backup. No automatic restore/import is added.

New exports use format version 3 and source schema ≥4. Only v3 permits null action duration. Readers continue validating v1/v2 with their original numeric-duration and review contracts. Existing export files are never rewritten; external consumers must explicitly support v3 before consuming it. Candidate metadata declares schema 4/export 3; provenance validation also retains the historical schema 3/export 2 pair and rejects mixed pairs. No release is performed. Nullable AI context carries null unchanged, with an explicit instruction that it is unknown, not zero; no added context or provider.

## Acceptance

- Numeric values and old zero rows survive migration unchanged, including all linked historical text and indexes; failure rolls back.
- Create/backfill/read/edit support null and transitions in both directions; invalid/missing duration still fails.
- Unknown action facts retain their counts and outcome/date semantics; mixed/all-unknown/empty totals communicate coverage. Week comparisons expose coverage in both periods and never claim actual effort decreased.
- Export v3 preserves null/zero; old versions remain valid and reject null action durations.
- UI shows “时长未记录”, distinguishes zero, and retains drafts/focus. Existing Today panel and data drawer/editor own surface, padding and scroll; no new wrapper, global styling or layout ownership changes (#131).
- Focused automated tests plus repository checks; Windows/manual results remain separate from Linux evidence.

#125 can reuse the nullable command/DTO/persistence/export contracts and coverage-aware aggregates in a separate PR. It is not implemented here.
