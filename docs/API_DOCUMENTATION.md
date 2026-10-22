# TrustVault — REST API Specification & Architecture Reference

> **Version**: 1.0.0 (Production Verified)  
> **Base URL**: `http://localhost:5000/api`  
> **Security Protocol**: Zero-Trust, Defensive Headers, Rate Limiting, RBAC & Granular Document ACLs

---

## 1. Architectural Standards & Security Protocols

### 1.1 Transport & Framing
- **Protocol**: HTTP/1.1 (Local Development) / HTTPS (Production TLS 1.3)
- **Data Exchange**: JSON (`Content-Type: application/json; charset=utf-8`)
- **Authentication**: Stateless JSON Web Tokens (JWT) passed via HTTP Header:
  ```http
  Authorization: Bearer <jwt_token>
  ```
- **Defensive HTTP Response Headers**:
  ```http
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: default-src 'self'
  ```

### 1.2 Unified Error Response Format
All API errors return a standard JSON envelope:
```json
{
  "status": "error",
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action.",
    "details": null
  }
}
```

### 1.3 Standard HTTP Status Codes
| Status Code | Description | Standard Meaning in TrustVault |
| :--- | :--- | :--- |
| `200 OK` | Success | Request succeeded and returned requested data. |
| `201 Created` | Created | New resource created (document uploaded, user registered, grant added). |
| `400 Bad Request` | Validation Failure | Malformed JSON, failed regex validation, underage DOB, or invalid state. |
| `401 Unauthorized` | Unauthenticated | Missing, expired, or cryptographically invalid Bearer JWT. |
| `403 Forbidden` | Access Denied | Authenticated user lacks permission (role mismatch, not in ACL, revoked). |
| `404 Not Found` | Not Found | Resource does not exist or user is forbidden from confirming its existence. |
| `413 Payload Too Large` | Oversized | Uploaded binary exceeds configured maximum (25MB). |
| `415 Unsupported Media Type` | Signature Mismatch | Magic number inspection rejected file header (e.g. script disguised as pdf). |
| `429 Too Many Requests` | Rate Limited | Exceeded sliding-window submission rate (e.g., 15 requests/min on auth). |
| `500 Server Error` | Internal Failure | Sanitized error without leaking stack traces or internal environment variables. |

---

## 2. Role-Based Access Control (RBAC) Matrix

| Endpoint Group | Visitor / Public | Viewer | Document Owner | Administrator |
| :--- | :---: | :---: | :---: | :---: |
| **System Health** (`/api/health`) | ✅ | ✅ | ✅ | ✅ |
| **Auth & Registration** (`/api/auth/*`) | ✅ | ✅ | ✅ | ✅ |
| **Self Profile** (`/api/auth/profile`) | ❌ | ✅ (Own) | ✅ (Own) | ✅ (Own) |
| **Request Owner Access** (`/api/auth/request-owner-access`) | ❌ | ✅ | ❌ (N/A) | ❌ (N/A) |
| **Document Upload** (`POST /api/documents`) | ❌ | ❌ | ✅ | ✅ |
| **Document Read / Stream** (`GET /api/documents/:id/download`) | ❌ | ✅ (If in ACL/All) | ✅ (If Owner/ACL) | ✅ |
| **Document Metadata Edit** (`PATCH /api/documents/:id`) | ❌ | ✅ (If Edit ACL) | ✅ (If Owner/Admin) | ✅ |
| **Document Share / ACL** (`POST /api/documents/:id/permissions`) | ❌ | ❌ | ✅ (If Owner) | ✅ |
| **Document Deletion** (`DELETE /api/documents/:id`) | ❌ | ❌ | ✅ (If Owner) | ✅ |
| **Admin Governance** (`/api/admin/*`) | ❌ | ❌ | ❌ | ✅ |

---

## 3. Comprehensive Endpoints Directory

