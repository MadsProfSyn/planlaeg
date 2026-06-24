## Add page padding to /admin/account and /admin/users

Both pages render directly inside `AppLayout`'s `<main>` with no padding wrapper, so content sits flush against the sidebar/edge. Other pages (e.g. AlleSyn, Inspectors) wrap their root in `p-4 md:p-6` (or `container mx-auto py-6`) to match platform spacing.

### Changes

**`src/pages/admin/Users.tsx`**
- Change root wrapper from `<div className="space-y-6">` to `<div className="flex flex-col gap-6 p-4 md:p-6">` so the "Brugere" header and table get the same edge padding as the rest of the app.

**`src/pages/admin/Account.tsx`**
- Change root wrapper from `<div className="space-y-8 max-w-2xl">` to `<div className="flex flex-col gap-8 p-4 md:p-6 max-w-3xl">` for matching padding and breathing room around the "Min konto" header and cards.

No layout, routing, or business logic changes — purely presentation padding to align with the rest of the platform.