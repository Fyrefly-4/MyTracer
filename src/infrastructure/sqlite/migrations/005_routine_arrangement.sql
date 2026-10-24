ALTER TABLE routines ADD COLUMN arrangement_mode TEXT NOT NULL DEFAULT 'weekly' CHECK (arrangement_mode IN ('weekly', 'unscheduled'));
