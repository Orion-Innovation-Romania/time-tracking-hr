# TTAH — Production Deploy Guide (Docker Compose)

How to deploy the TTAH platform to a production server with Docker Compose, on
**Ubuntu** and on **Windows Server**.

Everything runs in containers behind a single reverse proxy (Caddy), which
terminates TLS and is the only service exposed to the network.

```
             ┌──────────────────── Docker network (internal) ────────────────────┐
client ──▶ Caddy :80/:443 ──/api/*──▶ api (NestJS :4000) ──▶ postgres :5432
             │            └─────────▶ web (Next.js :3000)                          │
             └───────────────────────────────────────────────────────────────────┘
```

| Service | Image / build | Exposed | Notes |
| ------- | ------------- | ------- | ----- |
| `caddy` | caddy:2-alpine | 80, 443 | Reverse proxy + TLS |
| `web`   | `apps/web/Dockerfile` | internal | Next.js standalone |
| `api`   | `apps/api/Dockerfile` | internal | Applies DB migrations on startup |
| `postgres` | postgres:16-alpine | internal | Data in the `pgdata` volume |

Key facts:

- One **root `.env`** file drives the whole stack.
- The **API applies `prisma migrate deploy` automatically on every startup**, so
  the database schema is created/updated when containers come up — **provided
  the migration files are committed** (see step 5).
- Accounts come from `config/users.yml`, mounted read-only into the API.
- Cookies are secure (HTTPS-only) in production (`COOKIE_SECURE=true`).

---

## Part A — Ubuntu server

### 1. Prerequisites

```bash
# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker
docker compose version   # must succeed (Compose v2)

sudo apt-get install -y git
```

### 2. Get the code

```bash
sudo mkdir -p /opt/ttah && sudo chown "$USER" /opt/ttah
git clone <your-repo-url> /opt/ttah
cd /opt/ttah
```

### 3. Configure `.env`

```bash
cp .env.example .env
# generate secrets (run each line, paste the output into .env)
openssl rand -hex 32   # JWT_ACCESS_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET
```

Edit `.env` and set at least the following for production:

```ini
# --- Database (the API builds its own DATABASE_URL from these in Compose) ---
POSTGRES_USER=ttah
POSTGRES_PASSWORD=<a long random password>
POSTGRES_DB=ttah

# --- API secrets ---
JWT_ACCESS_SECRET=<generated>
JWT_REFRESH_SECRET=<generated>

# --- Production hardening ---
NODE_ENV=production
TZ=Europe/Bucharest
COOKIE_SECURE=true

# --- Public address served by Caddy ---
# A hostname (recommended) or ":443" to serve on the IP only.
SITE_ADDRESS=ttah.internal
# The browser origin, used for CORS. Match SITE_ADDRESS over https.
CORS_ORIGIN=https://ttah.internal
```

> In Compose the API's `DATABASE_URL` is composed automatically as
> `postgresql://<user>:<pass>@postgres:5432/<db>` — you only need the
> `POSTGRES_*` values. The `DATABASE_URL` line in `.env.example` is ignored by
> the containers.

### 4. Configure accounts (`config/users.yml`)

Edit `config/users.yml` and **change every `initialPassword`** before first
launch. Each listed user is created on first API start and is forced to change
their password at first login. Removing a user later deactivates the account
(data is kept).

### 5. Ensure database migrations exist

Production runs `prisma migrate deploy`, which applies committed migration files
from `apps/api/prisma/migrations/`. Make sure that folder exists in your
checkout (it is created in dev with `prisma migrate dev` — see
[deploy-dev.md](deploy-dev.md) step 6 — and committed to Git).

If you are deploying a fresh repo that has **no migrations yet**, you can create
the schema once after the stack is up using the fallback in step 7.

### 6. Build and start the stack

```bash
docker compose --env-file .env up -d --build
docker compose ps        # all services should be "running"/"healthy"
docker compose logs -f api   # watch the API apply migrations and start
```

The API container runs `prisma migrate deploy` and then starts listening. Wait
until you see the API "listening on port 4000" line.

### 7. Initialize data (once)

Seed the default computation settings and export templates:

```bash
docker compose exec api pnpm --filter @ttah/api prisma:seed
```

**Fallback** — only if you had no migration files in step 5 and the tables were
not created, push the schema directly, then seed:

```bash
docker compose exec api pnpm --filter @ttah/api exec prisma db push
docker compose exec api pnpm --filter @ttah/api prisma:seed
```

### 8. Verify

Open `https://<SITE_ADDRESS>/` in a browser. You should reach the login page.
Sign in with an account from `config/users.yml` (e.g. `admin` and its
`initialPassword`) and set a new password when prompted.

### 9. TLS / hostname

By default the `Caddyfile` uses `tls internal` — Caddy issues a **self-signed**
certificate. This is intended for internal/VPN use; browsers will show a trust
warning unless you distribute Caddy's local CA (found under the `caddy_data`
volume at `/data/caddy/pki/authorities/local/root.crt`).

