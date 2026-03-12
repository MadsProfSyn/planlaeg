

## Fix: Password Reset Flow

### Problem
When a user clicks the reset link in their email, Supabase fires a `PASSWORD_RECOVERY` event via `onAuthStateChange`, which sets a valid session. The current `AuthContext` treats all sessions the same, so `Auth.tsx` sees `user` is set and redirects to `/admin/overview` — skipping the password reset form entirely.

### Plan

**1. Create `/reset-password` page** (`src/pages/ResetPassword.tsx`)
- Form with "New password" and "Confirm password" fields
- Password validation: min 6 chars, must match
- Calls `supabase.auth.updateUser({ password })` on submit
- On success: show toast, redirect to `/` (login)
- On error: show appropriate error message
- If no valid recovery session detected (no `PASSWORD_RECOVERY` event received), show an error state

**2. Update `AuthContext.tsx`**
- Track `isPasswordRecovery` boolean state
- In `onAuthStateChange`, when `event === 'PASSWORD_RECOVERY'`, set `isPasswordRecovery = true` and do NOT fetch user data / set user as normally authenticated
- Expose `isPasswordRecovery` and a `clearPasswordRecovery()` function in context
- This prevents `ProtectedRoute` from treating recovery sessions as normal logins

**3. Update `Auth.tsx`**
- When `isPasswordRecovery` is true, redirect to `/reset-password` instead of `/admin/overview`

**4. Update `App.tsx`**
- Add route: `<Route path="/reset-password" element={<ResetPassword />} />`
- This route is NOT wrapped in `ProtectedRoute` — it's public (the recovery session is already established by Supabase)

**5. Update Supabase redirect URL**
- The existing `resetPassword` function in AuthContext already sets `redirectTo: window.location.origin + '/'`
- This is correct — Supabase will redirect to the app root where `onAuthStateChange` fires `PASSWORD_RECOVERY`, and the context will redirect to `/reset-password`

### Files Changed
- `src/contexts/AuthContext.tsx` — add `isPasswordRecovery` state + detection
- `src/pages/Auth.tsx` — redirect to `/reset-password` when recovery detected
- `src/pages/ResetPassword.tsx` — new page with password update form
- `src/App.tsx` — add `/reset-password` route

### Supabase Dashboard Config
The user should ensure `https://planlaeg.lovable.app` is set as the Site URL in Supabase Auth settings (per existing memory). No other redirect URL changes needed.

