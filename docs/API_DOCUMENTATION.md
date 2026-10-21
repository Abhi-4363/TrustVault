# TrustVault — REST API Specification & Architecture

> **Version**: v1.0.0 (Stages 1–10 Complete)  
> **Base URL**: `http://localhost:5000/api`  
> **Security Protocol**: Zero-Trust, Defensive Headers, Rate Limiting, RBAC & Granular ACL

---

## 1. Architectural Standards

- **Protocol**: HTTP/1.1 (Local Dev) / HTTPS (Production TLS 1.3)
- **Data Exchange Format**: JSON (`Content-Type: application/json`)
- **Authentication**: Stateless JSON Web Tokens (JWT) passed via `Authorization: Bearer <token>`
- **Security Headers Enforced**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Content-Security-Policy: default-src 'self'`
- **Standard HTTP Status Codes**:
  - `200 OK`: Request succeeded.
  - `201 Created`: Resource successfully created.
  - `400 Bad Request`: Validation failure or malformed payload.
  - `401 Unauthorized`: Authentication credentials missing, invalid, or expired.
  - `403 Forbidden`: Authenticated user lacks permission for the specific resource.
  - `404 Not Found`: Resource does not exist or user lacks permission to confirm existence.
  - `413 Payload Too Large`: Uploaded file exceeds permitted size limit (25MB max).
  - `415 Unsupported Media Type`: File signature (magic number) does not match allowed MIME types.
  - `429 Too Many Requests`: Rate limit threshold exceeded.
  - `500 Internal Server Error`: Generic unhandled server error.

---

## 2. API Endpoints Directory

### 2.1 System Health & Diagnostics
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/health` | Service health status, uptime, environment | Public |

### 2.2 Identity & Access Management (IAM)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/auth/register` | Register new user account (role forced to Document Owner / `owner`) | Public |
| `POST` | `/api/auth/login` | Authenticate credentials and receive short-lived JWT | Public |
| `GET` | `/api/auth/me` | Fetch authenticated identity profile | Bearer |

### 2.3 Private Document Storage, Search & Metadata Editing
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/documents` | Upload document to isolated private storage (Multer + Magic Number inspection) | Bearer (Owner/Admin) |
| `GET` | `/api/documents` | List documents accessible to current user (Owned + Shared) | Bearer |
| `GET` | `/api/documents/search` | Scoped search filtering by `q`, `name`, `owner`, `category`, `date`, `format`, `tags` | Bearer |
| `GET` | `/api/documents/:id` | Fetch document metadata (Requires Owner or Read ACL) | Bearer |
| `PATCH` | `/api/documents/:id` | Update document metadata (`title`, `description`, `category`, `tags`) | Bearer (Owner/Editor/Admin) |
| `GET` | `/api/documents/:id/download` | Stream binary document with forced attachment headers | Bearer (Owner/Reader/Editor/Admin) |
| `DELETE` | `/api/documents/:id` | Permanently purge document binary and record audit event | Bearer (Owner/Admin) |

### 2.4 Granular ACL & Immediate Revocation
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/documents/:id/permissions` | View document access control list | Bearer (Owner/Admin) |
| `POST` | `/api/documents/:id/permissions` | Grant granular `read` or `edit` access to named user | Bearer (Owner/Admin) |
| `DELETE` | `/api/documents/:id/permissions/:userId` | Immediately revoke access with zero token caching lag | Bearer (Owner/Admin) |

### 2.5 Audit Trail & Compliance
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/documents/:id/audit` | View immutable audit history for document | Bearer (Owner/Admin) |
| `GET` | `/api/documents/audit/activity` | View recent system activity feed | Bearer |

### 2.6 Administrator Governance Dashboard (Role: admin)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/admin/analytics` | System totals, role distribution, active grants | Bearer (Admin) |
| `GET` | `/api/admin/audit-logs` | Global audit trail with filtering & pagination | Bearer (Admin) |
| `GET` | `/api/admin/audit-logs/export` | Un-truncated export of compliance log (CSV / JSON) | Bearer (Admin) |
| `GET` | `/api/admin/users` | List organization users with document counts | Bearer (Admin) |
| `GET` | `/api/admin/users/:id` | Detailed user governance profile | Bearer (Admin) |
| `PATCH` | `/api/admin/users/:id/deactivate` | Deactivate tenant user account | Bearer (Admin) |
| `PATCH` | `/api/admin/users/:id/reactivate` | Reactivate tenant user account | Bearer (Admin) |
