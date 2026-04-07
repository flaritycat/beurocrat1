# kommune

`kommune` er en produksjonsklar MVP-modul for strukturert arbeid med kommunesaker. Løsningen er laget for å kjøre som egne containere på en eksisterende Ubuntu-server bak en eksisterende reverse proxy, med offentlig base path `https://dev.raoul.no/kommune` og API under `/kommune/api`.

Denne versjonen kjører uten innlogging og uten offentlig serverlagret saksliste. Saksutkast lagres lokalt i nettleseren på den enheten brukeren arbeider fra, og må eksporteres eksplisitt dersom de skal tas med videre.

Verktøyet hjelper brukeren med å:

- opprette og følge opp saker
- besvare de 5 kjernespørsmålene i et strukturert intervjuløp
- registrere bevis, kilder, tidslinje og kartobservasjoner
- generere forsiktige, sporbare tekster for videre klage- og innsynsarbeid

Arbeidsmodellen er:

- lokale utkast i nettleseren
- ingen serverlagret offentlig saksliste
- eksplisitt eksport av JSON, tekster og AI-promptpakke når brukeren selv ønsker det

Systemet er bevisst `evidence-first` og skal ikke brukes som en juridisk fasit.

## Prosjektstruktur

```text
Kommune/
├── backend/            # Fastify + TypeScript API
├── frontend/           # React + Vite SPA med base path /kommune
├── database/           # SQL-migrasjoner
├── docs/               # Deploy- og proxy-notater
├── infra/              # Nginx-konfig for frontend-containeren
├── docker-compose.yml
└── .env.example
```

## Stack

- Frontend: React + Vite + TypeScript
- Backend: Node.js + TypeScript + Fastify
- Database: PostgreSQL + PostGIS
- Kart: Leaflet med byttbar tile-/geokoding-konfigurasjon
- Containerisering: Docker + Docker Compose

## Lokalt oppsett

1. Opprett miljøfil:

   ```bash
   cp .env.example .env
   ```

2. Start løsningen:

   ```bash
   docker compose up --build
   ```

3. Åpne applikasjonen:

   - App: `http://127.0.0.1:18080/kommune/`
   - Frontend health: `http://127.0.0.1:18080/kommune/healthz`
   - Frontend ready: `http://127.0.0.1:18080/kommune/readyz`
   - API health: `http://127.0.0.1:18080/kommune/api/healthz`

Compose publiserer frontend kun på `127.0.0.1:${KOMMUNE_PUBLIC_PORT}` som trygg default. Backend eksponeres bare internt i Compose-nettverket.

Saksutkast lagres lokalt i browserens `localStorage`, ikke i en offentlig saksdatabase på serveren. Dokumenter, bilder og andre vedlegg håndteres fortsatt utenfor systemet. I denne MVP-en registreres slike materialer kun som manuelle bevisposter, lenker, referanser eller notater.

## Hvordan base path `/kommune` er løst

- Frontend bygges med `VITE_APP_BASE_PATH=/kommune/`.
- React Router kjører med `basename=/kommune`.
- Nginx i frontend-containeren serverer SPA-en under `/kommune/`.
- Nginx i frontend-containeren proxier `/kommune/api/*` til backend-containeren.
- Backend registrerer hjelpe-endepunkter under `API_BASE_PATH=/kommune/api`.

Dette gjør at hele løsningen fungerer bak et eksisterende domene og eksisterende proxy uten eget subdomene.

## Containere

- `kommune-db`: beholdt i compose for kompatibilitet med tidligere arkitektur, men lokale utkast lagres ikke der
- `kommune-backend`: Fastify hjelpe-API for health og kart-/kildeoppslag
- `kommune-frontend`: Nginx + bygget React-app, lokal utkastlagring i nettleseren

Designvalget med én frontend-container som både serverer SPA og proxier API gjør ekstern proxy-konfig enklere: upstream kan peke til frontend-containeren alene.

