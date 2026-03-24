

## Fix post-login redirect

The login page (`src/pages/Auth.tsx`) redirects to `/admin/overview` which no longer exists.

### Changes

**`src/pages/Auth.tsx`**
- Line 30: Change `navigate('/admin/overview')` to `navigate('/alle-syn')` (the useEffect redirect when already logged in)
- Line 39: Change `navigate('/admin/overview')` to `navigate('/alle-syn')` (the redirect after successful sign-in)

Two lines, one file.

