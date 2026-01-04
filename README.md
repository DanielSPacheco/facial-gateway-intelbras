# Facial Gateway – Intelbras RPC API

Node.js (Express) gateway to integrate with **Intelbras facial access controllers** using  
**RPC2 / RPC2_Login / RPC3_Loadfile**.

This project exposes a clean HTTP API to control Intelbras facial devices **without relying on browser sessions, SDKs, or cookies**.

---

## 🚀 Features

- ✅ Open door  
- ✅ Create user (`AccessUser.insertMulti`)  
- ✅ Update user (`AccessUser.updateMulti`)  
- ✅ Delete user (`AccessUser.removeMulti`)  
- ✅ Get user by ID  
- ✅ Card / Tag assignment (`AccessCard.insertMulti`)  
- ✅ Face image upload (**WORKING**)  

---

## 🚀 Distributed Execution

- ✅ Supabase-based job queue
- ✅ Local agent execution (safe for LAN / Raspberry Pi)
- ✅ Multi-site / multi-device ready
- ✅ No inbound ports required on client network 

---

## Architecture Overview


```text
┌─────────────┐        ┌─────────────────┐        ┌──────────────────┐
│  Web / App  │ ───▶   │   Supabase DB   │ ───▶   │  Facial Agent    │
│ (future UI) │        │   jobs table    │        │ (local worker)   │
└─────────────┘        └─────────────────┘        └────────┬─────────┘
                                                              │
                                                              ▼
                                                     ┌─────────────────┐
                                                     │  Gateway API    │
                                                     │ (Express / RPC) │
                                                     └─────────────────┘
                                                              │
                                                              ▼
                                                     Intelbras Facial

```

## Gateway

Runs locally on the same network as the Intelbras device.

Responsibilities:

- Handle RPC2 authentication
- Normalize intelbras RPC calls
- Expose a clean REST API

Expose a clean REST API

## Facial Agent (/gateway/facial-agent)

A local worker that:

- Polls Supabase for pending jobs
- Executes commands by calling the local Gateway
- Updates job status (done / failed)

This allows:

- Remote control without exposing the device
- Multi-tenant / multi-site scalability
- Safe execution inside customer networks

## 🧱 Tech Stack

- Node.js 18+
- Express
- Axios
- Sharp (image preprocessing)
- Intelbras RPC API (`RPC2 / RPC2_Login / RPC3_Loadfile`)
- Supabase (`Postgres + RPC functions`)

---

## ⚙️ Setup

### Requirements

- Node.js 18+
- Intelbras facial controller reachable on the network
- Admin credentials for the device

### Environment variables

Create a `.env` file in the project root:

``` .env
FACIAL_IP=192.168.3.227
FACIAL_USER=admin
FACIAL_PASS=your_password_here
FACIAL_CHANNEL=1
PORT=3000

```

## ▶️ Run the server

- Install dependencies:

```bash
npm install

```

## Run the server

```bash
curl http://localhost:3000/health

```

## Facial Agent Setup (Job Worker)

## The agent lives in:

```bash
gateway/facial-agent

```

## Environment variables

- This project uses multiple `.env` files.

Create `gateway/facial-agent/.env:`

``` .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxxxxxxxxxxxxxxx

SITE_ID=uuid-from-public.sites
AGENT_ID=uuid-from-public.agents

GATEWAY_BASE_URL=http://127.0.0.1:3000
POLL_INTERVAL_MS=1500

```

⚠️ `AGENT_ID` must exist in `public.agents`
`jobs.agent_id` has a foreign key constraint.

## Run the Agent

```bash
node agent.js

```

## Expected output:


```yaml
🤖 FACIAL AGENT STARTED
SITE_ID : ...
AGENT_ID: ...
GATEWAY : http://127.0.0.1:3000
POLL   : 1500 ms

```

## Sending Commands (Jobs)

- Example: open door:

```sql
insert into public.jobs (site_id, type, payload, status)
values (
  'SITE_UUID',
  'open_door',
  '{"channel": 1}'::jsonb,
  'pending'
);

```
The agent will:
- Pick the job
- Call the gateway
- Update status to done
- Execute the action physically on the device

## Gateway API Examples

## Door control

```bash
curl -X POST http://localhost:3000/facial/door/open

```

## User-Create

```bash
curl -X POST http://localhost:3000/facial/user/create \
  -H "Content-Type: application/json" \
  -d '{
    "userID": "888",
    "userName": "User 888",
    "password": "1234",
    "authority": 2
  }'

```

## Users-Get by ID

```bash
curl http://localhost:3000/facial/user/888

```

##User-Uptade
```bash
curl -X POST http://localhost:3000/facial/user/update \
  -H "Content-Type: application/json" \
  -d '{
    "userID": "888",
    "userName": "User 888 RENAMED"
  }'

  ```

## User-Delete

```bash
curl -X POST http://localhost:3000/facial/user/delete \
  -H "Content-Type: application/json" \
  -d '{
    "userID": "888"
  }'

```

## Cards/Tags-Assign

```bash
curl -X POST http://localhost:3000/facial/card/add \
  -H "Content-Type: application/json" \
  -d '{
    "userID": "888",
    "cardNo": "3333333333333333"
  }'

```

## Face enrollment (Working)

```bash
JPG format
One person only
Frontal face
Good lighting
No heavy shadows or sunglasses
Final request size <= 14 KB
Typical resolution 160–220 px

```

## Face enrollment-Upload file

```bash
curl -X POST http://localhost:3000/facial/face/upload \
  -F userID=777 \
  -F file=@/path/to/photo.jpg

```

## Face enrollment-Upload Base64

```bash
curl -X POST http://localhost:3000/facial/face/uploadBase64 \
  -H "Content-Type: application/json" \
  -d '{
    "userID": "777",
    "photoData": "data:image/jpg;base64,/9j/4AAQSkZJRgABAQ..."
  }'

```

## Common erros

Request length error
Payload format not accepted by firmware
Not only size-related

Batch Process Error
Face not detected or poor quality
Improve lighting and face position


## API Summary

| Feature     | Endpoint                    | Method |
| ----------- | --------------------------- | ------ |
| Health      | `/health`                   | GET    |
| Open door   | `/facial/door/open`         | POST   |
| Create user | `/facial/user/create`       | POST   |
| Get user    | `/facial/user/:userID`      | GET    |
| Update user | `/facial/user/update`       | POST   |
| Delete user | `/facial/user/delete`       | POST   |
| Assign card | `/facial/card/add`          | POST   |
| Upload face | `/facial/face/upload`       | POST   |
| Upload face | `/facial/face/uploadBase64` | POST   |


## Design Notes

RPC2 session handled entirely by backend
No browser cookies required
Users, cards, and faces are independent entities
Automatic image preprocessing for firmware compatibility
Safe for Raspberry Pi / embedded gateway usage


## Status

RPC2 session handled entirely by backend
No browser cookies required
Users, cards, and faces are independent entities
Automatic image preprocessing for firmware compatibility
Safe for Raspberry Pi / embedded gateway usage


## Security Notes

- The Gateway runs only inside the local network
- No inbound ports are required
- All remote control is job-based and outbound-only
- Safe for corporate and residential environments