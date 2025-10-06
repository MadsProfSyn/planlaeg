-- Enable pg_trgm extension for partial text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN trigram indexes on searchable columns in monday_items_selected
-- Note: Column names are case-sensitive and must be quoted
CREATE INDEX IF NOT EXISTS idx_monday_items_kunde_trgm 
  ON public.monday_items_selected USING gin ("Kunde" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_monday_items_lejemalsnr_trgm 
  ON public.monday_items_selected USING gin (lejemalsnr gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_monday_items_adresse_trgm 
  ON public.monday_items_selected USING gin (adresse gin_trgm_ops);