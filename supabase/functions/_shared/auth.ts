// Fælles adgangskontrol for backend-funktionerne (2026-10-12).
// Tilladt:
//   1) interne kald med service role-nøglen (cron-funktioner og funktion-til-funktion)
//   2) brugere, der er logget ind OG har en rolle i user_roles (dvs. er inviteret)
// Alle andre (også kald med den offentlige anon-nøgle) afvises.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function deny(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Returnerer null, hvis kaldet er tilladt – ellers et færdigt fejlsvar, som funktionen skal returnere.
export async function requireStaff(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return deny(401, 'Log ind for at bruge denne funktion');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Internt kald (cron eller en anden funktion)
  if (token === SERVICE_KEY) return null;

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getClaims(token);
  const claims = data?.claims as Record<string, unknown> | undefined;
  if (error || !claims) return deny(401, 'Log ind for at bruge denne funktion');
  if (claims.role === 'service_role') return null;

  const userId = typeof claims.sub === 'string' ? claims.sub : '';
  if (!userId) return deny(401, 'Log ind for at bruge denne funktion');

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: roles, error: roleError } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .limit(1);
  if (roleError) return deny(500, 'Kunne ikke tjekke adgang');
  if (!roles || roles.length === 0) return deny(403, 'Du har ikke adgang');
  return null;
}
