import { createClient } from 'npm:@supabase/supabase-js@2';

// 2026-10-09: Nye brugere oprettes via invitation. Brugeren får en mail med et link og vælger selv sit kodeord.
// Kun for administratorer. Handlinger:
//   { email, full_name, redirect_to }          → send invitation til en ny bruger
//   { action: 'resend', user_id, redirect_to } → send invitationen igen til en bruger, der ikke er kommet i gang
//   { action: 'status' }                       → brugere, der endnu ikke har logget ind / valgt kodeord
// Forventede fejl returneres med status 200 og { error }, så teksten kan vises direkte i appen.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Kun https-adresser sendes videre. Supabase Auth afviser selv adresser, der ikke er godkendt,
// og bruger så projektets Site URL i stedet.
function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const callerId = claimsData.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify caller has admin role
    const { data: isAdmin, error: roleError } = await admin.rpc('has_role', {
      _user_id: callerId,
      _role: 'admin',
    });
    if (roleError || !isAdmin) {
      return json({ error: 'Forbidden: admin role required' }, 403);
    }

    const body = (await req.json().catch(() => null)) ?? {};
    const action = typeof body.action === 'string' ? body.action : 'invite';
    const redirectTo = safeRedirect(body.redirect_to);

    // ── Status: hvem er ikke kommet i gang endnu ──────────────────────────────
    if (action === 'status') {
      const pending: Array<{ id: string; email: string | undefined; invited_at: string | null }> = [];
      let page = 1;
      while (true) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) return json({ error: error.message });
        for (const u of data.users) {
          if (!u.last_sign_in_at || u.user_metadata?.needs_password === true) {
            pending.push({ id: u.id, email: u.email, invited_at: u.invited_at ?? null });
          }
        }
        if (data.users.length < 200) break;
        page++;
      }
      return json({ pending });
    }

    // ── Send invitationen igen ────────────────────────────────────────────────
    if (action === 'resend') {
      const userId = typeof body.user_id === 'string' ? body.user_id : '';
      if (!userId) return json({ error: 'Mangler bruger' });

      const { data: found, error: findError } = await admin.auth.admin.getUserById(userId);
      const target = found?.user;
      if (findError || !target?.email) return json({ error: 'Brugeren blev ikke fundet' });

      const metadata = { ...(target.user_metadata ?? {}), needs_password: true };

      if (!target.email_confirmed_at) {
        // Har ikke åbnet invitationen endnu → ny invitationsmail
        const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(target.email, {
          data: metadata,
          redirectTo,
        });
        if (inviteError) return json({ error: inviteError.message });
        return json({ success: true, kind: 'invite', email: target.email });
      }

      // Har allerede bekræftet sin mail (fx åbnet linket uden at vælge kodeord) → mail med link til at vælge kodeord
      const { error: updateError } = await admin.auth.admin.updateUserById(target.id, { user_metadata: metadata });
      if (updateError) return json({ error: updateError.message });
      const { error: recoveryError } = await admin.auth.resetPasswordForEmail(target.email, { redirectTo });
      if (recoveryError) return json({ error: recoveryError.message });
      return json({ success: true, kind: 'recovery', email: target.email });
    }

    // ── Ny bruger: send invitation ───────────────────────────────────────────
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const full_name = typeof body.full_name === 'string' ? body.full_name.trim() : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Ugyldig email' });
    }

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name, needs_password: true },
      redirectTo,
    });

    if (inviteError) {
      const exists = (inviteError as { code?: string }).code === 'email_exists' ||
        /already been registered/i.test(inviteError.message);
      if (exists) {
        return json({
          error: 'Der findes allerede en bruger med denne email. Er brugeren ikke kommet i gang, så brug "Send invitation igen" i listen.',
        });
      }
      return json({ error: `Invitationen kunne ikke sendes: ${inviteError.message}` });
    }

    return json({ success: true, user: { id: invited.user?.id, email: invited.user?.email } });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
