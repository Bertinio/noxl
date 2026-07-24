# Offerte-app voor raam- en rolluikinstallateurs

## Wat ik ga bouwen

Een strakke, moderne single-page offerte-tool op `/` met:

**Invoerformulier (links / boven op mobiel):**
- Klantnaam (tekst, verplicht)
- E-mailadres klant (email, verplicht, gevalideerd)
- Type product — dropdown: Raam / Rolluik
- Breedte in mm (nummer, > 0)
- Hoogte in mm (nummer, > 0)
- Notities/opmerkingen (textarea, optioneel)
- Knop: "Offerte opslaan"

**Live berekening (rechts / onder op mobiel), updatet tijdens typen:**
- Oppervlakte = breedte × hoogte / 1.000.000 → getoond in m² (2 decimalen)
- Basisprijs: €150/m² (constante)
- Totaalprijs excl. btw = oppervlakte × €150, groot in beeld
- Nette samenvattingskaart met product, afmetingen, m², prijs

**Na opslaan:** toast met het gegenereerde offertenummer + reset formulier.

## Design

Modern, zakelijk, licht thema. Één primaire accentkleur (diepblauw), veel witruimte, afgeronde kaarten, subtiele schaduw, duidelijke typografie. Semantische design tokens in `src/styles.css` — geen hardcoded kleuren. shadcn `Input`, `Select`, `Textarea`, `Button`, `Card`, `Sonner` voor toasts. Zod + react-hook-form voor validatie.

## Backend — Lovable Cloud

Lovable Cloud is nog niet aan. Ik zet 'm aan en maak in dezelfde stap een migratie:

**Tabel `public.quotes`:**
- `id` uuid PK
- `quote_number` text unique, gegenereerd als `OFF-YYYYMMDD-XXXX` via trigger/default
- `customer_name` text
- `customer_email` text
- `product_type` text check in ('raam','rolluik')
- `width_mm` int check > 0
- `height_mm` int check > 0
- `area_m2` numeric (gegenereerde kolom uit width×height/1.000.000)
- `unit_price` numeric default 150
- `total_ex_vat` numeric (gegenereerde kolom uit area × unit_price)
- `notes` text
- `created_at` timestamptz default now()

Grants + RLS. Voor deze eerste versie (nog geen auth-scherm): tijdelijk `INSERT` en `SELECT` voor `anon` toegestaan zodat het formulier direct werkt. Ik meld duidelijk dat we later auth kunnen toevoegen om offertes per gebruiker af te schermen.

## Technische opzet

- Formulierlogica volledig client-side (React state + zod).
- Opslaan via `createServerFn` (`POST`) in `src/lib/quotes.functions.ts` die met de server publishable client insert doet en `quote_number` teruggeeft.
- Route `src/routes/index.tsx` herschrijven (placeholder verwijderen), eigen `head()` met titel/description/OG.

## Volgorde

1. Lovable Cloud aanzetten.
2. Migratie: tabel + grants + RLS + policies + generator voor `quote_number`.
3. Server function voor insert.
4. UI: formulier + live prijskaart op `/`.
5. Head-metadata en toast-feedback.

Wil je dat ik dit zo bouw?