To serve a **public domain with a trusted (Let's Encrypt) certificate**:

1. Point the domain's DNS `A` record at the server.
2. Open inbound ports **80 and 443** to the internet.
3. In `.env` set `SITE_ADDRESS=your.domain.com` (and `CORS_ORIGIN=https://your.domain.com`).
4. In `Caddyfile` remove the `tls internal` line so Caddy provisions a real cert.
5. `docker compose up -d` to reload.

### 10. Firewall

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 11. Backups

A helper script dumps the database as a compressed file into `backups/`:

```bash
./scripts/backup.sh
```

Schedule daily backups with cron (`crontab -e`):

```cron
0 2 * * * /opt/ttah/scripts/backup.sh >> /var/log/ttah-backup.log 2>&1
```

Restore from a backup (this **overwrites** current data):

```bash
./scripts/restore.sh backups/ttah_YYYYmmdd_HHMMSS.sql.gz
```

### 12. Updates

Pull the latest code, rebuild, and restart:

```bash
./scripts/update.sh
```

This runs `git pull`, `docker compose up -d --build` (migrations re-apply on API
startup), and prunes dangling images.

### 13. Logs & operations

```bash
docker compose logs -f                # all services
docker compose logs -f api            # just the API
docker compose restart api            # restart one service
docker compose down                   # stop the stack (keeps volumes/data)
docker compose down -v                # stop AND delete data volumes (danger!)
```

---

## Part B — Windows Server

The same Compose stack runs on Windows via Docker Desktop. Use **PowerShell**;
the `.sh` helper scripts in `scripts/` are for Ubuntu, so PowerShell equivalents
are given below.

### 1. Prerequisites

- **Windows Server 2022** (or Windows 10/11) with the **WSL2** feature enabled.
- **Docker Desktop** with the WSL2 backend and *Start on login* enabled.
- **Git for Windows**.

```powershell
winget install Docker.DockerDesktop
winget install Git.Git
wsl --install    # if WSL2 is not yet enabled; reboot if prompted
docker compose version
```

### 2. Get the code

```powershell
git clone <your-repo-url> C:\ttah
Set-Location C:\ttah
```

### 3. Configure `.env`

```powershell
Copy-Item .env.example .env
# generate two secrets (run twice), paste each into .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Edit `.env` with the **same production values as Ubuntu step 3**
(`POSTGRES_PASSWORD`, `JWT_*` secrets, `COOKIE_SECURE=true`, `SITE_ADDRESS`,
`CORS_ORIGIN`).

If you do not have Node installed on the server, generate secrets inside a
container instead:

```powershell
docker run --rm node:22-alpine node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Configure accounts

Edit `config/users.yml` and change every `initialPassword` (see Ubuntu step 4).

### 5. Migrations

Same requirement as Ubuntu step 5: `apps/api/prisma/migrations/` must be present
in the checkout, or use the fallback in step 7.

### 6. Build and start

```powershell
docker compose --env-file .env up -d --build
docker compose ps
docker compose logs -f api
```

### 7. Initialize data (once)

```powershell
docker compose exec api pnpm --filter @ttah/api prisma:seed
```

Fallback if tables were not created (no migration files):

```powershell
docker compose exec api pnpm --filter @ttah/api exec prisma db push
docker compose exec api pnpm --filter @ttah/api prisma:seed
```

### 8. Verify, TLS, hostname

Identical to Ubuntu steps 8–9 (open `https://<SITE_ADDRESS>/`, self-signed by
default, edit `Caddyfile` + `.env` for a public domain).

### 9. Firewall

Allow inbound 80/443 (run PowerShell as Administrator):

```powershell
New-NetFirewallRule -DisplayName "TTAH HTTP"  -Direction Inbound -Protocol TCP -LocalPort 80  -Action Allow
New-NetFirewallRule -DisplayName "TTAH HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

### 10. Backups (PowerShell)

Dump **inside the container** and copy the file out — this avoids PowerShell's
pipeline corrupting the compressed output:

```powershell
New-Item -ItemType Directory -Force backups | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
docker compose exec -T postgres sh -c "pg_dump -U ttah ttah | gzip -c > /tmp/ttah.sql.gz"
docker compose cp postgres:/tmp/ttah.sql.gz "backups\ttah_$stamp.sql.gz"
docker compose exec -T postgres rm -f /tmp/ttah.sql.gz
```

Schedule it daily with Task Scheduler pointing at a `.ps1` containing the lines
above. Restore (overwrites data):

```powershell
docker compose cp "backups\ttah_YYYYMMdd_HHmmss.sql.gz" postgres:/tmp/restore.sql.gz
docker compose exec -T postgres sh -c "gunzip -c /tmp/restore.sql.gz | psql -U ttah -d ttah"
docker compose exec -T postgres rm -f /tmp/restore.sql.gz
```

### 11. Updates (PowerShell)

```powershell
git pull --ff-only
docker compose --env-file .env up -d --build
docker image prune -f
```

### 12. Logs & operations

Same `docker compose` commands as Ubuntu step 13 (run them in PowerShell).

---

## Production troubleshooting

| Symptom | Fix |
| ------- | --- |
| Browser shows a certificate warning | Expected with the default `tls internal`. Trust Caddy's local CA, or switch to a public domain (step 9 / A-9). |
| Login page loads but no account works | `config/users.yml` not updated or not mounted. Check `docker compose logs api` for the user-sync lines; ensure the `./config` volume is mounted. |
| API restarts / "relation does not exist" errors | Migrations were not applied. Confirm `apps/api/prisma/migrations/` is committed, or run the step 7 fallback (`prisma db push`). |
| `web` cannot reach the API | Check `API_INTERNAL_URL=http://api:4000` (Compose default) and that the `api` service is healthy. |
| Cookies not set / immediate logout | Must be served over HTTPS with `COOKIE_SECURE=true`. Verify you browse via `https://` through Caddy. |
| Port 80/443 already in use | Another web server/IIS is bound. Stop it or change Caddy's published ports in `docker-compose.yml`. |
| Data lost after `down -v` | `-v` deletes the `pgdata` volume. Never use it in production; restore from a backup. |

For local development see [deploy-dev.md](deploy-dev.md).
