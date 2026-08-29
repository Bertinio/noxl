# Wachtwoord resetten in NoXL

## Doel
Installateurs kunnen zelf hun wachtwoord opnieuw instellen — zowel vanaf het inlogscherm (vergeten) als ingelogd (wijzigen).

## 1. "Wachtwoord vergeten" op /auth
- Link "Wachtwoord vergeten?" onder het inlogformulier op `src/routes/auth.tsx`.
- Opent een formulier voor e-mailadres → `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`.
- Toon bevestiging: "Controleer je e-mail voor de resetlink".

## 2. Nieuwe publieke route /reset-password
- Nieuw bestand `src/routes/reset-password.tsx` (publiek, niet achter auth).
- Controleert op `type=recovery` in de URL-hash (sessie uit de resetlink).
- Formulier: nieuw wachtwoord + bevestiging → `supabase.auth.updateUser({ password })` (zonder `current_password`; recovery-sessies zijn daarvan vrijgesteld).
- Na succes: toast + doorgestuurd naar het dashboard.

## 3. Wachtwoord wijzigen in Instellingen (ingelogd)
- Nieuwe sectie "Wachtwoord wijzigen" in `src/routes/_authenticated/instellingen.tsx`.
- Velden: huidig wachtwoord, nieuw wachtwoord, bevestiging.
- Aanroep: `supabase.auth.updateUser({ password, current_password })` — Lovable Cloud vereist het huidige wachtwoord bij ingelogde wijziging.

## Technische details
- Bestaande Supabase-auth; geen nieuwe tabellen of RLS-wijzigingen.
- `/reset-password` is een publieke top-level route (SSR), zoals vereist voor de recovery-flow.
- Bestaande admin-resetlink in Beheer → Installateurs blijft ongewijzigd werken.
