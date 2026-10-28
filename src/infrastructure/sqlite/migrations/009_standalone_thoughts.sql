CREATE TABLE thoughts (
  id TEXT PRIMARY KEY NOT NULL,
  occurred_on TEXT NOT NULL CHECK(length(occurred_on) = 10),
  text TEXT NOT NULL CHECK(length(trim(text)) > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX thoughts_by_date ON thoughts(occurred_on, created_at, id);
