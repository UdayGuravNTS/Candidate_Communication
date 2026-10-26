# 🚀 Candidate Communication Platform (Hunar AI)

An enterprise-ready, full-stack recruitment communication hub designed to manage candidates, send single and bulk personalized communications across multiple channels (**Email**, **WhatsApp**, **SMS**), track delivery lifecycles in real-time, handle delivery failures with intelligent retries, and monitor provider health with chaos testing capabilities.

---

## 📋 Table of Contents
- [Architecture & Design Decisions](#-architecture--design-decisions)
- [System Architecture Diagram](#-system-architecture-diagram)
- [Completed Features](#-completed-features)
- [Bonus Features](#-bonus-features-implemented)
- [Assumptions Made](#-assumptions-made)
- [Setup & Installation Guide](#-setup--installation-guide)
  - [1. Prerequisites](#1-prerequisites)
  - [2. Backend Setup (Django)](#2-backend-setup-django)
  - [3. Dummy Provider Setup (Flask Webhook Simulation)](#3-dummy-provider-setup-flask)
  - [4. Frontend Setup (React + Vite)](#4-frontend-setup-react--vite)
- [Testing & Edge Case Scenarios](#-testing--edge-case-scenarios)
- [API Reference](#-api-reference)
- [Environment Variables](#-environment-variables)

---

## 🏛 Architecture & Design Decisions

The application is structured into three clean, decoupled layers:

```
┌──────────────────────────────────────────────────────────┐
│              Frontend (React + Vite SPA)                 │
│  - Candidate Table, Drawer, Filter & Search              │
│  - Single / Bulk Send Modal with Template Selector       │
│  - Provider Health & Outage Simulation Dashboard         │
└────────────────────────────┬─────────────────────────────┘
                             │  REST API (HTTP / JSON)
┌────────────────────────────▼─────────────────────────────┐
│             Backend (Django REST Framework)              │
│  - Data Models: Candidate, Message, Template, Event      │
│  - Messaging Engine & Worker: ThreadPoolExecutor         │
│  - Webhook Ingestion & Monotonic State Transitions       │
│  - Email Dispatcher (Gmail SMTP + HTML + Tracking Pixel) │
└─────────────┬───────────────────────────────┬────────────┘
              │                               │
              │ SMTP (Port 587)               │ HTTP Webhooks (Port 9000)
┌─────────────▼───────────────┐ ┌─────────────▼────────────┐
│      Real Email Service     │ │    Mock Messaging Engine │
│  - Gmail Transactional SMTP │ │  - Simulates WhatsApp/SMS│
│  - Open Pixel & Read Action │ │  - Latency, Chaos, Events│
└─────────────────────────────┘ └──────────────────────────┘
```

### 1. Backend Architecture (Django)
- **Modular Django App (`candidates`)**: Enforces separation of concerns between HTTP endpoint serialization (`views.py`), delivery and provider dispatch logic (`messaging.py`), and data persistence (`models.py`).
- **Resilient Message State Machine**:
  - Valid status flow: `Queued` / `Scheduled` $\rightarrow$ `Sent` $\rightarrow$ `Delivered` $\rightarrow$ `read` (or `Failed`).
  - **Monotonic Status Ranking**: Prevents stale, duplicate, or out-of-order webhook callbacks from rolling back messages (e.g. an out-of-order `Sent` callback cannot overwrite `Delivered` or `read`).
- **Webhook Idempotency & Deduplication**:
  - The `ProviderEvent` model logs incoming `eventId`s. Any repeated event delivery from WhatsApp/SMS providers is safely acknowledged and discarded without triggering redundant state writes.
- **Concurrent Dispatching via `ThreadPoolExecutor`**:
  - Bulk messages are dispatched concurrently using a worker pool (`max_workers=10`), avoiding request timeouts and ensuring fast response times for large recipient batches.
- **Real SMTP Integration with Email Open Tracking**:
  - Real emails are dispatched via Django's SMTP backend. Each outbound email includes a zero-friction 1x1 tracking pixel and an interactive recipient confirmation button that transitions the message status directly to `read`.

### 2. Frontend Architecture (React + Vite)
- **High-Performance Component Hierarchy**:
  - `CandidateCommunicationPage.jsx`: Top-level orchestrator maintaining candidate lists, filtering, sorting, pagination, and active drawers.
  - `SendMessageModal.jsx`: Versatile modal supporting single-candidate and bulk modes, template selection, live variable previews, channel toggles, and future-schedule date pickers.
  - `CandidateDrawer.jsx`: Slide-over timeline drawer displaying historical messages, status pills, failure reasons, and instant retry triggers.
  - `ProviderHealthModal.jsx`: Live provider diagnostic modal with aggregated delivery metrics and a simulated outage toggle.
- **Custom Design System**: Pure Vanilla CSS implementation (`App.css`) with curated color palettes, accessible contrasts, responsive drawer animations, and toast feedback.

---

## ✅ Completed Features

### 1. Candidate Directory & Management
- [x] **Add Candidate**: Modal with validation for Full Name, Email, Mobile Number, Role, and Internal Notes.
- [x] **Candidate Table**: Search by name/email/phone, filter by status (`Queued`, `Sent`, `Delivered`, `read`, `Failed`), date, and role.
- [x] **Candidate Profile Drawer**: Deep dive into candidate details, notes, and complete communication log.
- [x] **Delete Candidate**: Safe deletion with confirmation modal.
- [x] **Client-Side Pagination**: Smooth pagination with configurable items per page.

### 2. Messaging & Multi-Channel Delivery
- [x] **Single & Bulk Messaging**: Dispatch messages to a single candidate or select multiple candidates simultaneously.
- [x] **Dynamic Personalization**: Placeholders such as `{{candidate_name}}` and `{{role}}` automatically hydrate per candidate.
- [x] **Multi-Channel Dispatch**: Support for **Email**, **WhatsApp**, and **SMS**.
- [x] **Scheduled Delivery**: Queue messages for a specific date and time (`scheduled_at`).
- [x] **Lifecycle Tracking**: Real-time status updates reflecting `Queued`, `Scheduled`, `Sent`, `Delivered`, `read`, or `Failed`.

### 3. Fault Tolerance & Resilience
- [x] **Categorized Provider Errors**: Clear distinction between retryable errors (`RATE_LIMITED`, `TEMPORARY_FAILURE`, `TIMEOUT`, `UNAVAILABLE`) and non-retryable errors (`INVALID_RECIPIENT`, `AUTH_FAILED`).
- [x] **Smart Retry Engine**: Individual retry buttons for failed messages with exponential attempt tracking (`retry_count`).
- [x] **Secure Webhooks**: Webhook authentication via `X-Provider-Secret` header validation.

---

## 🌟 Bonus Features Implemented

1. **📧 Real Transactional Email Dispatch (Gmail SMTP)**:
   - Configured with real SMTP (`smtp.gmail.com:587`) sending branded, responsive HTML recruitment emails.
2. **👁️ Email Open Tracking & 1-Click Candidate Confirmation**:
   - Outbound emails contain a dynamic `<img>` 1x1 tracking pixel and an interactive **"Confirm & Mark as Read"** link. When the candidate opens or clicks, the message in the dashboard automatically upgrades to `read` status.
3. **⏰ Scheduled Messaging Pipeline**:
   - Full support for scheduling communications in advance, saved with `Scheduled` status, and processed via automated batch dispatchers.
4. **📑 Message Template Management System**:
   - Pre-loaded category templates (Interview, Assessment, Job Offer, Onboarding, Screening) with support for adding and deleting custom templates directly from the UI.
5. **🩺 Provider Health & Observability Dashboard**:
   - Dedicated modal providing real-time latency (ms), provider status (`operational`, `degraded`, `outage`), and global message counters (Total, Sent, Delivered, Read, Failed, Scheduled).
6. **⚡ Chaos Testing / One-Click Outage Simulation**:
   - Ability to simulate provider downtime directly from the UI. The backend catches the failure, marks messages as retryable, and updates provider health indicators.

---

## 💡 Assumptions Made

1. **Dual Provider Strategy**:
   - **Email** is configured for **real-world delivery** via SMTP so reviewers can test sending and receiving actual emails.
   - **WhatsApp & SMS** route through the included mock provider (`dummy_provider/app.py`) on port 9000. This simulates carrier delays, network drops, and webhooks safely without requiring expensive vendor credentials or Meta Business verification.
2. **Deterministic Test Phone Numbers**:
   - In WhatsApp/SMS mode, the dummy provider uses phone number suffix rules to simulate distinct edge cases:
     - Ends with `0000` $\rightarrow$ `INVALID_RECIPIENT` (400)
     - Ends with `1111` $\rightarrow$ `RATE_LIMITED` (429, retryable)
     - Ends with `2222` $\rightarrow$ `TEMPORARY_FAILURE` (503, retryable)
     - Ends with `3333` $\rightarrow$ Asynchronous failure via webhook (Unreachable phone)
     - Ends with `4444` $\rightarrow$ Asynchronous failure via webhook (Candidate opted out)
     - Any other number $\rightarrow$ Successful flow (`Sent` $\rightarrow$ `Delivered` $\rightarrow$ `read`)
3. **Database**:
   - SQLite is utilized for zero-configuration, instant local testing. Django's ORM ensures seamless switching to PostgreSQL or MySQL for production by changing `DATABASES` in `settings.py`.

---

## 🛠 Setup & Installation Guide

### 1. Prerequisites
- **Python**: 3.10 or higher
- **Node.js**: 18.0 or higher
- **npm** or **yarn**
- **Git**

---

### 2. Backend Setup (Django)

1. Open a terminal and navigate to the backend folder:
   ```bash
   cd Hunar_Ai_Backend
   ```

2. Create and activate a Python virtual environment:
   ```bash
   # Windows PowerShell
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # macOS / Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install required Python packages:
   ```bash
   pip install django django-cors-headers requests
   ```

4. Apply database migrations:
   ```bash
   python manage.py migrate
   ```

5. *(Optional)* Configure Email SMTP credentials in `communication/settings.py` or via environment variables (pre-configured with Gmail SMTP).

6. Start the Django server on **port 8001**:
   ```bash
   python manage.py runserver 8001
   ```
   *The backend will be live at `http://127.0.0.1:8001/`.*

---

### 3. Dummy Provider Setup (Flask)

The dummy provider simulates third-party messaging APIs (WhatsApp/SMS) and delivers webhooks back to Django.

1. Open a second terminal window:
   ```bash
   cd Hunar_Ai_Backend/dummy_provider
   ```

2. Install Flask:
   ```bash
   pip install flask requests
   ```

3. Start the dummy provider on **port 9000**:
   ```bash
   python app.py
   ```
   *The dummy provider will be live at `http://127.0.0.1:9000/`.*

---

### 4. Frontend Setup (React + Vite)

1. Open a third terminal window:
   ```bash
   cd Hunar_Ai_Frontend/Candidate_Communication
   ```

2. Install frontend dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The application will open at `http://localhost:5173/`.*

---

## 🧪 Testing & Edge Case Scenarios

| Test Case | Channel | Input / Action | Expected Result |
| :--- | :--- | :--- | :--- |
| **Real Email Delivery** | Email | Enter your actual email address, select Email channel, send. | Email arrives in your inbox with HTML styling, tracking pixel, and confirmation button. |
| **Email Read Tracking** | Email | Click the "Confirm & Mark as Read" button inside the email. | Message status updates to `read` in the candidate dashboard. |
| **Rate Limit Handling** | WhatsApp | Enter phone ending with `1111` (e.g., `9876541111`). | Returns 429 error; message marked as `Failed` with `can_retry = true`. Click **Retry** to resend. |
| **Temporary Provider Drop** | WhatsApp | Enter phone ending with `2222`. | Returns 503 error; retryable flag enabled. |
| **Asynchronous Carrier Failure** | WhatsApp | Enter phone ending with `3333`. | Initially shows `Sent`, then updates to `Failed` ("Phone unreachable") via webhook. |
| **Outage Simulation** | Any | Open **Provider Health** modal, click **Simulate Outage**. | System health indicates `outage`; sends queue and fail gracefully. |
| **Scheduled Dispatch** | Any | Select "Schedule for Later" and pick a time 2 minutes ahead. | Message is created in `Scheduled` status and dispatched once the time arrives. |

---

## 📡 API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/Get_candidates_lists/` | Fetch candidate list with nested messages and latest status |
| `POST` | `/api/candidates/` | Create a new candidate |
| `DELETE`| `/api/candidates/delete/<id>/` | Delete a candidate |
| `POST` | `/api/candidates/send-message/` | Dispatch single or bulk messages (immediate or scheduled) |
| `POST` | `/api/messages/<id>/retry/` | Retry a previously failed message |
| `POST` | `/api/messages/<id>/mark_read/` | Manually mark a message as read |
| `GET` | `/api/track/read/<id>/` | Read-tracking endpoint (pixel / acknowledgment redirect) |
| `GET` | `/api/templates/` | Retrieve all message templates |
| `POST` | `/api/templates/` | Create a new message template |
| `DELETE`| `/api/templates/<id>/` | Delete a message template |
| `GET` | `/api/provider/health/` | Aggregated provider status, latency, and counts |
| `POST` | `/api/provider/toggle-outage/` | Toggle simulated provider outage |
| `POST` | `/api/webhooks/provider/` | Ingest asynchronous delivery callbacks from provider |

---

## 🔐 Environment Variables

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PROVIDER_URL` | `http://localhost:9000` | Base URL for WhatsApp/SMS provider service |
| `PROVIDER_WEBHOOK_SECRET`| `dev-secret` | Shared secret header (`X-Provider-Secret`) for webhooks |
| `EMAIL_HOST` | `smtp.gmail.com` | SMTP host for email delivery |
| `EMAIL_PORT` | `587` | SMTP port (TLS) |
| `EMAIL_HOST_USER` | *(Configured)* | SMTP username / address |
| `EMAIL_HOST_PASSWORD` | *(Configured)* | Google App Password |
| `CORS_ALLOWED_ORIGINS`| `http://localhost:5173` | Allowed CORS origins for frontend |

---
  
## 👥 Authors & Acknowledgments
Built with ❤️ for **Hunar AI** Candidate Communication Assessment.