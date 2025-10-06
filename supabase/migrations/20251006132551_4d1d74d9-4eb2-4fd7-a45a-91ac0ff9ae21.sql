-- Enable RLS on inspection_queue and vrp_runs
ALTER TABLE inspection_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE vrp_runs ENABLE ROW LEVEL SECURITY;