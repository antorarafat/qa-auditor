# 10MS QA Auditor

This app now runs through a Node backend. The backend authenticates users from the `user` tab in the `QA Auditor` spreadsheet and keeps provider API keys server-side.

The `company` tab contains the global company name. The `product_brief` tab supplies optional product context through searchable multi-selects. The `qa_scorecard` tab is the live source of QA parameters, rubric rows, weights, and critical-error rules; the portal does not edit rubric content.

QA Scorecard evaluates every uploaded call independently, renders one report per successful call plus one run summary, and batch-appends successful calls to `audit_result`. Customer Voice and Advisor Coaching remain summary-only and do not write report history. All report layouts are loaded from `templates/` on every run, so approved copy changes take effect without a rebuild.

The interface defaults to English and includes an English/Bangla toggle. Audit reports remain Bangla regardless of the selected interface language.

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `GOOGLE_SHEETS_ID`, `SESSION_SECRET`, and `GOOGLE_SERVICE_ACCOUNT_JSON` in `.env`.
3. Ensure the service account has editor access to the spreadsheet for usage, saved parameter defaults, and QA audit history.
4. Install and start:

```sh
npm install
npm start
```

Open `http://localhost:3000/`.

The backend serves only the application HTML and API routes. It does not expose arbitrary files or the service-account credential file.

## Docker

Create `.env` from `.env.example`, then start the container:

```sh
cp .env.example .env
docker compose up --build -d
```

Compose reads the service-account JSON from the ignored `.env` file. It is not copied into the image. The local `templates/` folder is mounted read-only at `/app/templates`. The app is available at `http://localhost:3000/` and exposes a container health check at `/healthz`.

Stop it with:

```sh
docker compose down
```

## Production notes

- Store the service-account credential and `SESSION_SECRET` in the hosting provider’s secret manager.
- Do not commit the existing service-account JSON; rotate/revoke that key before production if it has ever been shared or committed.
- Set `NODE_ENV=production`, `PUBLIC_ORIGIN` to the exact deployed origin, and use HTTPS.
- The current spreadsheet password columns are plaintext by design for compatibility with the selected rollout. Restrict spreadsheet sharing to administrators and the backend service account.
- QA Scorecard results are never cached, so every re-audit is fresh and append-only. Safe caching remains enabled for Customer Voice and Advisor Coaching; configure it with `AI_CACHE_TTL_MS` and `AI_CACHE_MAX_ENTRIES`.
