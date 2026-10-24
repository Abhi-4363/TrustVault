# TrustVault — Technical Architecture & Implementation Write-Up

> **Author**: Snovasys Fresher Hiring Challenge 2026 Candidate  
> **Platform**: TrustVault Zero-Trust Document Security & Governance  
> **Date**: October 22, 2026  
> **Repository**: [https://github.com/Abhi-4363/TrustVault](https://github.com/Abhi-4363/TrustVault)

---

## 1. What TrustVault Does

**TrustVault** is an enterprise-grade document security and collaboration platform designed for organizations handling confidential, high-stakes files—such as financial statements, M&A filings, board minutes, SOC 2 dossiers, and intellectual property.

Unlike conventional file-sharing tools where documents are placed in static web buckets or shared via long-lived unrevokable links, TrustVault enforces a strict **Zero-Trust** security architecture:
1. **Three Distinct Enterprise Roles**: Administrator, Document Owner, and Viewer with explicit privilege boundaries.
2. **Private Storage Isolation**: File binaries are quarantined outside public web directories and never exposed via static URLs.
3. **Per-Document Granular Access Control**: Document owners assign fine-grained `read` or `edit` permissions to named corporate users, or publish under a 3-tier visibility model (`Private — Only Me`, `Share with Specific Users`, or `Share with All Registered Users`).
4. **Immediate Zero-Lag Access Revocation**: Permissions are validated directly against the database on every read or stream request; revoking access terminates downstream ability to read or download immediately.
5. **Append-Only Tamper-Resistant Audit Trail**: Every file upload, download, metadata modification, permission grant, revocation, and denied access attempt is recorded in an immutable ledger.
6. **Administrator Governance**: Real-time system analytics, user directory governance, pending Owner request review queues, and un-truncated CSV/JSON audit exports.

---

## 2. The Permission Model & Why It Was Chosen

### 2.1 Hybrid RBAC + ABAC (Per-Document ACL)
We chose a hybrid model combining **Role-Based Access Control (RBAC)** at the tenant level with **Attribute/Access-Control-List (ACL)** enforcement at the document level:

- **Tenant-Level RBAC**:
  - `Administrator`: System-wide governance, audit exploration, role assignment, and notification management. Does not automatically inject themselves into private document ACLs, preserving privacy of employee documents.
  - `Document Owner`: Exclusive privilege to upload files, configure visibility, manage collaborator ACLs, and purge owned records.
  - `Viewer`: Read-only access by default. Can only access documents explicitly shared with them or published to all registered users. Viewers with explicit `edit` permission can modify metadata (title, description, tags) but cannot delete or re-share files.

- **Why Not Pure RBAC?**
  In enterprise organizations, two users with the same "Document Owner" role (e.g. Head of HR and Head of Finance) must NOT automatically see each other's files. Pure RBAC would require creating hundreds of custom roles. A per-document ACL allows owners to delegate access specifically to named users.

- **Why Not Presigned URLs?**
  Presigned URLs suffer from *revocation lag*: once issued, an AWS S3 or Cloudflare R2 presigned link remains valid until its expiration (often 15 to 60 minutes), even if the collaborator is terminated. TrustVault routes every byte stream through an authenticated streaming controller that checks real-time database state before sending headers.

---

## 3. File Storage & Server-Side Access Checks

### 3.1 Storage Quarantine & File Signature Inspection
1. **Quarantine Directory**: Files uploaded via `POST /api/documents` are written to `backend/storage/uploads/`, completely isolated from static express routes.
2. **UUID File Randomization**: Files are saved under cryptographic UUIDv4 names (e.g. `d3b07384-d113-4f51-b856-118f67389104.bin`). Original filenames are preserved as metadata in the database and never reflected in physical disk filenames, preventing directory traversal and file overwrite attacks.
3. **Magic Number Header Inspection**: In addition to checking file extensions and MIME headers sent by the client, the backend inspects the binary file's magic numbers (first bytes). If a user renames an executable script (`.sh` or `.exe`) to `.pdf`, the server detects the signature mismatch and immediately rejects the file with `415 Unsupported Media Type` while purging the temporary disk payload.
4. **Original Filename Preservation on Download**: The backend streams files with:
   ```http
   Content-Disposition: attachment; filename="OriginalName.pdf"
   X-Content-Type-Options: nosniff
   ```
   The frontend utilizes the browser's native File System Access API (`showSaveFilePicker`), presenting the original filename directly in the Save As dialog while preserving Bearer-token authentication.

---

## 4. Immediate Revocation & Tamper-Resistant Auditing

### 4.1 Zero-Lag Revocation Engine
When an owner clicks **Revoke** on a collaborator or switches a document's visibility to `private`:
1. The database ACL is mutated atomically via `$pull`.
2. The user's ID is registered in the server's immediate revocation cache (`revocation.service.js`).
3. If the user initiates a download request one millisecond later, the streaming handler queries `canReadDocument(user, doc)`. Because the user is absent from the ACL and the cache records the revocation event, the server returns `403 Forbidden` and emits an `ACCESS_DENIED` audit event.

### 4.2 Append-Only Audit Integrity
The `AuditLog` collection adheres to strict immutability:
- Mongoose schema pre-hooks explicitly intercept and throw errors on `updateOne`, `updateMany`, `findOneAndUpdate`, `remove`, `deleteOne`, and `deleteMany`.
- In-memory repository adapters replicate this behavior by throwing `Error: AUDIT_LOG_IMMUTABLE`.
- Audit records store: `action`, `actorId`, `actorEmail`, `actorRole`, `targetResourceId`, `targetResourceType`, `outcome` (`SUCCESS`, `FAILURE`, `DENIED`), `metadata`, and server-generated `timestamp`.
- **Privacy Protection**: In compliance with PII privacy guidelines, sensitive values such as raw passwords, reset tokens, or user dates of birth are strictly stripped from audit metadata (`changedFields: ['dateOfBirth']`).

---

## 5. What AI Helped With & What Was Reviewed / Corrected

### 5.1 AI Assistance
- Generating boilerplate Express routers, initial Vitest test templates, and complex regex pattern helpers for Gregorian calendar leap years.
- Assisting with repetitive CSS variable tokens across responsive breakpoints.

### 5.2 Independent Review & Human Corrections
Every component, endpoint, and test was scrutinized against real application execution:
1. **Audit Mutability Bug**: In `auth.controller.js:updateProfile`, the in-memory user object was passed by reference to `AuditLog.create`. Mutating `user.name` during update caused the audit event to record the *new* name as both previous and updated. We identified this and fixed it by creating an explicit snapshot `previousName = user.name` prior to mutation.
2. **Global CSS Input Overlap**: In `AuthModals.jsx`, icons overlapped placeholder text. We traced the root cause to an un-scoped `.form-input` selector in `UploadModal.css` (`padding: 8px 12px`) that was loaded after `AuthModals.css` and overriding its `padding-left: 40px`. We scoped `UploadModal.css` to `.upload-modal-container` and enforced `padding: 0 12px 0 40px !important;` on all input wrappers.
3. **Keyboard Search Shortcut Leak**: Unauthenticated visitors could press `Ctrl + K` to trigger the search dialog. We corrected this in `AppShell.jsx` by checking authentication state (`if (!user) return;`) before handling the shortcut.
4. **Client Timestamp Forgery Defense**: Ensured `termsAcceptedAt` in registration is strictly assigned server-side (`new Date().toISOString()`), discarding any client-supplied timestamps.
5. **Authentication Modal State Cross-Contamination & Stale Inputs**: React preserved internal `'login'` state when navigating to Create Account because `useState(initialMode)` was only evaluated on initial component mount and the modal persisted in the virtual DOM. We resolved this by adding `useEffect` synchronization, clearing stale passwords and validation errors on mode switch, keying the modal with `${authModalMode}-${authModalOpen}`, and synchronizing URL query parameters (`?mode=register` / `?mode=login`).
6. **Mobile File Upload Sandboxing & Truncated Downloads**: Mobile browsers sandboxed programmatic `.click()` events on hidden file inputs and frequently stripped file extensions when capturing from camera/photo gallery. We resolved this by implementing a transparent full-surface dropzone overlay, client-side MIME-to-extension deduction (preventing 415 errors), and extending blob download URL lifetimes to 60 seconds to support mobile background download managers.

---

## 6. What Was Deliberately Not Implemented

1. **Client-Side End-to-End Encryption (E2EE) with Zero-Knowledge Server**:
   - *Rationale*: Client-side cryptographic key management (e.g. WebCrypto AES-GCM in browser) prevents server-side search indexing and metadata filtering. For enterprise compliance, server-side storage quarantine with streaming authorization was chosen over E2EE.
2. **Public Self-Service Administrator Registration**:
   - *Rationale*: Allowing public users to register as Administrator defeats the entire tenant security model. Public registration strictly forces the effective role to `viewer` (or flags `pending` approval if Document Owner is requested). Admin accounts can only be seeded or provisioned by existing Administrators.
3. **Arbitrary Password Reset Without Proof**:
   - *Rationale*: Users cannot reset passwords without either Admin approval (reviewed in the Notification Center) or single-use cryptographic email tokens with a 15-minute expiration window.

---

## 7. Known Limitations & Future Improvements

1. **Ephemeral Disk Storage in Serverless Cloud**:
   - *Current Implementation*: File uploads reside on local disk (`backend/storage/uploads`).
   - *Future Production Improvement*: Replace local disk with an S3-compatible cloud object storage adapter (e.g. AWS S3, Cloudflare R2) with private buckets, keeping all access routed through the streaming controller.
2. **In-Memory Store Reset on Process Restart**:
   - *Current Implementation*: When MongoDB is unreachable, the backend seamlessly falls back to an in-memory repository to guarantee zero-friction local development and instant test runs. However, in-memory state resets when the Node process restarts.
   - *Production Configuration*: In production (`NODE_ENV=production`), require a persistent MongoDB Atlas replica set connection.
3. **Distributed Token Invalidation**:
   - *Current Implementation*: Active JWTs are validated against the database on sensitive endpoints.
   - *Future Production Improvement*: Integrate a Redis-backed distributed blocklist for instant multi-region token invalidation upon password reset or account deactivation.

---

## 8. Verification & Test Metrics

- **Automated Integration Tests**: **18 test files passed, 277/277 tests passing (100% pass rate)**.
- **Frontend Production Build**: **1633 modules compiled cleanly via Vite with 0 errors**.
- **Security Catalog**: **30 threats analyzed, mitigated, and verified in `THREATS.md`**.
