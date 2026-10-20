# TrustVault 🔐

> A secure, enterprise-grade document sharing platform designed for modern business collaboration with granular access control and auditability.

---

## 1. What is TrustVault?

**TrustVault** is a secure document-sharing platform engineered to help organisations securely store, share, and monitor sensitive corporate documents. Modern businesses need to share high-stakes confidential files—such as financial audits, legal contracts, board presentations, and intellectual property—without sacrificing data security or visibility.

Key pillars of the TrustVault vision:
- **Organised & Encrypted Document Management**: Centralise confidential documents with structured tagging and access tiers.
- **Granular Access Control**: Grant fine-grained read or edit privileges to specific named users.
- **Immediate Access Revocation**: Instantly withdraw access rights with zero delay or cached permission leakage.
- **Data Leak Prevention**: Strictly prevent unauthorized downloading, reading, tampering, or deleting of protected files.
- **Tamper-Resistant Audit Trail**: Maintain an immutable chronological record of every file interaction, permission grant, and revocation.
- **Administrative Transparency**: Provide compliance officers and administrators with actionable visibility into document lifecycle events.

---

## 2. Project Status & Stage 1 Scope

This repository is being developed incrementally as part of an assessment. Development strictly follows staged checkpoints to ensure complete code understanding, verification, and auditability.

### ✅ What is Implemented in Stage 1
- **Project Foundation & Hygiene**: Standardised project directory layout, root `.gitignore`, environment configuration templates (`.env.example`), and comprehensive architectural documentation.
- **Security & Threat Baseline**: Initial risk catalog and mitigation plan in `THREATS.md`.
- **Engineering Roadmap**: Detailed 10-stage execution plan in `docs/DEVELOPMENT_PLAN.md`.
- **API Specification Starter**: Architecture and health-check documentation in `docs/API_DOCUMENTATION.md`.
- **Backend Foundation**: Express.js server configured with:
  - Resilient application factory and decoupled server entry point.
  - Safe health-check endpoint (`GET /api/health`) that never exposes internal server state or secrets.
  - Centralised error handling and 404 (Not Found) middleware.
  - Non-blocking MongoDB connection configuration ready for subsequent stages.
- **Frontend Foundation**: Modern React + Vite web application showcasing:
  - Linear/Stripe-inspired enterprise SaaS dashboard aesthetic.
  - Polished design token architecture via CSS variables (slate, navy, calm blue accent).
  - Application shell featuring an accessible sidebar, contextual header, and responsive navigation.
  - Dashboard overview with demonstration summary cards, a structured recent documents table, and an activity feed.
  - Accessible, semantic markup with WCAG-compliant contrast ratios and clear empty states.
  - Explicitly marked demonstration data to ensure users are never misled into thinking mock data is live database state.

### ❌ What is NOT Implemented Yet (Deferred to Subsequent Stages)
To maintain strict stage boundaries and avoid incomplete or vulnerable mock features:
- **User Authentication & Session Management**: No login/register endpoints or JWT verification yet (scheduled for Stage 2).
- **Live File Uploading & Private Storage**: No file ingestion, disk writes, or S3/MinIO drivers yet (scheduled for Stage 3).
- **Document-Level Authorization**: Per-document ACLs and permissions engine (scheduled for Stage 4).
- **Permission Revocation Handlers**: Live revocation logic and access token invalidation (scheduled for Stage 5).
- **Persistent Database Models**: Live MongoDB persistence; backend runs without requiring an active database in Stage 1.
- **Audit Logging System**: Immutable event logging database collection (scheduled for Stage 6).
- **Admin Management Console**: Role management, user invitation, and tenant-wide settings (scheduled for Stage 8).

---

## 3. Prerequisites

To run TrustVault locally, ensure your environment meets the following requirements:

- **Node.js**: `v18.x`, `v20.x`, or `v22.x` (`v22.20.0+` recommended)
- **npm**: `v9.x` or `v10.x` (`10.9.3+` recommended)
- **Git**: `2.x+`
- **Modern Web Browser**: Chrome, Edge, Firefox, or Safari (supporting modern CSS and ES modules)

---

## 4. Project Structure