## Miljøvariabler

Minst disse må være satt:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `KOMMUNE_PUBLIC_PORT`
- `APP_BASE_PATH`
- `API_BASE_PATH`
- `VITE_APP_BASE_PATH`
- `VITE_API_BASE_PATH`
- `RATE_LIMIT_MAX`
- `RATE_LIMIT_WINDOW`
- `GEOCODER_ENABLED`
- `GEOCODER_PROVIDER`
- `GEOCODER_BASE_URL`
- `GEOCODER_USER_AGENT`
- `LEGAL_SOURCE_PROVIDER_ENABLED`
- `PUBLIC_DATASET_PROVIDER_ENABLED`
- `MUNICIPALITY_SOURCE_PROVIDER_ENABLED`
- `TILE_URL_TEMPLATE`
- `TILE_ATTRIBUTION`
- `SEED_DEMO_DATA`

## Lokal lagring og eksport

- Utkast lagres bare lokalt i nettleseren som åpner løsningen.
- Bytte av nettleser, maskin eller sletting av browserdata fjerner også de lokale utkastene.
- Brukeren må eksportere utkast eksplisitt som JSON dersom arbeidet skal tas med videre.
- AI-promptpakke, klageutkast og andre tekster kan kopieres direkte fra Output-fanen.
- Løsningen sender ikke hele saken automatisk til eksterne AI-tjenester.

## Eksterne kildeadaptere i MVP

Følgende adaptere er implementert og kan slås av/på via env:

- `GeocoderProvider`: OSM/Nominatim-basert geokoding for stedsoppslag
- `TileProvider`: statisk, env-styrt tile-konfig for Leaflet
- `PublicDatasetProvider`: forslag til norske offentlige datasettsøk via Geonorge og data.norge.no
- `LegalSourceProvider`: manuelle juridiske kildespor, særlig Lovdata-referanser
- `MunicipalitySourceProvider`: nøkterne forslag til hvordan finne offisielle kommunale portaler og innsynsflater

Kildehåndtering er gjort forsiktig:

- geokodesøk caches i minne
- hver provider kan deaktiveres separat
- UI viser `kilde utilgjengelig` i stedet for å knekke hvis en kilde faller ut

Backend brukes nå bare til:

- `/kommune/api/healthz`
- `/kommune/api/readyz`
- `/kommune/api/maps/geocode`
- `/kommune/api/maps/search`

## MVP-omfang som er levert

- dashboard og saksliste
- opprett, vis og oppdater lokalt utkast
- intervju med nøyaktig 5 kjernespørsmål, ett om gangen
- strukturert lagring av brukerutsagn, dokumenterte fakta, usikkerhet og mulige problemstillinger
- registrering av manuelle bevisposter, kilder og tidslinje
- kartvisning, geokoding, lagret lokasjon og kartobservasjoner
- strukturert analyse generert lokalt i frontend
- generering av:
  - kort sammendrag
  - strukturert saksrapport
  - bevisliste
  - mangelliste
  - full klage
  - kort klage
  - innsynsbegjæring
  - AI-promptpakke
- eksplisitt eksport av hele utkastet som JSON
- health checks

## Videre utvidelser

Naturlige neste steg etter MVP:

- autentisering og tilgangsstyring
- mer avansert provider-cache med Redis
- publiseringskontroll og automatisk varsling ved mulig personinformasjon
- videre opprydding av tidligere databasearkitektur dersom lokal-modellen blir permanent
- bedre søk i juridiske kilder og kommunale dokumenter
- mer avansert spatial modellering av observasjoner med egne geometri-kolonner
- audit trail for feltendringer og output-generering

## Reverse proxy og serverdeploy

Se [docs/reverse-proxy.md](/home/project/Kommune/docs/reverse-proxy.md) for konkret deploy-notat og upstream-eksempler for eksisterende proxy på `dev.raoul.no`.
