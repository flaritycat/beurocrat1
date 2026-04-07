# Deploy bak eksisterende reverse proxy

Denne modulen er laget for å leve bak eksisterende reverse proxy på `dev.raoul.no` med base path `/kommune`.

## Anbefalt oppsett

Ekstern proxy bør rute hele `/kommune` til frontend-containeren:

- upstream: `kommune-frontend:8080`
- behold prefix `/kommune`
- ikke strip path
- send med `Host`, `X-Forwarded-For`, `X-Forwarded-Proto` og gjerne `X-Forwarded-Prefix`

Frontend-containeren har allerede intern Nginx-konfig som:

- serverer SPA under `/kommune/`
- svarer på `/kommune/healthz`
- proxier `/kommune/readyz` til backendens ready-endepunkt
- proxier `/kommune/api/*` til `kommune-backend:3000`

Det betyr at den eksterne proxien normalt ikke trenger egen separat API-rute.

## Eksempel: Nginx

```nginx
location /kommune/ {
    proxy_pass http://127.0.0.1:18080/kommune/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Prefix /kommune;
}

location = /kommune {
    return 301 /kommune/;
}
```

## Eksempel: Caddy

```caddy
handle_path /kommune* {
    reverse_proxy 127.0.0.1:18080
}
```

Hvis proxien stripper prefix i stedet for å bevare det, vil denne modulen ikke fungere korrekt. Prefixet må beholdes.

## Docker-nettverk på eksisterende server

Det finnes to praktiske måter å koble inn modulen på:

1. Behold `docker-compose.yml` som den er, med frontend publisert på `127.0.0.1:${KOMMUNE_PUBLIC_PORT}` og la host-proxyen peke dit.
2. Koble `kommune-frontend` til eksisterende proxy-nettverk og bruk container-navn som upstream.

Hvis eksisterende reverse proxy selv kjører i Docker, er alternativ 2 ofte renest. Da kan du for eksempel:

```bash
docker network connect <eksisterende_proxy_nettverk> kommune-frontend
```

eller utvide compose-filen med en ekstra ekstern network-definisjon tilpasset serverens faktiske oppsett.

## Viktige driftsnotater

- `docker-compose.yml` antar ikke at host-port 80 eller 443 er ledig.
- backend er ikke publisert eksternt og er kun tilgjengelig internt.
- frontend bindes til `127.0.0.1` som sikker default.
- helse-endepunkter:
  - `/kommune/healthz`
  - `/kommune/readyz`
  - `/kommune/api/healthz`
- ved deploy på `dev.raoul.no` bør `.env` settes eksplisitt og demo-seed vurderes slått av etter første oppstart.
