import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: 'Unauthorized' }, 401);
    const callerId = claimsData.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin, error: roleError } = await admin.rpc('has_role', {
      _user_id: callerId,
      _role: 'admin',
    });
    if (roleError || !isAdmin) return json({ error: 'Forbidden: admin role required' }, 403);

    const body = await req.json().catch(() => null);
    const userId = typeof body?.user_id === 'string' ? body.user_id : '';
    if (!userId) return json({ error: 'Mangler bruger-id' }, 400);
    if (userId === callerId) return json({ error: 'Du kan ikke slette dig selv' }, 400);

    // Clear references that would block deletion
    await admin.from('proposed_assignments').update({ manual_override_by: null }).eq('manual_override_by', userId);
    await admin.from('inspection_queue').update({ planned_by: null }).eq('planned_by', userId);
    await admin.from('user_roles').update({ granted_by: null }).eq('granted_by', userId);
    await admin.from('user_roles').delete().eq('user_id', userId);
    await admin.from('profiles').delete().eq('id', userId);

    const { error: delError } = await admin.auth.admin.deleteUser(userId);
    if (delError) return json({ error: delError.message }, 400);

    return json({ success: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
