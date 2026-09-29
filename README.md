# wellConnect

Wellness backend for a premium residential and hospitality Android app. The phone reads Health Connect, normalizes the data, and sends it here. This service stores it against a pseudonymous resident id, calculates a 7-day wellness profile, chooses a wellness state with deterministic rules, and only then asks an AI provider to phrase a recommendation from facilities that actually exist at the resident's property.

AI does not decide the wellness state, invent services, or send push notifications. Firebase is called only after recommendation validation and notification policy.

## Stack

- Node.js and NestJS
- TypeScript
- PostgreSQL through Prisma (`DATABASE_URL` only)
- JWT authentication abstraction
- class-validator
- Firebase Admin SDK
- OpenAI behind a provider interface, with a required demo provider
- Jest and Swagger

Prisma 6 is used so the database URL stays in `prisma/schema.prisma` and the same app runs against local PostgreSQL or Supabase PostgreSQL.

## Assumptions

- `wellnessUserId` is the only resident identifier. The API rejects a body user or property that does not match the JWT.
- `POST /api/v1/auth/dev-token` exists only when `AUTH_DEV_MODE=true`. Replace it with the host app's token issuer later. The JWT claims are `sub` (wellness user id), `propertyId`, and `role`.
- Activity bands: high is at least 7,500 steps, moderate is at least 4,000, otherwise low. Sleep bands: high is at least 420 minutes, moderate is at least 390, otherwise low. Fewer than 3 usable days is insufficient data.
- High activity plus low sleep is `RECOVERY_NEEDED`. Low activity plus moderate or high sleep is `LOW_ACTIVITY`. High activity plus adequate sleep is `ACTIVE`. Moderate activity and sleep is `BALANCED`. Low sleep without high activity is `SLEEP_FOCUS`.
- Quiet hours default to 22:00–07:00 in the resident timezone. High priority can send during quiet hours. Recommendation cooldown is 20 hours per feature. Notification cooldown is 4 hours.
- An unexpired recommendation is reused for the same reason code. If the resident dismisses that feature, the next generation can choose another eligible feature and the preference score is already updated.
- `DEMO_MODE=true` never calls OpenAI. If demo mode is off but the OpenAI key or model is missing, the demo provider is used and a warning is logged.
- Notifications are stored immediately and sent by an in-process worker every 15 seconds. That worker is the queue boundary. Kafka, RabbitMQ, and Redis are not required. If Firebase credentials are absent, the notification stays `CREATED` or `SCHEDULED` and is not marked failed.
- Weekly summary scheduling is represented by the `WEEKLY_WELLNESS_SUMMARY` type. This prototype generates `WELLNESS_RECOMMENDATION` and `DAILY_WELLNESS` only.
- These outputs are wellness indicators. They are not medical diagnoses.

## Local database

Docker Compose starts PostgreSQL 16:

```bash
docker compose up -d
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run start:dev
```

`DATABASE_URL` in `.env.example` matches the Compose database:

```text
postgresql://wellconnect:wellconnect@localhost:5432/wellconnect?schema=public
```

Useful checks:

- Health: `GET http://localhost:3000/health`
- Swagger: `http://localhost:3000/api/docs`

## Supabase database

No Supabase SDK is used. Point `DATABASE_URL` at the Supabase Postgres connection string and run the same Prisma commands.

1. Create a Supabase project.
2. Open Project Settings → Database → Connection string and copy the URI.
3. Use the direct connection, or the session pooler, on port 5432. Put it in `DATABASE_URL`. Add `?sslmode=require` if the host requires TLS.
4. Keep `JWT_SECRET`, `DEMO_MODE`, and the other variables from `.env.example`.
5. Run:

```bash
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run start:dev
```

Do not use the transaction pooler (port 6543) for Prisma migrations.

## Demo mode

```text
DEMO_MODE=true
```

No `OPENAI_API_KEY` is required. The demo provider returns the same structured recommendation as the OpenAI provider. For the seeded recovery resident and an available spa, the title is "Time to unwind" and the feature is `service_spa`.

