# wellConnect Wellness API — Request Types Reference

Generated from NestJS controllers and class-validator DTOs.

- **Base URL:** `http://<host>:3000`
- **API prefix:** `/api/v1` (except `GET /health`)
- **Swagger:** `/api/docs`

## Conventions

- Successful responses (except health): `{ "success": true, "data": <payload> }`
- Error responses: `{ "success": false, "error": { "code", "message", "details" }, "requestId" }`
- Content-Type for bodies: `application/json`
- JWT claims (when auth enabled): `sub` = wellnessUserId, `propertyId`, `role`
- Auth guards are currently commented out for local testing; production intends Bearer JWT
- Validation: whitelist + forbidNonWhitelisted; unknown fields are rejected

---

## Endpoint index

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | None | API + DB health (no `/api/v1` prefix) |
| POST | `/api/v1/auth/dev-token` | None (`AUTH_DEV_MODE`) | Issue development JWT |
| POST | `/api/v1/wellness/health-data` | Bearer (intended) | Ingest Health Connect data |
| GET | `/api/v1/wellness/profile` | Bearer (intended) | Latest wellness profile |
| GET | `/api/v1/wellness/recommendations` | Bearer (intended) | List recommendations |
| POST | `/api/v1/wellness/recommendations/generate` | Bearer (intended) | Generate recommendation |
| POST | `/api/v1/wellness/feedback` | Bearer (intended) | Submit feedback |
| POST | `/api/v1/notifications/devices` | Bearer (intended) | Register FCM device |
| POST | `/api/v1/notifications/test-push` | Bearer (intended) | Send immediate test FCM push |
| POST | `/api/v1/notifications/:id/opened` | Bearer (intended) | Mark notification opened |
| POST | `/api/v1/notifications/:id/actioned` | Bearer (intended) | Mark notification actioned |
| GET | `/api/v1/properties/:propertyId/features` | Bearer (intended) | List property features |
| POST | `/api/v1/properties/:propertyId/features` | Bearer + `PROPERTY_ADMIN` | Create property feature |

---

## 1. Auth

### `POST /api/v1/auth/dev-token`

**Request type:** `DevTokenDto`  
**Auth:** None. Enabled only when `AUTH_DEV_MODE=true`.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `wellnessUserId` | string | Yes | 1–64 chars; `^[A-Za-z0-9_-]+$` |
| `propertyId` | string | Yes | 1–64 chars; `^[A-Za-z0-9_-]+$` |
| `role` | enum | No | `RESIDENT` \| `PROPERTY_ADMIN` (default `RESIDENT`) |

```json
{
  "wellnessUserId": "wu_recovery_001",
  "propertyId": "property_001",
  "role": "RESIDENT"
}
```

---

## 2. Health

### `GET /health`

**Request type:** None  
**Auth:** None · Not under `/api/v1` · Not response-wrapped

Response: `{ status, database, timestamp, environment }`

---

## 3. Wellness — Health data

### `POST /api/v1/wellness/health-data`

**Request type:** `SubmitHealthDataDto`  
**Auth:** Bearer JWT (intended); throttle 30 req / 60s

#### Top-level

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `schemaVersion` | string | Yes | Must equal `"1.0"` |
| `userContext` | `UserContextDto` | Yes | Resident + app context |
| `dataContext` | `DataContextDto` | Yes | Window metadata |
| `dailyHealthData` | `DailyHealthDataDto[]` | Yes | 1–14 days; unique dates |

#### `userContext`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `wellnessUserId` | string | Yes | Must match JWT `sub` |
| `propertyId` | string | Yes | Must match JWT `propertyId` |
| `appVersion` | string | Yes | Max 32 |
| `platform` | enum | Yes | `ANDROID` \| `IOS` |
| `timezone` | string | Yes | IANA tz, max 64 |
| `deviceId` | string | No | With `fcmToken`, upserts `NotificationDevice` |
| `fcmToken` | string | No | With `deviceId`, upserts `NotificationDevice` |
| `notificationsEnabled` | boolean | No | Defaults to `true` when registering |

#### `dataContext`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `generatedAt` | ISO-8601 | Yes | e.g. `2026-09-29T10:30:00+05:30` |
| `dataFrom` | `YYYY-MM-DD` | Yes | Inclusive start |
| `dataTo` | `YYYY-MM-DD` | Yes | Inclusive end |
| `daysAvailable` | integer | Yes | 1–14 |

#### `dailyHealthData[]` item

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `date` | `YYYY-MM-DD` | Yes | Unique within array |
| `steps` | integer | Yes | 0–100000 |
| `distanceMeters` | integer | Yes | 0–200000 |
| `activeCalories` | integer | Yes | 0–20000 |
| `restingHeartRate` | integer\|null | No | 30–220 |
| `averageHeartRate` | integer\|null | No | 30–220 |
| `sleepMinutes` | integer\|null | No | 0–1440 |
| `dataAvailability` | object | Yes | Boolean flags per metric |

#### `dataAvailability`

| Field | Type | Required |
|-------|------|----------|
| `steps` | boolean | Yes |
| `distance` | boolean | Yes |
| `activeCalories` | boolean | Yes |
| `restingHeartRate` | boolean | Yes |
| `averageHeartRate` | boolean | Yes |
| `sleep` | boolean | Yes |

```json
{
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
  "dailyHealthData": [
    {
      "date": "2026-09-23",
      "steps": 9800,
      "distanceMeters": 7350,
      "activeCalories": 490,
      "restingHeartRate": 66,
      "averageHeartRate": 80,
      "sleepMinutes": 340,
      "dataAvailability": {
        "steps": true,
        "distance": true,
        "activeCalories": true,
        "restingHeartRate": true,
        "averageHeartRate": true,
        "sleep": true
      }
    }
  ]
}
```

