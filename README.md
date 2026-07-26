# NoXL — Offerte-applicatie voor installateurs

Web-app waarmee installateurs (ramen & rolluiken) klanten beheren, projecten configureren op basis van
breedte × hoogte × prijs/m², offertes genereren en per e-mail bezorgen. Klanten kunnen hun eigen
projecten en offertes bekijken in een portaal.

## Architectuur

- **Frontend**: React 19 + TanStack Router/Start v1 + Vite 7 + Tailwind v4 + shadcn/ui
- **Data-laag**: TanStack Query (defaults `staleTime` 5 min, `gcTime` 30 min — zie `src/router.tsx`)
- **Backend**: Lovable Cloud (Supabase) — RLS, auth, Postgres
- **Server-logica**: `createServerFn` (`@tanstack/react-start`) — géén Supabase Edge Functions
- **Auth**: e-mail/wachtwoord + Google OAuth via Supabase Auth
- **E-mail**: Resend (transactioneel, met PDF-bijlage via `pdf-lib`)
- **Runtime**: Cloudflare Workers (edge)

Belangrijke mappen:

```
src/
  routes/                  file-based routes (TanStack)
    _authenticated/        alles achter auth-gate (managed layout)
      admin.tsx            beheerpaneel — has_role('admin')
      dashboard.tsx        klanten + projecten (installateur)
      products.tsx         productcatalogus
      project.$projectId.configurator.tsx
      projects.$id.*       projectdetail, offertes
      quotes.$id.print.tsx PDF/print-view
      portal.tsx           klantportaal
    auth.tsx               login/signup
  lib/
    noxl.functions.ts      alle server-functions (customers, projects,
                           products, configurations, quotes, admin)
    quote-email.server.ts  PDF + Resend versturen (server-only)
    quote-pdf.server.ts    PDF-generator met pdf-lib
    errors.ts              handleError() + one() Postgrest-join helper
  components/noxl/         AppShell (sidebar, admin-badge) etc.
  integrations/supabase/   auto-gegenereerd (niet aanpassen)
```

## Database schema (public)

- **customers** — `id, owner_id (→ installateur), auth_user_id (→ klant-portaal), name, email, company, address`
- **projects** — `id, customer_id, title, description, status, total_price`
- **products** — `id, owner_id, name, description, unit_price (per m²), category`
- **configurations** — `id, project_id, product_id, option_name, option_value, width_mm, height_mm,
  area_m2 (generated), quantity, unit_price, total_price`
- **project_quotes** — `id, project_id, quote_number, total_price, last_email_sent_at`
- **project_quote_items** — `id, quote_id, product_id, description, width_mm, height_mm,
  area_m2 (generated), quantity, unit_price, total_price`
- **user_roles** — `id, user_id, role (enum: admin | customer)` — **enige** bron van waarheid voor rollen
- **installer_settings**, **quotes**, **quote_items** — legacy uit eerdere iteratie

## Business rules

- **m²-berekening**: `area_m2 = (width_mm × height_mm) / 1.000.000` — generated column, database-side
- **Regel-totaal**: `total_price = area_m2 × unit_price × quantity`
- **Project-totaal**: som van alle configuratieregels, wordt server-side geschreven
- **Prijs per product**: `products.unit_price` = prijs **per m²**
- **Offertenummer**: `Q-<projectid8>-<timestamp>` (uniek per project_quote)
- **Automatische e-mail**: bij `generateQuote` wordt de offerte direct gemaild naar `customer.email`
  met PDF-bijlage; `resendQuoteEmail` gebruikt dezelfde helper en werkt `last_email_sent_at` bij
- **Rollen**: elke sign-up start zonder rol → default gedrag = klantportaal. Een admin moet
  expliciet worden toegewezen via `/admin` (of manueel in `user_roles`).

## Security model

- **RLS** is aan op alle publieke tabellen; policies zijn scoped op `auth.uid()`:
  - `customers`: alleen eigen rijen (`owner_id = auth.uid()`) — klant ziet eigen record via `auth_user_id`
  - `projects/configurations/*_quote_items`: transitief via `customers.owner_id`
  - `products`: `owner_id = auth.uid()`
  - `user_roles`: gebruikers lezen enkel hun eigen rollen
- **Rol-check**: `public.has_role(_user_id, _role)` — `SECURITY INVOKER`, `EXECUTE` alleen aan
  `authenticated` + `service_role`. Nooit `is_admin` kolom op `profiles` (privilege-escalation risk).
- **Server-functions**: alle beveiligde endpoints gebruiken `.middleware([requireSupabaseAuth])`;
  admin-endpoints roepen `requireAdmin()` aan die `has_role('admin')` verifieert vóór privileged writes.
- **`supabaseAdmin`** (service-role) wordt **alleen** gebruikt achter een geverifieerde admin-check
  (invite user, list users, role management) — nooit voor gewone lees-queries.
- **Error handling**: `handleError()` in `src/lib/errors.ts` logt server-side en retourneert een
  veilige gebruikersboodschap zonder interne details te lekken.

## Deploy

- **Preview / productie** draaien beide op Lovable's edge-runtime. Publiceren via de knop
  "Publish" in Lovable (of `<presentation-open-publish>`).
- Custom domain: `noxl.lovable.app` (published) — te configureren in Cloud settings.
- Backend-instellingen (auth providers, RLS, secrets) beheer je via **View Backend** in Lovable.

## GitHub workflow (Lovable → GitHub → VS Code)

1. In Lovable: **Connect GitHub** → project wordt bidirectioneel gesynchroniseerd.
2. Wijzigingen in Lovable-chat committen automatisch naar de gekoppelde branch.
3. Lokaal ontwikkelen:
   ```bash
   git clone <repo>
   bun install
   bun run dev          # start Vite op http://localhost:8080
   ```
4. Werk in VS Code, commit + push → Lovable pikt de wijzigingen op en herbouwt de preview.
5. Merge naar `main` (of de gekoppelde branch) → deploy via **Publish** in Lovable.

## Development notes

- Nooit bewerken: `src/integrations/supabase/{client,client.server,auth-middleware,auth-attacher,types}.ts`,
  `src/routeTree.gen.ts`, `.env`, `supabase/config.toml` — dit zijn Lovable-gegenereerde files.
- Nieuwe tabellen krijgen altijd `GRANT` + RLS-policies in dezelfde migratie.
- Rollen worden **uitsluitend** beheerd via de `user_roles` tabel en `has_role()`.
