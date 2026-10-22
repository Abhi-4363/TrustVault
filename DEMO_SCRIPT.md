# TrustVault — 5-Minute Demonstration Walkthrough & Evaluator Script

> **Purpose**: Practical, step-by-step evaluator script and video recording guide for the Snovasys Fresher Hiring Challenge 2026.  
> **Target Duration**: Exactly 5:00 minutes.  
> **Platform Requirements**: Google Chrome / Chromium, microphone, local development servers running (`backend` on `http://localhost:5000`, `frontend` on `http://localhost:5173`).

---

## Pre-Demonstration Checklist

- [ ] Clean seed dataset initialized: run `npm run seed` in `backend/` to populate demo accounts and sample vault documents.
- [ ] Backend running (`npm run dev` in `backend/` on port 5000).
- [ ] Frontend running (`npm run dev` in `frontend/` on port 5173).
- [ ] Browser window sized to 1920x1080 (1080p Full HD) or 1440x900.
- [ ] Demo credentials handy:
  - **Administrator**: `admin@trustvault.internal` / `TrustVault2026!`
  - **Document Owner**: `sarah.lead@trustvault.internal` / `TrustVault2026!`
  - **Viewer**: `alex.dev@trustvault.internal` / `TrustVault2026!`

---

## Timed Walkthrough Script

### ⏱️ [0:00 – 0:30] Introduction & The Enterprise Security Problem
- **On Screen**: TrustVault Landing Page (`http://localhost:5173`).
- **Narrator Script**:
  > *"Welcome to TrustVault. In modern organizations, high-stakes documents—such as board presentations, M&A filings, and SOC 2 audits—are routinely shared over unencrypted channels or stored in public web buckets without auditable access control.
  > TrustVault is an enterprise-grade document security platform built on a strict Zero-Trust architecture. In this 5-minute walkthrough, I will demonstrate how TrustVault enforces multi-tenant role-based access control, granular per-document read and edit permissions, real-time revocation with zero token caching lag, and an append-only tamper-resistant audit trail."*
- **Action**: Briefly scroll through the security features highlight cards on the landing portal.

---

### ⏱️ [0:30 – 1:15] Three Distinct Roles & Registration Lifecycle
- **On Screen**: Authentication Portal -> "Create Account" tab.
- **Narrator Script**:
  > *"TrustVault enforces three distinct corporate roles: Administrator, Document Owner, and Viewer. 
  > When a new user registers, our form validates their Full Name, Work Email, Date of Birth—enforcing a strict minimum age policy of 13 years with leap-year calendar validation—and a password complexity checklist.
  > Notice the required Terms & Conditions and Privacy Policy checkbox. Clicking these opens accessible, versioned legal modals covering 15 enterprise terms and 11 privacy sections without toggling the checkbox or resetting form data. Acceptance timestamps are strictly server-generated."*
- **Action**:
  1. Click the "Create account" tab.
  2. Point out Full Name, Work Email, Date of Birth placed directly above the Password fields.
  3. Click **Terms & Conditions** link; show the modal with version `1.0.0` and close it.
  4. Switch back to "Sign In", click the **Viewer** demo account card (`alex.dev@trustvault.internal`), and click **Sign In to Vault**.

---

### ⏱️ [1:15 – 2:15] Document Ingestion, 3-Tier Visibility & Granular ACL Sharing
- **On Screen**: Viewer Dashboard -> Sign out -> Sign in as Document Owner `sarah.lead@trustvault.internal`.
- **Narrator Script**:
  > *"Now I sign in as Sarah Jenkins, a Document Owner. Document Owners have the exclusive privilege to upload and manage confidential files.
  > When uploading a document, Sarah can choose between three visibility tiers: Private—Only Me, Share with Specific Users, or Share with All Registered Users.
  > Let's upload a confidential document. TrustVault inspects the binary file's magic numbers—preventing disguised scripts or executables from ever touching storage—and saves it outside the web root under a randomized UUID.
  > In the document table, Sarah clicks 'Share'. She grants Alex Mercer 'Can Edit' permission. Notice the audit system immediately records a PERMISSION_GRANTED event."*
- **Action**:
  1. Click **Upload Document**.
  2. Select a test PDF or sample file, enter title: `"Q4 Executive Security Review"`.
  3. Show the visibility cards: select **Share with Specific Users**.
  4. Click **Upload & Encrypt**. Document appears immediately in the table.
  5. Click **Share** on the uploaded document, select `alex.dev@trustvault.internal`, set permission to `Can Edit`, and click **Add Collaborator**.

---

