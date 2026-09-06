## Plan

Opret en ny admin-bruger: **august@profsyn.dk** med den valgte adgangskode, så August kan logge ind med det samme — uden e-mailbekræftelse.

## Trin

1. Mint en admin-session for en eksisterende admin-bruger (via `lovable auth-session --json --user <uuid>`), så jeg kan kalde den eksisterende `admin-create-user` edge function, som kræver et admin-login.
2. Kald `admin-create-user` med:
   - email: `august@profsyn.dk`
   - password: den angivne adgangskode
   - `email_confirm: true` er indbygget i funktionen — ingen e-mailflow.
   - Funktionen opretter også automatisk en række i `profiles` via den eksisterende `handle_new_user`-trigger.
3. Giv admin-rolle: kør `select public.promote_user('august@profsyn.dk')` (eksisterende security-definer-funktion, der indsætter i `user_roles`).
4. Bekræft resultatet: verificér at brugeren findes i `auth.users` og har `admin`-rollen i `user_roles`.

## Ingen kodeændringer

Alt genbruger eksisterende funktioner (`admin-create-user`, `promote_user`). Ingen ændringer i appen eller databasens struktur.