### 3.1 System Health
#### `GET /api/health`
- **Access**: Public
- **Description**: Returns operational status, environment, and uptime without exposing secrets.
- **Response** (`200 OK`):
  ```json
  {
    "status": "operational",
    "timestamp": "2026-10-22T18:00:00.000Z",
    "uptime": 1204.5,
    "environment": "development"
  }
  ```

---

### 3.2 Authentication & Identity Management

#### `POST /api/auth/register`
- **Access**: Public
- **Description**: Registers a new corporate user account. Validates Full Name, Email, DOB (>= 13 years old), password strength, and terms acceptance. Generates email verification token.
- **Request Body**:
  ```json
  {
    "name": "Alex Mercer",
    "email": "alex.dev@trustvault.internal",
    "password": "VaultPassword2026!",
    "confirmPassword": "VaultPassword2026!",
    "dateOfBirth": "1998-05-15",
    "requestedRole": "viewer",
    "termsAccepted": true
  }
  ```
- **Validation Rules**:
  - `name`: 2 to 50 characters, safe international Unicode characters, spaces, hyphens, and apostrophes. HTML tags rejected.
  - `dateOfBirth`: Format `YYYY-MM-DD`. Gregorian calendar leap-year validated. Must not be a future date. Age must be >= 13 years.
  - `password`: Minimum 8 characters, at least one letter and one number.
  - `termsAccepted`: Must be `true`. Bound to `CURRENT_TERMS_VERSION = '1.0.0'`. Timestamp strictly server-generated.
- **Response** (`201 Created`):
  ```json
  {
    "status": "success",
    "message": "Registration successful. Please verify your email.",
    "data": {
      "user": {
        "id": "usr_783294723",
        "name": "Alex Mercer",
        "email": "alex.dev@trustvault.internal",
        "role": "viewer",
        "isEmailVerified": false,
        "dateOfBirth": "1998-05-15",
        "termsVersionAccepted": "1.0.0",
        "termsAcceptedAt": "2026-10-22T18:00:00.000Z"
      }
    }
  }
  ```

#### `POST /api/auth/login`
- **Access**: Public (Rate-limited: 15 req/min)
- **Description**: Validates email and password against 12-round bcrypt hash. Checks active status and email verification.
- **Request Body**:
  ```json
  {
    "email": "sarah.lead@trustvault.internal",
    "password": "TrustVault2026!"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "status": "success",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "usr_904283472",
        "name": "Sarah Jenkins",
        "email": "sarah.lead@trustvault.internal",
        "role": "owner",
        "isEmailVerified": true
      }
    }
  }
  ```

#### `GET /api/auth/profile`
- **Access**: Authenticated (`Bearer`)
- **Description**: Returns profile details for the authenticated user. Excludes password hashes and tokens.
- **Response** (`200 OK`):
  ```json
  {
    "status": "success",
    "data": {
      "user": {
        "id": "usr_904283472",
        "name": "Sarah Jenkins",
        "email": "sarah.lead@trustvault.internal",
        "role": "owner",
        "dateOfBirth": "1995-04-12",
        "isEmailVerified": true,
        "termsVersionAccepted": "1.0.0",
        "termsAcceptedAt": "2026-10-20T08:00:00.000Z",
        "createdAt": "2026-10-20T08:00:00.000Z"
      }
    }
  }
  ```

#### `PUT /api/auth/profile` / `PATCH /api/auth/profile`
- **Access**: Authenticated (`Bearer`)
- **Description**: Self-service update for permitted profile fields (`name`, `dateOfBirth`). Mass-assignment protected: rejects role changes. Synchronizes name to owned documents, ACL grants, Admin notifications, and password reset requests. Emits `PROFILE_UPDATED` audit log.
- **Request Body**:
  ```json
  {
    "name": "Sarah Jenkins-Vance",
    "dateOfBirth": "1995-04-12"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "status": "success",
    "message": "Profile updated successfully.",
    "data": {
      "user": {
        "id": "usr_904283472",
        "name": "Sarah Jenkins-Vance",
        "email": "sarah.lead@trustvault.internal",
        "role": "owner",
        "dateOfBirth": "1995-04-12"
      }
    }
  }
  ```

