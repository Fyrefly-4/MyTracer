CREATE TABLE metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'ended')),
  current_next_action_id TEXT REFERENCES actions(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE actions (
  id TEXT PRIMARY KEY,
  goal_id TEXT REFERENCES goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'cancelled', 'rescheduled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE routines (
  id TEXT PRIMARY KEY,
  goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  minimum_action TEXT NOT NULL CHECK (length(trim(minimum_action)) > 0),
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'ended')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE routine_schedule_days (
  routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  PRIMARY KEY (routine_id, weekday)
);

CREATE TABLE today_selections (
  action_id TEXT NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  selected_for TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('focus', 'intention')),
  selected_by TEXT NOT NULL CHECK (selected_by = 'user'),
  created_at TEXT NOT NULL,
  PRIMARY KEY (action_id, selected_for)
);

CREATE TABLE action_records (
  id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  occurred_on TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 0),
  outcome TEXT NOT NULL CHECK (outcome IN ('completed', 'partial', 'stopped')),
  next_step TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE routine_records (
  id TEXT PRIMARY KEY,
  routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  occurred_on TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('target_met', 'acted', 'intentional_rest', 'not_done')),
  planned_for_date INTEGER NOT NULL CHECK (planned_for_date IN (0, 1)),
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (routine_id, occurred_on)
);

CREATE TABLE understandings (
  id TEXT PRIMARY KEY,
  action_record_id TEXT NOT NULL REFERENCES action_records(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (length(trim(text)) > 0),
  source TEXT NOT NULL CHECK (source IN ('manual', 'ai_candidate_confirmed')),
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE confusions (
  id TEXT PRIMARY KEY,
  action_record_id TEXT NOT NULL REFERENCES action_records(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (length(trim(text)) > 0),
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
  resolved_at TEXT,
  resolution TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE review_results (
  id TEXT PRIMARY KEY,
  period_started_on TEXT NOT NULL,
  summary TEXT NOT NULL CHECK (length(trim(summary)) > 0),
  adjustment TEXT NOT NULL CHECK (length(trim(adjustment)) > 0),
  next_focus TEXT NOT NULL CHECK (length(trim(next_focus)) > 0),
  goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX actions_by_goal_id ON actions(goal_id);
CREATE INDEX routines_by_goal_id ON routines(goal_id);
CREATE INDEX action_records_by_action_id_occurred_on ON action_records(action_id, occurred_on);
CREATE INDEX routine_records_by_routine_id_occurred_on ON routine_records(routine_id, occurred_on);
CREATE INDEX understandings_by_action_record_id ON understandings(action_record_id);
CREATE INDEX confusions_by_action_record_id ON confusions(action_record_id);
CREATE INDEX review_results_by_goal_id ON review_results(goal_id);
