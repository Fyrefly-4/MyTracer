ALTER TABLE goals ADD COLUMN predecessor_goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL CHECK (predecessor_goal_id IS NULL OR predecessor_goal_id <> id);
CREATE INDEX goals_predecessor ON goals(predecessor_goal_id);
CREATE TRIGGER goal_stage_insert BEFORE INSERT ON goals
WHEN NEW.predecessor_goal_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Stage predecessor must exist and be ended')
  WHERE NOT EXISTS (SELECT 1 FROM goals WHERE id = NEW.predecessor_goal_id AND status = 'ended');
END;
CREATE TRIGGER goal_stage_immutable BEFORE UPDATE OF predecessor_goal_id ON goals
WHEN NEW.predecessor_goal_id IS NOT NULL AND NEW.predecessor_goal_id IS NOT OLD.predecessor_goal_id
BEGIN
  SELECT RAISE(ABORT, 'Stage relation cannot be reassigned');
END;
CREATE TRIGGER goal_stage_ended BEFORE UPDATE OF status ON goals
WHEN NEW.status <> 'ended' AND EXISTS (SELECT 1 FROM goals WHERE predecessor_goal_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'Stage predecessor must remain ended');
END;