```text
TrustVault/
├── .env.example               # Root environment variable template
├── .gitignore                  # Git hygiene rules (ignoring node_modules, secrets, uploads)
├── README.md                   # This project overview and onboarding guide
├── THREATS.md                  # Comprehensive security threat model & mitigations
├── PROMPTS.md                  # Prompt tracking and development audit log
├── docs/
│   ├── DEVELOPMENT_PLAN.md     # 10-stage technical implementation roadmap
│   └── API_DOCUMENTATION.md    # API endpoint specifications and schema definitions
├── backend/                    # Node.js + Express API service
│   ├── .env.example            # Backend-specific environment template
│   ├── package.json            # Backend dependencies and scripts
│   ├── server.js               # Network listener and process lifecycle entry point
│   ├── src/
│   │   ├── app.js              # Express application factory & middleware setup
│   │   ├── config/             # Environment validation and DB config
│   │   └── routes/             # Health and API route handlers
│   └── tests/                  # Backend unit and integration test suites
└── frontend/                   # React + Vite client application
    ├── .env.example            # Frontend-specific environment template
    ├── index.html              # Single page application entry HTML
    ├── package.json            # Frontend dependencies and scripts
    ├── vite.config.js          # Vite configuration
    └── src/
        ├── App.jsx             # Main application layout and dashboard view
        ├── main.jsx            # React root mount
        ├── assets/             # Brand graphics and static vectors
        ├── components/         # Reusable UI components (SummaryCard, DocumentTable, etc.)
        ├── layouts/            # AppShell, AppHeader, AppSidebar layouts
        ├── mock/               # Explicitly labelled demo datasets for Stage 1
        └── styles/             # Design tokens, variables, and global CSS
```

---

## 5. Installation & Setup

### Clone and Navigate
```bash
# If cloned from GitHub
git clone https://github.com/<your-username>/TrustVault.git
cd TrustVault
```

### Backend Setup
```bash
# Navigate to the backend directory
cd backend

# Install dependencies
npm install

# Create local environment file from example template
cp .env.example .env

# Start backend in development mode (with hot-reload)
npm run dev
```
The backend server will start on `http://localhost:5000`.

### Frontend Setup
In a new terminal window:
```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Create local environment file from example template
cp .env.example .env

# Start frontend in development mode
npm run dev
```
The Vite development server will start on `http://localhost:5173`. Open this URL in your browser to view the TrustVault dashboard.

---

## 6. Verifying the Health-Check Endpoint

The backend provides a lightweight, non-sensitive health verification endpoint to ensure operational readiness.

### Command Line Verification (PowerShell / curl)
```bash
# PowerShell
Invoke-RestMethod -Uri http://localhost:5000/api/health -Method GET

# Or using curl / bash
curl -i http://localhost:5000/api/health
```

### Expected Response
```json
{
  "status": "ok",
  "service": "TrustVault API",
  "timestamp": "2026-10-20T03:42:00.000Z",
  "uptime": 14.52,
  "environment": "development"
}
```

> **Security Note**: This endpoint strictly returns high-level service status and uptime. It never leaks database credentials, internal server paths, system environment variables, or package versions.

---

## 7. Environment Configuration Instructions

Configuration is handled strictly via environment variables.

1. **Never commit `.env` files**: All `.env` files are ignored in `.gitignore`.
2. **Template files (`.env.example`)**: Only committed as reference examples with safe placeholders.
3. **Variable overview**:
   - `PORT`: Network port for Express backend (default: `5000`).
   - `NODE_ENV`: Runtime environment (`development`, `test`, `production`).
   - `CLIENT_URL`: Trusted frontend origin for CORS policies (default: `http://localhost:5173`).
   - `MONGODB_URI`: Connection string for MongoDB (default: local connection, non-blocking in Stage 1).

---

## 8. Known Limitations (Stage 1)

1. **Dashboard Data is Fictional**: All documents, users, activity timestamps, and statistics displayed on the frontend are mock demonstration data. They do not persist across reloads or reflect any database state.
2. **Action Buttons are Informational**: Interactive controls such as "Upload Document", "Share", and row-level menus trigger informative modal placeholders explaining that the capability is scheduled for subsequent development stages.
3. **Database Connection is Inactive**: The backend does not require or attempt a live MongoDB connection during Stage 1 health checks, preventing local startup blocks.

---

## 9. Development Roadmap

| Stage | Milestone | Status |
| :---: | :--- | :---: |
| **Stage 1** | **Project Foundation, Architecture & Dashboard UI** | 🟡 Current |
| **Stage 2** | User Authentication, Password Hashing & RBAC Foundation | ⚪ Planned |
| **Stage 3** | Secure Document Metadata & Private File Storage | ⚪ Planned |
| **Stage 4** | Granular Per-Document Permissions (Read/Edit Access Lists) | ⚪ Planned |
| **Stage 5** | Immediate Access Revocation & Session Invalidation | ⚪ Planned |
| **Stage 6** | Immutable Audit Logging & Activity Trail | ⚪ Planned |
| **Stage 7** | Document Search, Metadata Indexing & Upload Sanitisation | ⚪ Planned |
| **Stage 8** | Administrator Dashboard, Compliance & User Governance | ⚪ Planned |
| **Stage 9** | Automated Security Integration Tests & Penetration Verification | ⚪ Planned |
| **Stage 10** | Production Hardening, Seed Data, Final Demo & Submission | ⚪ Planned |

For thorough details on each stage's deliverables and verification criteria, refer to [`docs/DEVELOPMENT_PLAN.md`](./docs/DEVELOPMENT_PLAN.md).
