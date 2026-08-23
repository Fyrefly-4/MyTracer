ALTER TABLE routine_records
ADD COLUMN planned_for_date_basis TEXT NOT NULL DEFAULT 'schedule_at_recording'
CHECK (planned_for_date_basis IN ('schedule_at_recording', 'user_confirmed_history'));
