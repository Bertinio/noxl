
# NoXL MVP — plan

Deze MVP vervangt de huidige ramen/rolluiken-offertetool. Ik bouw NoXL bovenop de tabellen die vorige stap al zijn aangemaakt (`customers`, `projects`, `configurations`, `project_quotes`, `project_quote_items`) en breid ze uit voor het klantportaal.

## Belangrijke keuze eerst — twee rollen

Je vroeg eerder "geen auth per klant", maar nu vraag je een **klantportaal met magic-link login**. Dat kan alleen als elke Customer óók een auth-user is. Ik ga daarom door met dit model:

- **Installateur (admin)** — logt in, ziet álle eigen klanten/projecten/offertes, bouwt configuraties en genereert offertes.
- **Klant (portaal)** — logt in via magic link, ziet alleen z'n eigen projecten en offertes, kan PDF downloaden.

Één auth-tabel (`auth.users`), rol bepaald door een `user_roles` tabel (`admin` / `customer`). RLS werkt op basis van rol + eigenaar.

## Wat er onder water verandert

### Database (migratie)
- `customers`: `auth_user_id uuid REFERENCES auth.users` (uniek, nullable tot invite voltooid), plus `owner_id` blijft (installateur).
- `projects`: `total_price numeric DEFAULT 0` toevoegen (voor prijsengine).
- Nieuwe enum + tabel `app_role` / `user_roles` (admin, customer) met `has_role()` security-definer.
- Trigger: bij `project_quotes` insert wordt `projects.status = 'quoted'` gezet.
- RLS herschreven:
  - Admin (`has_role(admin)`) → ziet alles wat hij bezit via `customers.owner_id`.
  - Customer (`has_role(customer)`) → ziet alleen rijen waar `customers.auth_user_id = auth.uid()` (via join).
- GRANTs zoals vereist.

### Server functions (`src/lib/noxl.functions.ts`)
Allemaal met `requireSupabaseAuth`:
- `listCustomers`, `getCustomer`, `createCustomer` (stuurt magic-link invite via admin API), `updateCustomer`.
- `listProjects`, `getProject`, `createProject`, `updateProjectStatus`.
- `listConfigurations`, `upsertConfigurations` (batch insert/update/delete regels).
- `calculateProjectTotal(project_id)` — som van `configurations.total_price`, update `projects.total_price`.
- `generateQuote(project_id)` — maakt Quote + kopieert configuraties naar QuoteItems, `quote_number = "Q-" + short(project_id) + "-" + timestamp`, zet project op `quoted`.
- `listQuotes`, `getQuoteForPdf` (haalt customer + project + items).
- `myPortalData` — voor klantportaal (alleen eigen projecten/offertes).

### PDF-generatie
- Server route `src/routes/api/quotes/$quoteId.pdf.ts` — auth check, genereert PDF met `pdfkit` (Worker-compatibel) en streamt terug. Zwart-wit tabel-layout met customer, project, items, totaal, datum, offertenummer.

### UI-routes (TanStack)
```text
src/routes/
  auth.tsx                              (bestaand — login + magic link)
  _authenticated/route.tsx              (bestaand — auth gate)
  _authenticated/index.tsx              → redirect op basis van rol
  _admin/                                (nested onder _authenticated, gate op admin)
    dashboard.tsx                       Customers + Projects tabellen, "Nieuw project"
    customers.$id.tsx                   Customer detail + projectenlijst
    projects.$id.tsx                    Project detail: status, config-regels, totaal, knoppen
    projects.$id.configurator.tsx       Configurator UI
    projects.$id.quotes.tsx             Offertes van project + Download PDF
  _portal/                               (klantportaal, gate op customer)
    portal.tsx                          Eigen projecten + offertes + PDF-download
```

Layout: shadcn Sidebar met navigatie (Dashboard / Klanten / Projecten voor admin; Mijn projecten / Mijn offertes voor klant). Tabellen met sorteerbare kolommen (tanstack-table). Buttons: primary blauw, secondary grijs via bestaande tokens.

## Wat je gaat zien

1. **Login** — één `/auth` scherm, magic-link + wachtwoord. Na login stuurt de app je door naar `/dashboard` (admin) of `/portal` (klant).
2. **Admin dashboard** — twee tabellen (Klanten, Projecten), knop "Nieuw project" en "Nieuwe klant". Sidebar navigatie.
3. **Customer detail** — klantgegevens, projectenlijst, knop "Nieuw project voor deze klant".
4. **Project detail** — titel/status/beschrijving, tabel met configuratieregels, live totaal, knoppen "Open configurator" en "Genereer offerte".
5. **Configurator** — dynamische rijen (optienaam, waarde, qty, unit price → total auto), "Regel toevoegen", "Opslaan", "Terug".
6. **Offerte-overzicht** — offertes per project, totaal, "Genereer PDF".
7. **PDF** — eenvoudige zwart/wit tabel met alle vereiste velden.
8. **Klantportaal** — eigen projecten, eigen offertes, PDF-download; geen admin-toegang.

## Buiten scope (bewust)
- Verwijderen van de oude ramen/rolluiken-tabellen (`quotes`, `quote_items`, `installer_settings`). Blijven staan, worden niet meer gebruikt door de UI. Laat het weten als je ze wil droppen.
- Btw-percentage, kortingen, meerdere talen, betaling.
- Klant kan zelf configuraties bewerken — portaal is read-only.
- GitHub-export: TanStack-projecten in Lovable exporteer je via Git-sync in de workspace-instellingen. Geen aparte codewijziging nodig.

## Bevestig één ding voor ik begin
Klopt het dat elke Customer een auth-user krijgt (magic link) zodra jij (admin) hem aanmaakt? Zo nee, dan schrap ik het klantportaal-deel.
