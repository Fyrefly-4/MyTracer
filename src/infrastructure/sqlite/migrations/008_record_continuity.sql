-- Private encrypted input and content-free receipts; deliberately excluded from core export.
-- A completed/discarded operation remains a tombstone against delayed writes and retries.
CREATE TABLE record_continuity (
 operation_id TEXT PRIMARY KEY,
 state TEXT NOT NULL CHECK (state IN ('open', 'saved', 'discarded')),
 revision INTEGER NOT NULL,
 payload TEXT
);
