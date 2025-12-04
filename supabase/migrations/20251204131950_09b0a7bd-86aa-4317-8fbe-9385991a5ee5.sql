-- Create SMS reminder logs table to track all SMS sends
CREATE TABLE sms_reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  inspector_id UUID NOT NULL,
  inspector_name TEXT NOT NULL,
  phone TEXT,
  target_date DATE NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  sent_by UUID,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  failure_reason TEXT,
  message_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_sms_logs_target_date ON sms_reminder_logs(target_date);
CREATE INDEX idx_sms_logs_batch_id ON sms_reminder_logs(batch_id);
CREATE INDEX idx_sms_logs_inspector_id ON sms_reminder_logs(inspector_id);
CREATE INDEX idx_sms_logs_sent_at ON sms_reminder_logs(sent_at DESC);

-- RLS policies
ALTER TABLE sms_reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view SMS logs" 
  ON sms_reminder_logs FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert SMS logs" 
  ON sms_reminder_logs FOR INSERT WITH CHECK (true);