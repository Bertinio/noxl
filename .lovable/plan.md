# Fix: installateurs kunnen geen klanten/projecten aanmaken

## Wat er gebeurt

Bij "Nieuwe klant" → Opslaan komt de melding *new row violates row-level security policy for table "customers"*.

Oorzaak (nagekeken in de database): alle beveiligingsregels op `customers`, `projects`, `configurations`, `project_quotes` en `project_quote_items` eisen de rol **admin**. In de database bestaan momenteel 1 admin, 1 klant en 3 installateurs. Sinds de omschakeling naar "installateurs registreren zelf" krijgt een nieuwe gebruiker enkel de rol `installer`, dus wordt elke schrijfactie geweigerd — niet alleen klanten aanmaken, ook projecten, configuraties en offertes.

## Oplossing

Installateurs krijgen dezelfde rechten op hun eigen data als admins. De eigendomscontrole blijft ongewijzigd: je ziet en wijzigt nog steeds alleen rijen die aan jouw account hangen (`customers.owner_id = auth.uid()`, en voor projecten/configuraties/offertes via de gekoppelde klant).

Concreet komt er per tabel een extra regel voor de rol `installer`, naast de bestaande admin-regels:

- `customers` — eigen klanten lezen/aanmaken/wijzigen/verwijderen
- `projects` — projecten van eigen klanten
- `configurations` — configuratieregels binnen die projecten
- `project_quotes` en `project_quote_items` — offertes binnen die projecten

Klantaccounts (rol `customer`) behouden hun bestaande leesrechten; er verandert niets aan wat een klant ziet in het portaal.

## Technische details

- Eén migratie die per tabel een policy toevoegt met `public.has_role(auth.uid(), 'installer')` in plaats van `'admin'`, met exact dezelfde eigendoms-`USING`/`WITH CHECK`-voorwaarden als de bestaande admin-policies.
- Geen kolomwijzigingen, geen wijziging aan `user_roles`, geen `is_admin`-kolom, geen aanpassing aan de gegenereerde Supabase-client.
- Geen frontendwijzigingen nodig: `createCustomer` en de overige serverfuncties werken al via de sessie van de ingelogde gebruiker.
- Na de migratie wordt "Nieuwe klant" opnieuw getest, inclusief het aanmaken van een project en een configuratieregel.
