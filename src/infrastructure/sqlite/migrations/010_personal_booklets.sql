CREATE TABLE booklets (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, note TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision > 0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE booklet_entries (
 id TEXT PRIMARY KEY,
 booklet_id TEXT NOT NULL REFERENCES booklets(id) ON DELETE CASCADE,
 position INTEGER NOT NULL CHECK(position >= 0),
 kind TEXT NOT NULL CHECK(kind IN ('action-record', 'thought')),
 action_record_id TEXT REFERENCES action_records(id) ON DELETE SET NULL,
 thought_id TEXT REFERENCES thoughts(id) ON DELETE SET NULL,
 CHECK((kind = 'action-record' AND thought_id IS NULL) OR (kind = 'thought' AND action_record_id IS NULL)),
 UNIQUE(booklet_id, position), UNIQUE(booklet_id, action_record_id), UNIQUE(booklet_id, thought_id)
);
CREATE INDEX booklet_entries_action ON booklet_entries(action_record_id);
CREATE INDEX booklet_entries_thought ON booklet_entries(thought_id);
-- Invalidate stale edits even when a source disappears through an action/goal cascade.
CREATE TRIGGER booklet_source_deleted AFTER UPDATE OF action_record_id, thought_id ON booklet_entries
WHEN (OLD.action_record_id IS NOT NULL AND NEW.action_record_id IS NULL)
  OR (OLD.thought_id IS NOT NULL AND NEW.thought_id IS NULL)
BEGIN
 UPDATE booklets SET revision = revision + 1 WHERE id = NEW.booklet_id;
END;
