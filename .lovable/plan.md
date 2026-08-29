# Eenheden beheren via het adminportaal

Vandaag zijn er drie vaste eenheden (Stuk, Lengte per meter, Oppervlakte per m²) die hard in de code staan. We maken hier een beheerbare lijst van.

## Wat je krijgt

1. **Beheer → Eenheden** (nieuwe adminpagina)
   - Tabel met alle eenheden: naam, symbool, rekentype, actief, eigenaar (globaal of eigen).
   - Toevoegen/wijzigen/verwijderen van globale eenheden (alleen admin).
   - Elke eenheid krijgt een rekentype: **per stuk**, **per meter (lengte)** of **per m² (oppervlakte)**. Dat bepaalt welke velden de configurator vraagt (aantal / lengte / breedte × hoogte) en hoe de prijs wordt berekend.
   - Symbool (bv. "stuk", "m", "m²", "set") wordt gebruikt in prijs-suffix, offerte-UI en PDF.

2. **Instellingen → Eigen eenheden** (voor installateurs)
   - Installateurs zien de globale lijst en kunnen daar eigen eenheden aan toevoegen/aanpassen/verwijderen (alleen hun eigen).

3. **Producten en configurator**
   - De dropdown "Eenheid" komt uit de database: globale eenheden + eigen eenheden van de ingelogde installateur, alleen actieve.
   - Bestaande producten en configuratieregels blijven werken: de drie huidige eenheden worden als globale rijen aangemaakt met dezelfde codes (`stuk`, `lengte`, `oppervlakte`), dus er verandert niets aan bestaande data.

4. **Offerte-UI, PDF en e-mail**
   - Berekening en weergave gebruiken het rekentype + symbool van de eenheid in plaats van de hardgecodeerde lijst.

## Technische aanpak

- Migratie: nieuwe tabel `public.units` met `id`, `owner_id` (nullable = globaal), `code`, `label`, `symbol`, `basis` (enum-achtig via CHECK: `stuk` | `lengte` | `oppervlakte`), `active`, timestamps. Unieke code per eigenaar. GRANT's voor `authenticated` + `service_role`.
- RLS: SELECT voor authenticated op globale rijen (`owner_id is null`) én eigen rijen; INSERT/UPDATE/DELETE op eigen rijen (`owner_id = auth.uid()`); volledige toegang voor admins op globale rijen via `has_role(auth.uid(), 'admin')`.
- Seed van de drie bestaande eenheden als globale rijen (in dezelfde migratie, want bestaande data verwijst ernaar via de tekstkolom `unit`).
- `products.unit` en `configurations.unit` / `project_quote_items.unit` blijven tekstkolommen met de eenheidscode — geen breaking change, geen datamigratie nodig.
- Serverfuncties in `src/lib/noxl.functions.ts`: `listUnits`, `createUnit`, `updateUnit`, `deleteUnit` (globaal alleen voor admin, eigen voor installateur), allemaal via `requireSupabaseAuth`.
- Gedeelde helper `src/lib/units.ts`: type `UnitBasis`, prijs-/oppervlakteberekening en suffix-formattering op basis van `basis` + `symbol`; gebruikt door `products.tsx`, `project.$projectId.configurator.tsx`, `quote-pdf.server.ts` en `quote-email.server.ts` (server leest de eenheden van de offerte-eigenaar mee op).
- Nieuwe route `src/routes/_authenticated/beheer.eenheden.tsx` + navigatie-item in `AppShell` (alleen admin), en een sectie in `instellingen.tsx` voor eigen eenheden.
- Onbekende/verwijderde eenheidscodes vallen terug op `stuk`, zodat oude regels nooit crashen.
