# TrustVault — REST API Specification & Architecture

> **Current Version**: v1.0.0-stage1  
> **Base URL**: `http://localhost:5000/api`  
> **Status**: Only the Health Check endpoint is active in Stage 1. All subsequent endpoints are reserved for later development stages.

---

## 1. Architectural Standards

- **Protocol**: HTTP/1.1 (Development) / HTTPS (Production)
- **Data Exchange Format**: JSON (`Content-Type: application/json`)
- **Authentication Strategy (Future Stages)**: JSON Web Tokens (JWT) passed via `Authorization: Bearer <token>`
- **Standard HTTP Response Codes**:
  - `200 OK`: Request succeeded.
  - `201 Created`: Resource successfully created.
  - `400 Bad Request`: Validation failure or malformed payload.
  - `401 Unauthorized`: Authentication credentials missing, invalid, or expired.
  - `403 Forbidden`: Authenticated user lacks permission for the specific resource.
  - `404 Not Found`: Resource does not exist or user lacks permission to confirm existence.
  - `413 Payload Too Large`: Uploaded file exceeds permitted size limit.
  - `415 Unsupported Media Type`: File signature does not match allowed MIME types.
  - `500 Internal Server Error`: Generic unhandled server error (sanitized in production).

---

## 2. Stage 1 Active Endpoints

### 2.1 Service Health Check

Returns the operational status, service identifier, and uptime of the TrustVault API.

- **Endpoint**: `GET /api/health`
- **Authentication**: None (Public)
- **Authorization**: None
- **Rate Limit**: Standard development rate limit
- **Security Policy**: Strictly suppresses environment variables, database credentials, internal disk paths, and server configuration.

#### Request
```http
GET /api/health HTTP/1.1
Host: localhost:5000
Accept: application/json
```

#### Response (200 OK)
```json
{
  "status": "ok",
  "service": "TrustVault API",
  "timestamp": "2026-10-20T03:45:00.000Z",
  "uptime": 24.18,
  "environment": "development"
}
```

### 2.2 User Registration
Registers a new member account with bcrypt-hashed credentials (minimum 12 salt rounds) and issues an initial JWT token.
- **Endpoint**: `POST /api/auth/register`
- **Authentication**: None (Public)
- **THREAT-06 Defense**: Client-supplied `role` parameter is overridden to `'member'`.
- **Request Body**:
```json
{
  "name": "Sarah Jenkins",
  "email": "sarah.j@acmecorp.internal",
  "password": "SecurePassword123"
}
```
- **Response (201 Created)**:
```json
{
  "status": "success",
  "message": "User account created successfully.",
  "data": {
    "user": {
      "_id": "6714c3e8a1...",
      "name": "Sarah Jenkins",
      "email": "sarah.j@acmecorp.internal",
      "role": "member",
      "createdAt": "2026-10-20T06:53:38.645Z",
      "updatedAt": "2026-10-20T06:53:38.645Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI..."
  }
}
```

### 2.3 User Login
Authenticates user credentials, prevents user enumeration, and issues a fresh JWT.
- **Endpoint**: `POST /api/auth/login`
- **Authentication**: None (Public)
- **Response (200 OK)**: Returns `{ status: "success", data: { user, token } }`.

### 2.4 Authenticated Profile
Fetches the currently authenticated user's profile.
- **Endpoint**: `GET /api/auth/me`
- **Authentication**: Required (`Authorization: Bearer <token>`)
- **Response (200 OK)**: Returns `{ status: "success", data: { user } }`.

---

## 3. Reserved Endpoints (Planned for Future Stages)

### 3.1 Document Management & Storage (Stage 3 & 4)
| Method | Endpoint | Description | Auth Required | Expected Status |
| :--- | :--- | :--- | :---: | :---: |
| `POST` | `/api/documents/upload` | Upload binary document and metadata | Yes (Bearer) | `201 Created` |
| `GET` | `/api/documents` | List documents accessible to current user | Yes (Bearer) | `200 OK` |
| `GET` | `/api/documents/:id` | Get document metadata (requires read access) | Yes (Bearer) | `200 OK` |
| `GET` | `/api/documents/:id/download` | Stream private document bytes | Yes (Bearer) | `200 OK` (binary stream) |
| `PATCH` | `/api/documents/:id` | Update document metadata (requires edit access)| Yes (Bearer) | `200 OK` |
| `DELETE` | `/api/documents/:id` | Delete document (Owner/Admin only) | Yes (Bearer) | `200 OK` |

### 3.3 Permissions & Access Control (Stage 4 & 5)
| Method | Endpoint | Description | Auth Required | Expected Status |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | `/api/documents/:id/permissions` | View document access list | Yes (Owner/Admin) | `200 OK` |
| `POST` | `/api/documents/:id/permissions` | Grant read or edit permission to named user | Yes (Owner/Admin) | `200 OK` |
| `DELETE` | `/api/documents/:id/permissions/:userId` | Immediately revoke access from user | Yes (Owner/Admin) | `200 OK` |

### 3.4 Audit & Compliance (Stage 6)
| Method | Endpoint | Description | Auth Required | Expected Status |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | `/api/documents/:id/audit` | View immutable audit history for document | Yes (Owner/Admin) | `200 OK` |
| `GET` | `/api/audit/activity` | View user-specific recent activity feed | Yes (Bearer) | `200 OK` |

### 3.5 Administration (Stage 8)
| Method | Endpoint | Description | Auth Required | Expected Status |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | `/api/admin/overview` | Platform-wide metrics and stats | Yes (Admin) | `200 OK` |
| `GET` | `/api/admin/audit-logs` | Organization-wide complete audit log stream | Yes (Admin) | `200 OK` |
| `GET` | `/api/admin/users` | Manage registered organization members | Yes (Admin) | `200 OK` |