#### `POST /api/auth/change-password`
- **Access**: Authenticated (`Bearer`)
- **Description**: Self-service password change requiring verification of `currentPassword`. Validates complexity and hashes with 12 bcrypt salt rounds. Invalidates prior sessions.
- **Request Body**:
  ```json
  {
    "currentPassword": "OldPassword2026!",
    "newPassword": "NewVaultPassword2026!"
  }
  ```

#### `POST /api/auth/request-owner-access`
- **Access**: Authenticated (`Viewer`)
- **Description**: Submits an upgrade request to Document Owner. Creates persistent `OwnerApprovalRequest` and notifies Admin Notification Center.

---

### 3.3 Private Document Storage & Ingestion

#### `POST /api/documents`
- **Access**: Authenticated (`Owner`, `Admin`)
- **Headers**: `Content-Type: multipart/form-data`
- **Description**: Ingests file binary into isolated private storage. Performs magic number inspection and enforces 25MB limit. Defaults to `visibility: 'private'`.
- **Form Fields**:
  - `file`: Binary file (PDF, DOCX, XLSX, PNG, JPG, TXT).
  - `title`: Document display title.
  - `description`: Optional abstract.
  - `category`: Category classification (`legal`, `financial`, `technical`, `hr`, `other`).
  - `visibility`: `private` | `selected_users` | `all_authenticated_users`.
  - `recipients`: JSON array of `{ userId, email, name, permission }` (if `selected_users`).
- **Response** (`201 Created`):
  ```json
  {
    "status": "success",
    "data": {
      "document": {
        "id": "doc_92837492",
        "title": "SOC2 Compliance Dossier.pdf",
        "originalFilename": "SOC2_Compliance_Dossier.pdf",
        "fileSize": 1428590,
        "mimeType": "application/pdf",
        "visibility": "private",
        "ownerId": "usr_904283472",
        "ownerName": "Sarah Jenkins-Vance",
        "createdAt": "2026-10-22T18:00:00.000Z"
      }
    }
  }
  ```

#### `GET /api/documents/:id/download`
- **Access**: Authenticated (`Owner`, Named in ACL, `all_authenticated_users` if applicable, or `Admin`)
- **Description**: Streams file binary from quarantined storage. Directly checks database authorization and revocation engine on every request. Sets forced attachment headers with original filename:
  ```http
  Content-Disposition: attachment; filename="SOC2_Compliance_Dossier.pdf"
  X-Content-Type-Options: nosniff
  ```
- **Response**: Binary stream with HTTP 200. Emits `DOCUMENT_DOWNLOAD` audit event.

#### `PATCH /api/documents/:id`
- **Access**: Authenticated (`Owner`, Recipient with `edit` permission, `Admin`)
- **Description**: Updates document metadata (`title`, `description`, `category`, `tags`). Viewers without `edit` receive `403 Forbidden`. Emits `DOCUMENT_UPDATED` audit event.

#### `PATCH /api/documents/:id/visibility`
- **Access**: Authenticated (`Owner`, `Admin`)
- **Description**: Dynamically updates document visibility. Switching to `private` immediately revokes third-party access in real-time. Emits `DOCUMENT_VISIBILITY_UPDATED` audit event.

#### `DELETE /api/documents/:id`
- **Access**: Authenticated (`Owner`, `Admin`)
- **Description**: Permanently purges document binary from disk and removes database metadata record. Emits `DOCUMENT_DELETED` audit event.

---

### 3.4 Granular ACL & Immediate Revocation

#### `GET /api/documents/:id/permissions`
- **Access**: Authenticated (`Owner`, `Admin`)
- **Description**: Returns the active Access Control List for the document.
- **Response** (`200 OK`):
  ```json
  {
    "status": "success",
    "data": {
      "visibility": "selected_users",
      "acl": [
        {
          "userId": "usr_102938475",
          "email": "alex.dev@trustvault.internal",
          "name": "Alex Mercer",
          "permission": "edit",
          "grantedAt": "2026-10-22T18:00:00.000Z"
        }
      ]
    }
  }
  ```

