# TTAH — Development Environment Deploy Guide

How to run the TTAH platform locally for development, on **Windows** and on **Ubuntu**.

In dev you run the two apps on your host (with hot reload) and Postgres in a
throwaway Docker container. The browser talks to the Next.js app on
`http://localhost:3000`, which proxies `/api/*` to the NestJS API on
`http://localhost:4000`.

```
browser ──▶ web (Next.js :3000) ──/api proxy──▶ api (NestJS :4000) ──▶ Postgres :5432
```

| Component | Dev location | Port |
| --------- | ------------ | ---- |
| Web (Next.js) | host, `pnpm dev` | 3000 |
| API (NestJS)  | host, `pnpm dev` | 4000 |
| Postgres 16   | Docker container | 5432 |

> **Working directories matter.** pnpm runs each app from its own folder:
> the API from `apps/api`, the web app from `apps/web`. That is why the API
> reads `apps/api/.env` and the users file path is relative to `apps/api`.

---

## 1. Prerequisites

You need **Node.js 22 LTS**, **pnpm 9.15.4**, **Git**, and **Docker**.

### Windows 10/11

Install with winget (run in PowerShell):

```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
winget install Docker.DockerDesktop
```

Start **Docker Desktop** once so the engine is running, then open a **new**
PowerShell window and enable pnpm via Corepack:

```powershell
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm --version   # should print 9.15.4
```

If `corepack enable` fails with an `EPERM`/permission error, either run the
command from an **Administrator** PowerShell, or skip Corepack and prefix every
`pnpm` command in this guide with `corepack pnpm@9.15.4` (e.g.
`corepack pnpm@9.15.4 install`). Alternatively install it globally:
`npm install -g pnpm@9.15.4`.

### Ubuntu 22.04 / 24.04

```bash
# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git

# pnpm via Corepack
sudo corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm --version   # 9.15.4

# Docker Engine + compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"   # then log out/in so the group applies
```

---

## 2. Get the code

```bash
git clone <your-repo-url> ttah
cd ttah
```

---

## 3. Install dependencies

From the repo root:

```bash
pnpm install
```

(Windows without Corepack activated: `corepack pnpm@9.15.4 install`.)

This installs all workspace packages (`apps/api`, `apps/web`,
`packages/shared`).

---

## 4. Configure environment

Three small env files are used in dev. Create them from the template.

### 4a. Root `.env` (used by the dev Postgres container)

Copy the example and keep the dev defaults:

```bash
# Ubuntu
cp .env.example .env
```

```powershell
# Windows
Copy-Item .env.example .env
```

The default credentials in `.env.example` (`ttah` / `ttah` / db `ttah`) are fine
for local dev.

### 4b. API env — `apps/api/.env`

Create `apps/api/.env` with the values the API needs when run from its own
folder. Generate two secrets first:

```bash
# Ubuntu
openssl rand -hex 32   # run twice, once per secret
```

```powershell
# Windows (Node is always available)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then create `apps/api/.env`:

```ini
DATABASE_URL=postgresql://ttah:ttah@localhost:5432/ttah?schema=public
API_PORT=4000
NODE_ENV=development
TZ=Europe/Bucharest

JWT_ACCESS_SECRET=<paste first generated secret>
JWT_REFRESH_SECRET=<paste second generated secret>
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=604800

CORS_ORIGIN=http://localhost:3000
COOKIE_SECURE=false

# Path is resolved relative to apps/api, so point up to the repo-root config:
USERS_CONFIG_PATH=../../config/users.yml
UPLOAD_TMP_DIR=./.uploads
```

> The `USERS_CONFIG_PATH=../../config/users.yml` line is important — without it
> the API cannot find the accounts file and no one can log in.

### 4c. Web env — `apps/web/.env.local` (optional)

The web dev server already defaults its API proxy target to
`http://localhost:4000`, so this file is optional. Create it only if you want to
be explicit:

```ini
API_INTERNAL_URL=http://localhost:4000
NEXT_PUBLIC_API_BASE_URL=/api
```

---

## 5. Start a development database

Run a disposable Postgres 16 container with the port published to your host:

```bash
docker run --name ttah-dev-pg \
  -e POSTGRES_USER=ttah -e POSTGRES_PASSWORD=ttah -e POSTGRES_DB=ttah \
  -p 5432:5432 -d postgres:16-alpine
```

(Windows PowerShell: same command on one line, or use backticks `` ` `` instead
of `\` for line continuation.)

Check it is up: `docker ps`. To stop/remove later:
`docker rm -f ttah-dev-pg`.

---

## 6. Prepare the database

Generate the Prisma client, create the **initial migration**, and seed default
settings. Run these from the repo root:

```bash
# 1. Generate the Prisma client
pnpm --filter @ttah/api prisma:generate

# 2. Create + apply the first migration (creates apps/api/prisma/migrations/)
pnpm --filter @ttah/api exec prisma migrate dev --name init

# 3. Seed default computation settings and export templates
pnpm --filter @ttah/api prisma:seed
```

> **Commit the generated `apps/api/prisma/migrations/` folder.** Production
> applies these exact migration files on startup, so they must be in Git.

---

## 7. Build shared and run the dev servers

Build the shared package once, then start everything with hot reload:

```bash
pnpm run shared:build
pnpm dev
```

`pnpm dev` runs the shared watcher, the NestJS API (`:4000`) and the Next.js app
(`:3000`) together. Leave it running. To run only one app:

```bash
pnpm run api:dev   # API only
pnpm run web:dev   # web only
```

---

## 8. First login

1. Open <http://localhost:3000> — you are redirected to `/login`.
2. Sign in with a user from `config/users.yml`, e.g. **admin / `Admin#Initial1`**.
3. You are forced to set a new password on first login.

Accounts are defined in `config/users.yml`. Editing that file and restarting the
API syncs changes (new users are created, removed users are deactivated).

---

## 9. Everyday commands

```bash
pnpm dev                 # run API + web + shared watcher
pnpm run build           # build every package
pnpm run typecheck       # type-check all packages
pnpm run test            # run backend tests
pnpm --filter @ttah/api exec prisma studio   # browse the DB in a UI

# After changing the Prisma schema:
pnpm --filter @ttah/api exec prisma migrate dev --name <change_name>
```

---

## 10. Troubleshooting

| Symptom | Fix |
| ------- | --- |
| `pnpm` not found | Corepack not active — prefix commands with `corepack pnpm@9.15.4` or `npm i -g pnpm@9.15.4`. |
| API log: `users config not found ... skipping sync`, can't log in | `USERS_CONFIG_PATH` wrong. In `apps/api/.env` set `USERS_CONFIG_PATH=../../config/users.yml`. |
| API can't reach the database | Dev Postgres not running or not published. `docker ps`; recreate with `-p 5432:5432`. Confirm `DATABASE_URL` host is `localhost`. |
| `Cannot find module '@ttah/shared'` | Run `pnpm run shared:build` before `pnpm dev`. |
| Login works but you stay logged out | In dev use HTTP and keep `COOKIE_SECURE=false` in `apps/api/.env`. |
| Port already in use | Something else uses 3000/4000/5432. Stop it or change the port in the relevant `.env`. |
| Changed the schema, types stale | Re-run `pnpm --filter @ttah/api prisma:generate`. |

For production deployment see [deploy-prod.md](deploy-prod.md).
