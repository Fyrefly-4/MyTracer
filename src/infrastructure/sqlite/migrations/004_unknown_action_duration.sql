-- Preserve linked history while the existing FK cascade removes the old parent table.
CREATE TEMP TABLE duration_migration_understandings AS SELECT * FROM understandings;
CREATE TEMP TABLE duration_migration_confusions AS SELECT * FROM confusions;

CREATE TABLE action_records_v4 (
  id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  occurred_on TEXT NOT NULL,
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  outcome TEXT NOT NULL CHECK (outcome IN ('completed', 'partial', 'stopped')),
  next_step TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO action_records_v4 SELECT * FROM action_records;
DROP TABLE action_records;
ALTER TABLE action_records_v4 RENAME TO action_records;
CREATE INDEX action_records_by_action_id_occurred_on ON action_records(action_id, occurred_on);
INSERT INTO understandings SELECT * FROM duration_migration_understandings;
INSERT INTO confusions SELECT * FROM duration_migration_confusions;
DROP TABLE duration_migration_understandings;
DROP TABLE duration_migration_confusions;
