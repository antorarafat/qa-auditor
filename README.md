# 10MS QA Auditor

This app now runs through a Node backend. The backend authenticates users from the `user` tab in the `QA Auditor` spreadsheet and keeps provider API keys server-side.

The `company` tab contains the global company name. The `product_brief` tab supplies `Category`, `Sub-Category`, and `Brief`; the portal exposes searchable shadcn multi-selects while the full briefs stay server-side. Category and sub-category selections are optional: no selection produces a generic audit, while selected products add their sheet context. The `qa_scorecard` tab supplies the default scorecard, which users can optionally customize in the portal.

The interface defaults to English and includes an English/Bangla toggle. Audit reports remain Bangla regardless of the selected interface language.

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `GOOGLE_SHEETS_ID`, `SESSION_SECRET`, and `GOOGLE_SERVICE_ACCOUNT_JSON` in `.env`.
3. Ensure the service account has access to the spreadsheet. Editor access is required for the `Usage` counter.
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

Compose reads the service-account JSON from the ignored `.env` file. It is not copied into the image. The app is available at `http://localhost:3000/` and exposes a container health check at `/healthz`.

Stop it with:

```sh
docker compose down
```

## Production notes

- Store the service-account credential and `SESSION_SECRET` in the hosting provider’s secret manager.
- Do not commit the existing service-account JSON; rotate/revoke that key before production if it has ever been shared or committed.
- Set `NODE_ENV=production`, `PUBLIC_ORIGIN` to the exact deployed origin, and use HTTPS.
- The current spreadsheet password columns are plaintext by design for compatibility with the selected rollout. Restrict spreadsheet sharing to administrators and the backend service account.
- AI results are cached in memory per user/provider/prompt/audio fingerprint. Configure `AI_CACHE_TTL_MS` and `AI_CACHE_MAX_ENTRIES`; the cache resets when the container restarts.