---

## 4. Wellness — Profile & recommendations

All of these routes require `wellnessUserId` as a query param so the response is scoped to that resident (same id used for health-data and device registration).

### `GET /api/v1/wellness/profile?wellnessUserId=wu_…`

| Query | Required | Notes |
|-------|----------|-------|
| `wellnessUserId` | Yes | Dynamic resident id |
| `propertyId` | No | Defaults via auth/context |

### `GET /api/v1/wellness/recommendations?wellnessUserId=wu_…`

| Query | Required | Notes |
|-------|----------|-------|
| `wellnessUserId` | Yes | Returns up to 20 recent recommendations for this user only |
| `propertyId` | No | |

### `GET /api/v1/wellness/recommendations/today?wellnessUserId=wu_…`

| Query | Required | Notes |
|-------|----------|-------|
| `wellnessUserId` | Yes | |
| `date` | No | `YYYY-MM-DD`, defaults to current UTC day |
| `propertyId` | No | |

### `POST /api/v1/wellness/recommendations/generate?wellnessUserId=wu_…`

| Query | Required | Notes |
|-------|----------|-------|
| `wellnessUserId` | Yes | Generates from stored health data for this user |
| `propertyId` | No | |

Empty body.
---

## 5. Wellness — Feedback

### `POST /api/v1/wellness/feedback`

**Request type:** `SubmitFeedbackDto`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `recommendationId` | string | Yes | 1–64 chars |
| `action` | enum | Yes | `SHOWN` \| `OPENED` \| `CLICKED` \| `BOOKED` \| `COMPLETED` \| `DISMISSED` \| `NOT_INTERESTED` |
| `rating` | integer | No | 1–5 |
| `feedback` | string | No | Max 500 chars |

```json
{
  "recommendationId": "rec_8f92ab",
  "action": "CLICKED",
  "rating": 5,
  "feedback": "Nice suggestion"
}
```

---

## 6. Notifications

### `POST /api/v1/notifications/devices`

**Request type:** `RegisterDeviceDto`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `wellnessUserId` | string | Yes | Dynamic resident id — device is stored under this user |
| `propertyId` | string | Yes | Property the resident belongs to |
| `deviceId` | string | Yes | 1–128 chars |
| `platform` | enum | Yes | `ANDROID` \| `IOS` |
| `fcmToken` | string | Yes | 1–4096 chars |
| `appVersion` | string | Yes | Max 32 |
| `timezone` | string | No | Defaults to `Asia/Kolkata` when creating the user |
| `notificationsEnabled` | boolean | No | Optional |

```json
{
  "wellnessUserId": "wu_a3cfcd1bc9824269",
  "propertyId": "property_001",
  "deviceId": "device-123",
  "platform": "ANDROID",
  "fcmToken": "fcm-token-from-firebase-sdk",
  "appVersion": "1.0.0",
  "notificationsEnabled": true
}
```

### `POST /api/v1/notifications/test-push`

**Request type:** `SendTestPushDto`  
Sends an FCM push immediately to the caller's registered enabled devices. Bypasses quiet hours, cooldown, and recommendation generation. Requires Firebase env vars and a prior device registration.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | No | Default: `WellConnect test` |
| `body` | string | No | Default test message |
| `deviceId` | string | No | Limit send to one registered device |
| `featureId` | string | No | Optional data payload field |
| `deepLink` | string | No | Optional data payload field |

```json
{
  "title": "WellConnect test",
  "body": "If you see this, FCM delivery is working.",
  "deviceId": "device-123"
}
```

### `POST /api/v1/notifications/:id/opened`

**Request type:** Path param only — `id` (notification id). No JSON body.

### `POST /api/v1/notifications/:id/actioned`

**Request type:** Path param only — `id` (notification id). No JSON body.

---

## 7. Properties

### `GET /api/v1/properties/:propertyId/features`

**Request type:** Path param only — `propertyId`. No JSON body.

### `POST /api/v1/properties/:propertyId/features`

**Request type:** `CreateFeatureDto` + path `propertyId`  
**Auth:** Bearer + role `PROPERTY_ADMIN` (intended)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `propertyId` (path) | string | Yes | Target property |
| `featureId` | string | Yes | `^[a-z0-9_]+$`, max 64 |
| `featureType` | string | Yes | `^[A-Z0-9_]+$`, max 32 |
| `name` | string | Yes | 1–80 chars |
| `category` | string | Yes | 1–32 |
| `serviceId` | string | No | Max 64 |
| `outletId` | string | No | Max 64 |
| `enabled` | boolean | No | |
| `available` | boolean | No | |
| `deepLink` | string | Yes | `^app://[A-Za-z0-9/_-]+$` |
| `tags` | string[] | No | e.g. `["recovery"]` |

```json
{
  "featureId": "service_spa",
  "featureType": "SPA",
  "name": "Spa",
  "category": "WELLNESS",
  "serviceId": "spa",
  "enabled": true,
  "available": true,
  "deepLink": "app://service/spa",
  "tags": ["recovery", "relaxation"]
}
```

---

## Shared DTO summary

**Body DTOs:** `DevTokenDto`, `SubmitHealthDataDto`, `SubmitFeedbackDto`, `RegisterDeviceDto`, `CreateFeatureDto`

**No body / path-only:** health, profile, list recommendations, generate, notification opened/actioned, list features
