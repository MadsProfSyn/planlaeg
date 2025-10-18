-- Allow authenticated users to insert inspection records
CREATE POLICY "Authenticated users can create inspections" 
ON public.inspection_queue
FOR INSERT 
TO authenticated
WITH CHECK (true);