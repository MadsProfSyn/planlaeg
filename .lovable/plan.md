## Simple Admin User Creation (No Email Confirmation)

### Problem

The current "Opret bruger" flow on `/admin/users` calls `supabase.auth.signUp()`, which:
- Triggers a confirmation email (and is currently failing — see auth logs: `554 Email address is not verified`)
- Requires the user to click a link before they can log in
- Signs the admin out / swaps their session in some flows

For an internal team app this is unnecessary friction.

### Solution

Create users via a new admin-only edge function that uses the Supabase Admin API (`auth.admin.createUser`) with `email_confirm: true`. The user is immediately usable — no email sent, no confirmation step.

### Changes

**1. New edge function `supabase/functions/admin-create-user/index.ts`**
- Verifies the caller is authenticated and has the `admin` role (via `has_role`)
- Accepts `{ email, password, full_name }`
- Calls `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })` using the service role key
- The existing `handle_new_user` trigger automatically creates the profile + default `user` role
- Returns the new user id / email or a clean error

**2. `src/pages/admin/Users.tsx`**
- Replace the `supabase.auth.signUp(...)` call in `handleCreateUser` with `supabase.functions.invoke('admin-create-user', { body: { email, password, full_name } })`
- Update the toast to "Bruger oprettet og kan logge ind med det samme"
- Keep the rest of the form / dialog UI unchanged

**3. `supabase/config.toml`**
- Register the new function (no JWT verification disabled — we want the caller's JWT so we can check their admin role)

### Files modified

| File | Change |
|------|--------|
| `supabase/functions/admin-create-user/index.ts` | New — admin-guarded user creation via service role, `email_confirm: true` |
| `supabase/config.toml` | Register `admin-create-user` function |
| `src/pages/admin/Users.tsx` | Call new edge function instead of `auth.signUp`; updated success toast |

### Notes

- No database migration needed — `handle_new_user` already populates `profiles` and `user_roles` on auth user insert.
- Email sending stays untouched; this flow simply bypasses it.
