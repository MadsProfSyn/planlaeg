-- Create the supabase_inspections table
CREATE TABLE public.supabase_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Proforma', 'Projektsyn', 'Indflytningssyn', 'Fraflytningssyn')),
  date_local DATE NOT NULL,
  department TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNSCHEDULED' CHECK (status IN ('UNSCHEDULED', 'SCHEDULED', 'CANCELLED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create the supabase_availability table
CREATE TABLE public.supabase_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspector_id UUID NOT NULL,
  inspector_name TEXT NOT NULL,
  date_local DATE NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  source TEXT DEFAULT 'workfeed',
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  raw_payload JSONB,
  UNIQUE(inspector_id, date_local)
);

-- Create the supabase_shifts table
CREATE TABLE public.supabase_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID REFERENCES public.supabase_inspections(id),
  inspector_id UUID NOT NULL,
  inspector_name TEXT NOT NULL,
  date_local DATE NOT NULL,
  department TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ASSIGNED' CHECK (status IN ('ASSIGNED', 'DONE', 'CANCELLED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create the inspections_vrp table
CREATE TABLE public.inspections_vrp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  inspection_id UUID REFERENCES public.supabase_inspections(id),
  inspector_id UUID NOT NULL,
  inspector_name TEXT NOT NULL,
  score DECIMAL(10,4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance optimization
CREATE INDEX idx_inspections_status_dept_date ON public.supabase_inspections(status, department, date_local);
CREATE INDEX idx_inspections_date_local ON public.supabase_inspections(date_local);
CREATE INDEX idx_inspections_department ON public.supabase_inspections(department);

CREATE INDEX idx_availability_inspector_date ON public.supabase_availability(inspector_id, date_local);
CREATE INDEX idx_availability_date_available ON public.supabase_availability(date_local, is_available);

CREATE INDEX idx_shifts_inspection_inspector ON public.supabase_shifts(inspection_id, inspector_id);

CREATE INDEX idx_vrp_run_score ON public.inspections_vrp(run_id, score DESC);

-- Enable Row Level Security
ALTER TABLE public.supabase_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supabase_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supabase_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections_vrp ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for supabase_inspections
CREATE POLICY "Public read access for inspections" ON public.supabase_inspections
  FOR SELECT USING (true);

CREATE POLICY "Public update access for inspections" ON public.supabase_inspections
  FOR UPDATE USING (true);

-- Create RLS policies for supabase_availability
CREATE POLICY "Public read access for availability" ON public.supabase_availability
  FOR SELECT USING (true);

-- Create RLS policies for supabase_shifts
CREATE POLICY "Public read access for shifts" ON public.supabase_shifts
  FOR SELECT USING (true);

-- Create RLS policies for inspections_vrp
CREATE POLICY "Public read access for VRP" ON public.inspections_vrp
  FOR SELECT USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_inspections_updated_at
BEFORE UPDATE ON public.supabase_inspections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create stub function for future WorkFeed integration
CREATE OR REPLACE FUNCTION public.sync_workfeed_availability_stub()
RETURNS void AS $$
BEGIN
  -- No-op stub function for future WorkFeed cron integration
  RAISE NOTICE 'sync_workfeed_availability_stub called - to be implemented';
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Insert seed data for testing
INSERT INTO public.supabase_inspections (address, type, date_local, department, status) VALUES
('Vesterbrogade 1, 1620 København V', 'Indflytningssyn', '2024-01-15', 'København V', 'UNSCHEDULED'),
('Nørrebrogade 25, 2200 København N', 'Fraflytningssyn', '2024-01-16', 'København N', 'UNSCHEDULED'),
('Amagerbrogade 45, 2300 København S', 'Projektsyn', '2024-01-17', 'København S', 'UNSCHEDULED'),
('Frederiksberg Allé 12, 1820 Frederiksberg C', 'Proforma', '2024-01-18', 'Frederiksberg', 'UNSCHEDULED'),
('Østerbrogade 78, 2100 København Ø', 'Indflytningssyn', '2024-01-19', 'København Ø', 'UNSCHEDULED'),
('Gammel Kongevej 34, 1610 København V', 'Fraflytningssyn', '2024-01-20', 'København V', 'UNSCHEDULED'),
('Sankt Hans Gade 56, 2200 København N', 'Projektsyn', '2024-01-21', 'København N', 'UNSCHEDULED'),
('Amagerbrogade 123, 2300 København S', 'Proforma', '2024-01-22', 'København S', 'UNSCHEDULED'),
('Falkoner Alle 89, 2000 Frederiksberg', 'Indflytningssyn', '2024-01-23', 'Frederiksberg', 'UNSCHEDULED'),
('Trianglen 15, 2100 København Ø', 'Fraflytningssyn', '2024-01-24', 'København Ø', 'UNSCHEDULED'),
('Vesterbrogade 67, 1620 København V', 'Projektsyn', '2024-01-25', 'København V', 'UNSCHEDULED'),
('Nørrebrogade 145, 2200 København N', 'Proforma', '2024-01-26', 'København N', 'UNSCHEDULED'),
('Islands Brygge 23, 2300 København S', 'Indflytningssyn', '2024-01-27', 'København S', 'UNSCHEDULED'),
('Frederiksberg Runddel 8, 2000 Frederiksberg', 'Fraflytningssyn', '2024-01-28', 'Frederiksberg', 'UNSCHEDULED'),
('Østerbrogade 234, 2100 København Ø', 'Projektsyn', '2024-01-29', 'København Ø', 'UNSCHEDULED');