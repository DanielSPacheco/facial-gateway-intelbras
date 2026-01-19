# Facial Gateway – Intelbras RPC Platform

Production-ready Gateway + API + Local Agent + SaaS-ready Architecture for Intelbras Facial Access Controllers.

This project transforms Intelbras RPC2 / CGI protocols into a secure, scalable and cloud-friendly control platform.

Designed for:
- Condominiums
- Enterprises
- SaaS platforms
- Remote access control
- Multi-device environments

---

## 🚀 What This Platform Solves

Intelbras devices are:
- LAN-only
- Session-based
- Browser-dependent
- Hard to integrate remotely

This project provides:
- ✅ Clean REST API
- ✅ Secure remote access
- ✅ Zero inbound ports on client networks
- ✅ Multi-tenant ready
- ✅ UI + Mobile ready
- ✅ Distributed execution

---

## 🧠 Architecture Overview

```text
┌───────────────┐
│   Web / App   │   (Next.js / Mobile)
│  Frontend UI  │
└───────┬───────┘
        │ HTTPS + JWT (Supabase Auth)
        ▼
┌─────────────────────┐
│     Gateway API      │
│  facial-gateway-api  │
│                      │
│ - Auth validation    │
│ - Device resolver    │
│ - RPC abstraction    │
│ - Permission layer   │
└─────────┬────────────┘
          │ LAN
          ▼
┌─────────────────────┐
│ Intelbras Facial Dev │
│ RPC2 / CGI / Loadfile│
└─────────────────────┘
```

**Optional Distributed Mode:**

```text
┌──────────────┐       ┌────────────────┐
│   Supabase   │◀────▶ │  Facial Agent  │
│ Jobs Queue   │       │ Local Executor │
└──────────────┘       └────────────────┘
```

---

## 🧩 System Components

### 1️⃣ Gateway API (Main Backend)

Runs close to devices or in private cloud.

**Responsibilities:**
- RPC2 authentication
- CGI snapshot proxy
- Event photo download (RPC_Loadfile)
- JWT authentication
- Tenant isolation
- Permission enforcement
- Device routing

### 2️⃣ Facial Agent (Optional Worker)

Used in enterprise deployments.

**Responsibilities:**
- Poll Supabase jobs
- Execute commands locally
- Avoid inbound NAT exposure
- Offline tolerant execution

### 3️⃣ Frontend (External Project)

The frontend NEVER connects directly to devices.

It only:
- Authenticates with Supabase
- Calls Gateway API
- Reads tenant data using RLS

---

## 🧱 Tech Stack

- Node.js 18+
- Express
- Axios + Curl Digest
- Sharp (image compression)
- Intelbras RPC API (`RPC2 / CGI / RPC_Loadfile`)
- Supabase (`Auth + Postgres + RLS`)
- Next.js UI (external project)

---

## ✅ Features

### Access Control
- ✅ Open door
- ✅ Remote unlock
- ✅ Live snapshot
- ✅ Event history
- ✅ Event photo preview

### User Management
- ✅ Create user
- ✅ Update user
- ✅ Delete user
- ✅ Assign card/tag
- ✅ Face enrollment (Base64 + auto compression)

### Enterprise
- ✅ Multi-device
- ✅ Multi-tenant
- ✅ Role-based access
- ✅ Audit logs
- ✅ SaaS-ready architecture

---

## 🔐 Authentication Model

All requests use Supabase JWT:

```bash
Authorization: Bearer eyJhbGciOi...
```

Gateway validates token and extracts:
- `user_id`
- `tenant_id`
- `role`

**Guarantees:**
- Secure isolation
- Audit traceability
- Permission enforcement

---

## ⚙️ Installation

### Requirements

- Node.js 18+
- Intelbras facial controller
- Device admin credentials

### Environment Variables

Create a `.env` file in the project root:

```env
PORT=4000

# Default single device fallback
FACIAL_IP=192.168.3.227
FACIAL_USER=admin
FACIAL_PASS=password
FACIAL_CHANNEL=1

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
SUPABASE_JWT_SECRET=jwt_secret_here

TIMEOUT_MS=15000
```

### Install Dependencies

```bash
npm install
```

### Run Gateway

```bash
node index.js
```

**Expected output:**

```yaml
FACIAL GATEWAY STARTED
PORT: 4000
FACIAL_IP: 192.168.3.227
TIMEOUT_MS: 15000
```

### Health Check

