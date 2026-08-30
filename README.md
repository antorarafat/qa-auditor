# QA Auditor

A secure multi-user call-audit portal with QA Scorecard, Customer Voice, and Advisor Coaching reports. It uses personal Gemini or OpenAI keys, MongoDB-backed sessions and queues, durable report history, and live product/scorecard configuration.

The application does not ship with company data, scorecards, API keys, passwords, recordings, or reports.

## User guide

For non-technical QA users, managers, and administrators, see the [QA Auditor User Guide](USERGUIDE.md). It includes step-by-step workflows, role permissions, report filters, re-auditing, and screenshots.

![Reports table](docs/screenshots/reports-table.png)

## Stored data

- `user`: roles, Argon2id password hashes, and AES-256-GCM encrypted personal API keys
- `sessions`: hashed browser sessions with automatic expiry
- `company`, `product_brief`, and `qa_scorecard`: current configuration
- `report_runs`: complete history for all three modes
- `report_records`: one filterable record per evaluated call plus stored summaries (timestamp, process, agent, duration, score, CE)
- `audit_result`: compatible QA columns plus ownership, job, file, and snapshot metadata
- `analysis_jobs`, `analysis_cache`, `rate_limit_state`, and GridFS `audio_files`: reliable queued analysis

Reports default to month-to-date and support agent, process, score, CE, owner, and text filters. Each QA file in a multi-call run is evaluated sequentially and saved independently.

## First installation with Docker

Requirements: Docker Compose and MongoDB. Use MongoDB TLS whenever it is reached over the internet.

### Guided installation (recommended)

The installer asks for the MongoDB URI, database, public origin, host port, optional LAN/Tailscale addresses, and deployment namespace. It always allows `localhost` and `127.0.0.1`; entering a LAN or Tailscale IPv4 adds that address to the browser request allowlist. It generates `SESSION_SECRET`, `APP_ENCRYPTION_KEY`, and `SETUP_TOKEN`, writes a mode-600 `.env`, builds the image, and starts the service:

```sh
./scripts/install_docker.sh
```

The default host port is **3423**, so the local address is `http://localhost:3423`. To review the connection details and setup token later:

```sh
./scripts/credential.sh
```

The helper masks the MongoDB password. Use `./scripts/credential.sh --show-secrets` only on a trusted terminal.

For a MongoDB server running on the same host as Docker, enter a URI using `host.docker.internal`, for example:

```text
mongodb://USER:PASSWORD@host.docker.internal:27017/10ms-qaaudit?authSource=admin
```

For an external MongoDB server, enter its hostname or SRV URI, normally with TLS:

```text
mongodb+srv://USER:PASSWORD@cluster.example/10ms-qaaudit
```

Compose maps `host.docker.internal` to the Docker host with `host-gateway`. This is needed on Linux because containers otherwise resolve `localhost` to the container itself; it is harmless on Docker Desktop.

1. Copy the environment template: `cp .env.example .env`.
2. Generate three independent secrets:

   ```sh
   openssl rand -base64 48   # SESSION_SECRET
   openssl rand -base64 32   # APP_ENCRYPTION_KEY (exactly 32 decoded bytes)
   openssl rand -base64 48   # SETUP_TOKEN
   ```

3. Set `MONGODB_URI`, `MONGODB_DATABASE`, the generated secrets, exact public HTTPS origin, and a unique `DEPLOYMENT_NAMESPACE` in `.env`. A hosted MongoDB URI will commonly include `tls=true`; follow your provider’s instructions.
4. Set `HOST_PORT=3423` (or another unused host port) and run `docker compose up --build -d`.
5. Open `/setup`. Enter the `SETUP_TOKEN`, first administrator email, username, password, and company name. Setup permanently closes after that administrator is created.
6. Sign in. Add your personal provider key under **Account security**, then add products and a scorecard under **Admin**.

MongoDB creates the database on its first write. Startup automatically creates collections, validators, indexes, TTL rules, and idempotent migration records.

## Native Node installation

Node.js 20 or newer is required.

For an interactive setup that defaults to port **3423**:

```sh
./scripts/install_native.sh
npm start
```

The native installer accepts `mongodb://USER:PASSWORD@127.0.0.1:27017/10ms-qaaudit` for a local MongoDB and an external/TLS URI such as `mongodb+srv://USER:PASSWORD@cluster.example/10ms-qaaudit`. It also asks for optional LAN and Tailscale addresses so users can sign in through those network URLs.

To configure manually instead, copy `.env.example` to `.env`, set `PORT`, MongoDB, and the generated secrets, then run `npm ci`, `npm run build`, and `npm start`.

