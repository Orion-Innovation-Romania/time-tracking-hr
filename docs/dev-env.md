# TTAH — Development Environment

Cum rulezi platforma local: **doar Postgres în Docker**, API + web pe host cu hot reload.

```
browser ──▶ web (Next.js :3000) ──/api proxy──▶ api (NestJS :4000) ──▶ Postgres :5432
```

| Componentă    | Unde rulează              | Port |
| ------------- | ------------------------- | ---- |
| Web (Next.js) | host (`pnpm dev`)         | 3000 |
| API (NestJS)  | host (`pnpm dev`)         | 4000 |
| Postgres 16   | Docker                    | 5432 |

> Proiectul folosește **pnpm**, nu npm. Echivalentul lui `npm run dev` este `pnpm dev`.

---

## 1. Cerințe

- **Node.js 22 LTS**
- **pnpm 9.15.4**
- **Git**
- **Docker** (userul în grupul `docker`)

### Ubuntu

```bash
# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git

# pnpm
sudo corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm --version   # 9.15.4

# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
# apoi log out/in (sau: newgrp docker)
```

### Windows

```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
winget install Docker.DockerDesktop
```

Pornește Docker Desktop, deschide un PowerShell nou:

```powershell
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm --version
```

---

## 2. Cod + dependențe

```bash
cd ~/time-tracking-hr   # sau folderul unde ai clonat repo-ul
pnpm install
```

---

## 3. Oprește stack-ul de producție (dacă rulează)

Dacă ai deja `docker compose up` (api, web, caddy, postgres):

```bash
docker compose down
```

Postgres din `docker-compose.yml` **nu** publică portul `5432` pe host — API-ul local nu poate folosi acel container. Pentru dev folosești un Postgres separat (pasul 5).

---

## 4. Configurează environment

### 4a. API — `apps/api/.env` (obligatoriu)

API-ul rulează din `apps/api` și citește env-ul de acolo. Generează două secrete:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Creează `apps/api/.env`:

```ini
DATABASE_URL=postgresql://ttah:ttah@localhost:5432/ttah?schema=public
API_PORT=4000
NODE_ENV=development
TZ=Europe/Bucharest

JWT_ACCESS_SECRET=<paste primul secret>
JWT_REFRESH_SECRET=<paste al doilea secret>
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=604800

CORS_ORIGIN=http://localhost:3000
COOKIE_SECURE=false

# Relativ la apps/api — fără asta nu se sincronizează userii:
USERS_CONFIG_PATH=../../config/users.yml
UPLOAD_TMP_DIR=./.uploads
```

### 4b. Web — `apps/web/.env.local` (opțional)

Dev server-ul proxy-uiește deja spre `http://localhost:4000`. Creează fișierul doar dacă vrei să fii explicit:

```ini
API_INTERNAL_URL=http://localhost:4000
NEXT_PUBLIC_API_BASE_URL=/api
```

---

## 5. Pornește doar baza de date (Docker)

```bash
docker run --name ttah-dev-pg \
  -e POSTGRES_USER=ttah \
  -e POSTGRES_PASSWORD=ttah \
  -e POSTGRES_DB=ttah \
  -p 5432:5432 \
  -d postgres:16-alpine
```

Verificare: `docker ps` — trebuie să vezi portul `0.0.0.0:5432`.

Oprire / ștergere ulterior:

```bash
docker rm -f ttah-dev-pg
```

---

## 6. Migrări + seed

Din rădăcina repo-ului:

```bash
pnpm --filter @ttah/api prisma:generate
pnpm --filter @ttah/api exec prisma migrate dev --name init
pnpm --filter @ttah/api prisma:seed
```

Dacă folderul `apps/api/prisma/migrations/` există deja în Git, `migrate dev` aplică migrările existente (nu e nevoie de `--name init` decât la prima migrare creată local).

> Commit-uiește `apps/api/prisma/migrations/` — producția le aplică de acolo.

---

## 7. Pornește API + web

```bash
pnpm run shared:build
pnpm dev
```

`pnpm dev` pornește shared watcher + NestJS (`:4000`) + Next.js (`:3000`).

Separat:

```bash
pnpm run api:dev   # doar API
pnpm run web:dev   # doar web
```

---

## 8. Primul login

1. Deschide <http://localhost:3000>
2. Autentifică-te cu un user din `config/users.yml`, ex. **admin** / `Admin#Initial1`
3. La primul login ești forțat să schimbi parola

Conturile vin din `config/users.yml`. După editare, restart la API sincronizează (useri noi = creați, useri scoși = dezactivați).

---

## 9. Comenzi zilnice

```bash
pnpm dev                                          # API + web + shared
pnpm run build                                    # build tot
pnpm run typecheck                                # type-check
pnpm run test                                     # teste backend
pnpm --filter @ttah/api exec prisma studio        # UI pe DB

# După schimbări în schema Prisma:
pnpm --filter @ttah/api exec prisma migrate dev --name <nume_schimbare>
```

---

## 10. Troubleshooting

| Simptom | Fix |
| ------- | --- |
| `pnpm` not found | `corepack enable` + `corepack prepare pnpm@9.15.4 --activate`, sau `npm i -g pnpm@9.15.4` |
| Port 5432 ocupat | Stack vechi încă rulează → `docker compose down` |
| API nu vede DB | Postgres dev nu rulează / fără `-p 5432:5432`. `DATABASE_URL` trebuie cu host `localhost` (nu `postgres`) |
| `users config not found` / nu poți loga | În `apps/api/.env`: `USERS_CONFIG_PATH=../../config/users.yml` |
| `Cannot find module '@ttah/shared'` | `pnpm run shared:build` înainte de `pnpm dev` |
| Login OK dar rămâi delogat | `COOKIE_SECURE=false` în `apps/api/.env`; folosește HTTP pe localhost |
| Port 3000/4000 ocupat | Oprește procesul care îl ține, sau schimbă portul în `.env` |
| Tipuri Prisma stale | `pnpm --filter @ttah/api prisma:generate` |

---

## Producție

Pentru deploy full (Docker Compose + Caddy) vezi [deploy-prod.md](deploy-prod.md).
Ghidul englezesc mai detaliat (Windows + Ubuntu): [deploy-dev.md](deploy-dev.md).
