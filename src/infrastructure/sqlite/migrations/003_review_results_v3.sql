CREATE TABLE review_results_v3 (
  id TEXT PRIMARY KEY,
  period_started_on TEXT NOT NULL,
  confirmed_progress TEXT NOT NULL CHECK (length(trim(confirmed_progress)) > 0),
  main_obstacle TEXT NOT NULL CHECK (length(trim(main_obstacle)) > 0),
  next_adjustment TEXT NOT NULL CHECK (length(trim(next_adjustment)) > 0),
  goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO review_results_v3 (
  id,
  period_started_on,
  confirmed_progress,
  main_obstacle,
  next_adjustment,
  goal_id,
  created_at,
  updated_at
)
SELECT
  id,
  period_started_on,
  summary,
  adjustment,
  next_focus,
  goal_id,
  created_at,
  updated_at
FROM review_results;

DROP TABLE review_results;
ALTER TABLE review_results_v3 RENAME TO review_results;

CREATE INDEX review_results_by_goal_id ON review_results(goal_id);
CREATE UNIQUE INDEX review_results_by_period_started_on ON review_results(period_started_on);