Open `http://localhost:3000`. `npm run dev` runs the React development server.

## Product briefs

Open **Admin → Products**. Each entry has a category, sub-category, and factual brief. Entries can be edited and archived. Archived entries disappear from new audits without changing historical snapshots.

Fictional **Northstar Learning** example:

> Category: Professional Programs<br>
> Sub-category: Data Foundations<br>
> Brief: Twelve live classes, recordings available for 90 days, and weekday mentor support.

## Scorecards

Open **Admin → Scorecards**. Add a unique parameter name, overall total, categories, weighted rows, and critical-error rules. Weights must be positive; rows must total their category, and categories must total the overall score.

Generic example:

- `Consultation Call` — 100 points
- Opening — 20: Greeting 10, Permission 10
- Discovery — 40: Need identification 20, Relevant questions 20
- Guidance — 40: Accurate recommendation 25, Clear next step 15
- Critical error: knowingly providing a materially false product fact

Do not put secrets or personal customer data in a scorecard.

## Accounts and access

- Login uses email; username is the unique display name.
- Administrators create temporary-password users. They must replace that password before continuing.
- Password changes, resets, role changes, and deactivation revoke sessions.
- Administrators cannot see or manage another person’s provider keys.
- At least one active administrator must remain.
- Users see their own reports. Administrators may filter all reports.

### Network access policy

Administrators can open **Admin → Network access** to protect the entire application with IPv4/IPv6 addresses or CIDR ranges. A new installation starts with `0.0.0.0/0` and `::/0` enabled so the first administrator can connect from any VPS or network. Keep the current address in the list before saving a restrictive policy. The policy is stored in MongoDB and applies server-side to login, APIs, and the application UI. `localhost` and `127.0.0.1` are not automatically special once a restrictive policy is saved; add them if local access is needed. For emergency recovery, set `NETWORK_ALLOWLIST_DISABLED=true` in `.env`, restart the service, repair the policy, and set it back to `false`.

## Queue, cache, and Gemini free tier

- `AI_MIN_START_INTERVAL_MS` spaces requests by API-key fingerprint and primary model.
- `AI_RATE_LIMIT_COOLDOWN_MS` controls rate-limit cooldown.
- `AI_CACHE_TTL_MS` controls identical-result reuse. A cache hit reuses the original durable report and creates no duplicate history.
- `DEPLOYMENT_NAMESPACE` stops different deployments claiming one another’s jobs.
- QA uses one Gemini request per run and creates the summary locally. Fallback models are used only when required.

Free-tier provider limits still apply. If every configured model is out of quota, the portal returns a clear retryable error without losing queue state.

## OpenAI evidence pipeline

OpenAI audits use a cost-efficient two-stage path:

1. `gpt-audio-1.5` listens to each recording once and stores reusable timestamped evidence in MongoDB.
2. `gpt-5.6-luna` converts that evidence into the existing validated QA, Customer Voice, or Advisor Coaching report with `medium` reasoning.
3. If the report fails deterministic validation, only the text report stage is retried with `gpt-5.6-terra`. When a project has no Terra access, Luna receives one corrected retry with `high` reasoning instead; the audio is never submitted again.

Evidence is isolated per user and keyed by the recording hash, extractor model, and evidence version. It can be reused across report modes and future re-audits. The existing six-hour full-report cache remains active. Report history stores the actual models, reasoning effort, request/token usage, evidence-cache status, and an estimated API cost. A full-report cache hit costs no new provider request.

Configure the model path with `OPENAI_MODELS`, `OPENAI_REPORT_MODELS`, and `OPENAI_REASONING_EFFORT`. Model availability is controlled by the user’s OpenAI project; unavailable fallback models are skipped safely.

## Backup, migration, and upgrade

Always inspect and back up before migration:

```sh
npm run db:migrate:dry-run
npm run db:backup
npm run db:migrate
```

The backup contains all collections and GridFS objects and is encrypted with `APP_ENCRYPTION_KEY`. Store it away from the server. No plaintext migration export is created.

For upgrades: back up, pull, run the dry-run, rebuild, migrate, then verify `/healthz`, sign-in, provider connectivity, and report access.

### Key-loss warning

Losing `APP_ENCRYPTION_KEY` makes saved provider keys and backups encrypted with it unrecoverable. Rotation requires a decrypt-and-re-encrypt migration. Losing `SESSION_SECRET` invalidates browser sessions but not reports. Keep both in a secret manager.

## Verification

```sh
npm test
npm run build
npm audit
```

In production use HTTPS, `COOKIE_SECURE=true`, exact `PUBLIC_ORIGIN`/`PUBLIC_ORIGINS`, MongoDB TLS, and a unique production namespace.