## OpenAI

```text
DEMO_MODE=false
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

The model name is read from `OPENAI_MODEL`. The guide receives activity, sleep, and recovery levels plus the candidate list. It does not receive raw step counts, heart rate, or sleep minutes. The validator rejects unknown features, mismatched deep links, malformed JSON, and medical claims. The stored deep link always comes from `PropertyFeature`.

## Firebase Cloud Messaging

Set these on the server only:

```text
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

`FIREBASE_PRIVATE_KEY` can contain escaped `\n` newlines. The mobile app registers its token with `POST /api/v1/notifications/devices`. It never receives the Firebase private key.

The push payload is:

```json
{
  "notification": { "title": "Time to unwind", "body": "..." },
  "data": {
    "notificationId": "ntf_...",
    "recommendationId": "rec_...",
    "type": "WELLNESS_RECOMMENDATION",
    "featureId": "service_spa",
    "deepLink": "app://service/spa",
    "schemaVersion": "1.0"
  }
}
```

## API examples

Successful responses use `{ "success": true, "data": {} }`. Errors use `{ "success": false, "error": { "code", "message", "details" }, "requestId" }`. `GET /health` is not wrapped.

Issue a development token:

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/dev-token \
  -H 'Content-Type: application/json' \
  -d '{"wellnessUserId":"wu_recovery_001","propertyId":"property_001"}'
```

Submit health data:

```bash
curl -s -X POST http://localhost:3000/api/v1/wellness/health-data \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "schemaVersion": "1.0",
    "userContext": {
      "wellnessUserId": "wu_recovery_001",
      "propertyId": "property_001",
      "appVersion": "1.0.0",
      "platform": "ANDROID",
      "timezone": "Asia/Kolkata"
    },
    "dataContext": {
      "generatedAt": "2026-09-29T10:30:00+05:30",
      "dataFrom": "2026-09-23",
      "dataTo": "2026-09-29",
      "daysAvailable": 7
    },
    "dailyHealthData": []
  }'
```

Seeded residents already have seven days. You can regenerate without uploading:

```bash
curl -s -X POST http://localhost:3000/api/v1/wellness/recommendations/generate \
  -H "Authorization: Bearer $TOKEN"
```

Other routes:

- `GET /api/v1/wellness/profile`
- `GET /api/v1/wellness/recommendations`
- `GET /api/v1/wellness/recommendations/today?date=YYYY-MM-DD&propertyId=property_001`
- `POST /api/v1/wellness/feedback`
- `POST /api/v1/notifications/devices`
- `POST /api/v1/notifications/:id/opened`
- `POST /api/v1/notifications/:id/actioned`
- `GET /api/v1/properties/:propertyId/features`
- `POST /api/v1/properties/:propertyId/features` (role `PROPERTY_ADMIN`)

Feedback:

```bash
curl -s -X POST http://localhost:3000/api/v1/wellness/feedback \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"recommendationId":"rec_123","action":"CLICKED","rating":5,"feedback":"Nice suggestion"}'
```

Actions: `SHOWN`, `OPENED`, `CLICKED`, `BOOKED`, `COMPLETED`, `DISMISSED`, `NOT_INTERESTED`.

Seeded identities, all synthetic:

| Wellness user | Expected state | Pattern |
| --- | --- | --- |
| `wu_recovery_001` | `RECOVERY_NEEDED` | High steps, lighter sleep |
| `wu_low_activity_001` | `LOW_ACTIVITY` | Low steps, normal sleep |
| `wu_active_001` | `ACTIVE` | High steps, solid sleep |

Property `property_001` includes Gym (`app://facility/gym`), Swimming Pool (`app://facility/pool`), Spa (`app://service/spa`), and Restaurant (`app://outlet/restaurant`).

## Scripts

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run start:dev
npm test
npm run lint
npm run build
```

## Environment variables

See `.env.example`. Required: `DATABASE_URL`, `JWT_SECRET` (at least 16 characters). Do not commit `.env`.