#### `POST /api/documents/:id/permissions`
- **Access**: Authenticated (`Owner`, `Admin`)
- **Description**: Grants `read` or `edit` access to a named user. Emits `PERMISSION_GRANTED` audit event.

#### `DELETE /api/documents/:id/permissions/:userId`
- **Access**: Authenticated (`Owner`, `Admin`)
- **Description**: Immediately revokes collaborator access. Registers user in revocation cache; subsequent download or metadata requests fail with `403 Forbidden` with zero token lag. Emits `PERMISSION_REVOKED` audit event.

---

### 3.5 Administrator Governance

#### `GET /api/admin/analytics`
- **Access**: Authenticated (`Admin`)
- **Description**: Aggregates tenant user counts, document counts, active ACL grants, and audit volumes.

#### `GET /api/admin/audit-logs`
- **Access**: Authenticated (`Admin`)
- **Description**: Queries global audit ledger with pagination and filters (`action`, `actorEmail`, `startDate`, `endDate`).

#### `GET /api/admin/audit-logs/export?format=csv|json`
- **Access**: Authenticated (`Admin`)
- **Description**: Streams un-truncated export of compliance records.

#### `PATCH /api/admin/users/:userId/role`
- **Access**: Authenticated (`Admin`)
- **Description**: Promotes or downgrades user role. Enforces the *Zero Data Loss Guarantee*: downgrading an Owner to Viewer preserves their uploaded documents and collaborator access.

---

## 4. Database Schema Specifications

### 4.1 User Schema (`users`)
```javascript
{
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true }, // 12-round bcrypt hash
  role: { type: String, enum: ['admin', 'owner', 'viewer'], default: 'viewer' },
  requestedRole: { type: String, enum: ['owner', 'viewer', null], default: null },
  ownerApprovalStatus: { type: String, enum: ['not_required', 'pending', 'approved', 'rejected'], default: 'not_required' },
  dateOfBirth: { type: String, default: null }, // YYYY-MM-DD
  termsVersionAccepted: { type: String, default: null }, // '1.0.0'
  privacyVersionAcknowledged: { type: String, default: null }, // '1.0.0'
  termsAcceptedAt: { type: Date, default: null },
  isEmailVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  mustChangePassword: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

### 4.2 Document Schema (`documents`)
```javascript
{
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  originalFilename: { type: String, required: true },
  storedFilename: { type: String, required: true, unique: true }, // UUIDv4 isolation
  filePath: { type: String, required: true },
  fileSize: { type: Number, required: true },
  mimeType: { type: String, required: true },
  category: { type: String, enum: ['general', 'legal', 'financial', 'technical', 'hr', 'confidential', 'other'], default: 'general' },
  tags: [{ type: String, trim: true }],
  ownerId: { type: String, required: true, index: true },
  ownerName: { type: String, required: true },
  visibility: { type: String, enum: ['private', 'selected_users', 'all_authenticated_users'], default: 'private' },
  acl: [{
    userId: { type: String, required: true },
    email: { type: String, required: true },
    name: { type: String, required: true },
    permission: { type: String, enum: ['read', 'edit'], default: 'read' },
    grantedAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

### 4.3 Audit Log Schema (`audit_logs`)
Append-only schema: updates and deletes are rejected at the model pre-hook level.
```javascript
{
  action: { type: String, required: true, index: true },
  actorId: { type: String, default: 'SYSTEM' },
  actorEmail: { type: String, default: 'system@trustvault.internal' },
  actorRole: { type: String, default: 'system' },
  targetResourceId: { type: String, default: null, index: true },
  targetResourceType: { type: String, default: 'DOCUMENT' },
  details: { type: String, default: '' },
  outcome: { type: String, enum: ['SUCCESS', 'FAILURE', 'DENIED'], default: 'SUCCESS' },
  metadata: { type: Object, default: {} },
  timestamp: { type: Date, default: Date.now, index: true }
}
```
