
# Prijs per m² instelbaar per installateur

Elke ingelogde installateur krijgt zijn eigen prijs per m². Die prijs wordt gebruikt voor de live berekening én bij het opslaan van nieuwe offertes. Bestaande offertes blijven ongewijzigd (historische prijs blijft bewaard op de offerte-regel).

## Wat de gebruiker ziet

- Nieuw kopje **Instellingen** rechtsboven in de header (naast Uitloggen).
- Instellingenpaneel toont één veld: **Prijs per m² (excl. btw)**, met opslaan-knop.
- Nieuwe installateurs starten met de standaardwaarde **€150 / m²**.
- Op de offerte-pagina toont het live-totaal en de per-regel-berekening voortaan de eigen prijs van de installateur (in plaats van de hardgecodeerde €150).
- "Mijn offertes" blijft de historische totalen tonen zoals ze op het moment van opslaan berekend zijn.

## Wat er onder water gebeurt

### Database

Nieuwe tabel `public.installer_settings`:

```text
user_id       uuid  PK, verwijst naar auth.users
unit_price    numeric  NOT NULL DEFAULT 150  (CHECK > 0)
created_at    timestamptz
updated_at    timestamptz
```

- RLS aan; policies: elke gebruiker mag alleen zijn eigen rij lezen/aanmaken/bijwerken.
- `GRANT` voor `authenticated` en `service_role`.
- `updated_at`-trigger.
- Rij wordt lazy aangemaakt bij eerste bezoek van de instellingen of eerste offerte (via upsert in server function). Geen trigger op `auth.users` nodig.

`quotes.unit_price` en `quote_items.unit_price` blijven ongewijzigd — de prijs wordt per offerte-regel opgeslagen zodat historie klopt.

### Server (`src/lib/quotes.functions.ts`)

Nieuwe / aangepaste server functions (allemaal met `requireSupabaseAuth`):

- `getMySettings()` — leest de rij; bij ontbreken wordt automatisch een rij met €150 aangemaakt en teruggegeven.
- `updateMyUnitPrice(unit_price)` — valideert (positief getal, max bijv. 100.000) en upsert de rij voor de ingelogde gebruiker.
- `createQuote(...)` (bestaand) wordt uitgebreid: leest eerst de eigen `unit_price`, en voegt bij elke regel expliciet `unit_price`, `area_m2` en `total_ex_vat` toe zodat de opgeslagen totalen gegarandeerd correct zijn (onafhankelijk van eventuele database-defaults).

### Frontend (`src/routes/index.tsx` + nieuwe route)

- Nieuwe route `src/routes/settings.tsx` (achter dezelfde auth-gate als de hoofdpagina) met formulier voor de prijs.
- Header op zowel `/` als `/settings` krijgt links naar elkaar.
- Op `/`: bij laden wordt `getMySettings()` opgehaald via React Query; de constante `UNIT_PRICE = 150` wordt vervangen door de opgehaalde waarde en gebruikt in `totals` en in de "Basisprijs / m²"-tegel.
- Zolang de instellingen laden vult de UI de standaardwaarde 150 als plaatsvervanger, zodat het scherm niet leeg blijft.

## Buiten scope

- Aparte prijzen voor raam vs. rolluik (kan later toegevoegd worden door `installer_settings` uit te breiden of te vervangen door een `installer_prices`-tabel per producttype).
- Btw-percentage of kortingen aanpassen per installateur.
- Prijshistorie / audit log op wijzigingen van de eigen prijs.
