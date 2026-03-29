# API Reference

> Base URL: `/api/v1`
> Auth: Auth0 Bearer token required on all endpoints unless noted **Auth required: No**
> Error envelope: `{ "error": { "code": string, "message": string, "details"?: [...] } }`

---

## Conventions

### Authentication

Protected endpoints require an `Authorization: Bearer <token>` header containing a valid Auth0 JWT.
The token is validated against `https://${AUTH0_DOMAIN}/.well-known/jwks.json` using RS256.

### Error Codes

| HTTP status | Code | Meaning |
|-------------|------|---------|
| 400 | `VALIDATION_ERROR` | Request body / query / params failed Zod validation |
| 401 | `UNAUTHENTICATED` | Missing or invalid Bearer token |
| 403 | `FORBIDDEN` | Authenticated but not authorised to access this resource |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Resource already exists or state conflict |
| 422 | `UNPROCESSABLE` | Semantically invalid request |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## Health

#### GET /api/v1/health

**Auth required**: No
**Description**: Returns the liveness status of the server and its database connection. Used by load balancers and monitoring tools.

**Response 200**:
```json
{
  "status": "ok",
  "db": "connected",
  "timestamp": "2026-03-29T00:00:00.000Z"
}
```

**Error codes**:
- `500` — Database unreachable

---

## Auth

> Routes to be added in task #004.

---

## Users

> Routes to be added in task #004.

---

## Listings

> Routes to be added in task #006.

---

## Conversations & Messages

> Routes to be added in task #008.

---

## Reviews

> Routes to be added in task #009.