```bash
curl http://localhost:4000/health
```

---

## 🌐 API Endpoints

### Door Control

```bash
curl -X POST http://localhost:4000/facial/door/open \
  -H "Authorization: Bearer TOKEN"
```

### Live Snapshot

```bash
curl http://localhost:4000/facial/events/DEVICE_ID/photo?mode=snapshot \
  -H "Authorization: Bearer TOKEN"
```

**Returns:** `image/jpeg`

### Access Events List

```bash
curl "http://localhost:4000/facial/events/DEVICE_ID?from=2026-01-19T00:00:00-03:00&to=2026-01-20T00:00:00-03:00" \
  -H "Authorization: Bearer TOKEN"
```

### Event Photo Proxy

Downloads image stored on device:

```bash
curl "http://localhost:4000/facial/events/DEVICE_ID/photo?url=/mnt/appdata1/userpic/SnapShot/2026/photo.jpg" \
  -H "Authorization: Bearer TOKEN"
```

### Create User

```bash
curl -X POST http://localhost:4000/facial/user/create \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userID": "888",
    "userName": "John Doe",
    "authority": 2
  }'
```

### Update User

```bash
curl -X POST http://localhost:4000/facial/user/update \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userID": "888",
    "userName": "John Updated"
  }'
```

### Delete User

```bash
curl -X POST http://localhost:4000/facial/user/delete \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userID": "888"
  }'
```

### Assign Card

```bash
curl -X POST http://localhost:4000/facial/card/add \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userID": "888",
    "cardNo": "3333333333333333"
  }'
```

---

## 📸 Face Enrollment

### Requirements

- JPG format
- One face only
- Good lighting
- No sunglasses
- Auto compression enabled
- Final payload ≤ 14KB

### Upload File

```bash
curl -X POST http://localhost:4000/facial/face/upload \
  -H "Authorization: Bearer TOKEN" \
  -F userID=777 \
  -F file=@photo.jpg
```

### Upload Base64

```bash
curl -X POST http://localhost:4000/facial/face/uploadBase64 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userID": "777",
    "photoData": "data:image/jpeg;base64,..."
  }'
```

---

## 🤖 Facial Agent (Optional)

Used for job-based distributed execution.

### Agent Environment Variables

Create `gateway/facial-agent/.env`:

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx

SITE_ID=uuid
AGENT_ID=uuid

GATEWAY_BASE_URL=http://127.0.0.1:4000
POLL_INTERVAL_MS=1500
```

### Run Agent

```bash
node agent.js
```

**Expected output:**

```yaml
🤖 FACIAL AGENT STARTED
SITE_ID : ...
AGENT_ID: ...
GATEWAY : http://127.0.0.1:4000
```

---

## 📋 API Summary

| Feature           | Endpoint                           | Method |
| ----------------- | ---------------------------------- | ------ |
| Health            | `/health`                          | GET    |
| Open door         | `/facial/door/open`                | POST   |
| Live snapshot     | `/facial/events/:id/photo`         | GET    |
| Access events     | `/facial/events/:id`               | GET    |
| Event photo       | `/facial/events/:id/photo`         | GET    |
| Create user       | `/facial/user/create`              | POST   |
| Update user       | `/facial/user/update`              | POST   |
| Delete user       | `/facial/user/delete`              | POST   |
| Assign card       | `/facial/card/add`                 | POST   |
| Upload face file  | `/facial/face/upload`              | POST   |
| Upload face Base64| `/facial/face/uploadBase64`        | POST   |

---

## 🔐 Security Design

- ✅ Devices never exposed to internet
- ✅ Gateway holds credentials
- ✅ JWT protected API
- ✅ Tenant isolation via Supabase RLS
- ✅ LAN execution supported
- ✅ NAT friendly
- ✅ SaaS compatible

---

## ✅ Production Status

- ✅ RPC2 stable
- ✅ Snapshot proxy stable
- ✅ Event photos stable
- ✅ Compression tuned
- ✅ Multi-device routing
- ✅ JWT protected
- ✅ UI integrated

---

## 📝 Design Notes

- RPC2 session handled entirely by backend
- No browser cookies required
- Users, cards, and faces are independent entities
- Automatic image preprocessing for firmware compatibility
- Safe for Raspberry Pi / embedded gateway usage

---

## 🛡️ Security Notes

- The Gateway runs only inside the local network
- No inbound ports are required
- All remote control is job-based and outbound-only
- Safe for corporate and residential environments