### ⏱️ [2:15 – 3:00] Scoped Search, Download & Metadata Editing
- **On Screen**: Sign out -> Sign in as Viewer `alex.dev@trustvault.internal`.
- **Narrator Script**:
  > *"Now let's switch to Alex Mercer, a Viewer.
  > On Alex's dashboard, only documents explicitly shared with him appear. If Alex searches for keywords contained in another user's private documents, our backend authorization filter returns zero results—eliminating metadata leakage.
  > Since Sarah granted Alex 'Can Edit' permission, Alex can click 'Edit' to update the document's title or description. However, Alex cannot delete the document or re-share it with others.
  > When Alex clicks 'Download', the browser streams the file through our authenticated streaming controller, presenting the original filename via the File System Access API without exposing raw disk paths."*
- **Action**:
  1. Navigate to **Shared with Me**.
  2. Use the top search bar to search `"Q4 Executive"`.
  3. Click **Edit** on the document, append `"- Reviewed by Engineering"` to the title, and save.
  4. Click **Download** to show the Save dialog preserving the original filename.

---

### ⏱️ [3:00 – 3:45] Immediate Access Revocation & Denied Access Verification
- **On Screen**: Sign out -> Sign in as Owner `sarah.lead@trustvault.internal` -> Sign in as Alex in another tab/window.
- **Narrator Script**:
  > *"A critical flaw in many systems is revocation lag, where a user can continue downloading files using cached tokens after access has been revoked. TrustVault implements zero-lag revocation.
  > Sarah opens the Share modal for 'Q4 Executive Security Review' and clicks 'Revoke' next to Alex Mercer.
  > Access is revoked instantly in the database. If Alex immediately attempts to read metadata or download the document binary, the backend immediately rejects the request with HTTP 403 Forbidden and records an ACCESS_DENIED security audit event."*
- **Action**:
  1. On Sarah's session, click **Share**, then click the red **Revoke** button beside Alex Mercer.
  2. Switch to Alex's session, attempt to access or refresh the document; show the immediate `403 Forbidden` restriction.

---

### ⏱️ [3:45 – 4:30] Administrator Governance Dashboard & Global Audit Ledger
- **On Screen**: Sign out -> Sign in as Administrator `admin@trustvault.internal`.
- **Narrator Script**:
  > *"Now I sign in as Marcus Vance, an Administrator.
  > The Administrator Governance Dashboard provides real-time system metrics: total registered users, documents, active ACL access grants, and pending Owner approval requests.
  > In the User Directory, the Administrator can promote Viewers, review Owner access requests, or initiate single-use password resets.
  > Below, the Global Audit Trail records every upload, download, metadata edit, permission grant, revocation, and denied access attempt. The audit ledger is strictly append-only: database pre-hooks reject all UPDATE and DELETE mutations. Administrators can filter events by action or actor and export un-truncated CSV or JSON audit logs for compliance."*
- **Action**:
  1. Click **Admin Governance** in the sidebar.
  2. Point to the analytics cards (Total Documents, Active ACL Grants, Security Indicators).
  3. Show the **Owner Requests Queue** and **User Directory**.
  4. Scroll to the **Global Audit Trail**, filter by action `PERMISSION_REVOKED`, and click **Export CSV**.

---

### ⏱️ [4:30 – 5:00] Automated Testing, Zero Regressions & Conclusion
- **On Screen**: Terminal showing Vitest test suite execution and test summary table.
- **Narrator Script**:
  > *"To ensure that every authorization policy is strictly enforced and verified against regressions, TrustVault includes an automated test suite with 16 test files and 246 automated tests—all passing with a 100% success rate.
  > Our automated security tests verify that unauthorized users cannot read or download private files, magic numbers block disguised executable uploads, profile updates cannot escalate user roles, and revocation takes effect with zero delay.
  > Thank you for reviewing TrustVault."*
- **Action**:
  1. Show terminal output: `Test Files: 16 passed (16)`, `Tests: 246 passed (246)`.
  2. Show frontend production build output: `✓ built in 3.17s` with 0 errors.

---

## Post-Recording Review Checklist

- [ ] Video duration is between 4:30 and 5:00 minutes.
- [ ] Audio is crisp and clear without background noise.
- [ ] No personal credentials, API keys, or raw passwords visible on screen.
- [ ] Original filenames preserved during download demonstrated clearly.
- [ ] Immediate revocation demonstrated with real 403 Forbidden enforcement.
- [ ] Admin Governance dashboard and CSV audit export shown.
- [ ] Test suite output displayed verifying 246/246 passing tests.
