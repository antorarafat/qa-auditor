# 10MS QA Auditor

The portal runs through a Node backend and MongoDB. The five primary collections preserve the original business datasets:

- `user`: authentication, provider keys, usage, and default QA parameter
- `company`: global company name
- `product_brief`: searchable category/sub-category product facts
- `qa_scorecard`: live parameters, weighted rubric rows, and critical-error rules
- `audit_result`: append-only QA report history

MongoDB also stores `analysis_jobs`, `analysis_cache`, `rate_limit_state`, and GridFS `audio_files` data. These support persistent queued work, duplicate-request coalescing, six-hour result caching, and controlled Gemini request spacing without changing report content.

QA Scorecard evaluates uploaded calls and renders one report per successful call plus a server-generated run summary. Customer Voice and Advisor Coaching remain summary-only. All three modes use `gemini-3.6-flash`. Report layouts are loaded from `templates/` on every run.

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI`, `MONGODB_DATABASE`, and `SESSION_SECRET`.
3. Install and start:

```sh
npm install
npm start
```

Open `http://localhost:3000/`.

## Docker

```sh
docker compose up --build -d
```

The local `templates/` directory is mounted read-only at `/app/templates`. Health is available at `/healthz` and includes MongoDB connectivity.

## Queue and cache

- `AI_MIN_START_INTERVAL_MS` controls the minimum interval between Gemini job starts.
- `AI_RATE_LIMIT_COOLDOWN_MS` controls the minimum global cooldown after a `429`.
- `AI_WORKER_LEASE_MS` keeps the one-active-request rule global across multiple containers.
- `AI_CACHE_TTL_MS` controls persistent MongoDB result-cache duration.
- Jobs and uploaded audio survive browser refreshes and application restarts.
- Identical active submissions share one job; successful identical runs use the persistent cache.

## Production

Keep MongoDB credentials, provider API keys, and `SESSION_SECRET` outside Git. Set `NODE_ENV=production`, configure the exact HTTPS origin, and mount `templates/` read-only.
