# Facial Gateway – Intelbras RPC API

Node.js (Express) gateway to integrate with **Intelbras facial access controllers** using
**RPC2 / RPC2_Login / RPC3_Loadfile**.

This project exposes a clean HTTP API to:
- Open doors
- Create, read, update and delete users
- (Next) Manage cards / tags
- (Next) Upload and bind face images

---

## 🚀 Features

- ✅ Door open command
- ✅ User creation (confirmed via `AccessUser.insertMulti`)
- ✅ User update (`AccessUser.updateMulti`)
- ✅ User deletion (`AccessUser.removeMulti`)
- ✅ User query by ID
- 🔜 Card / Tag management
- 🔜 Face image upload (RPC3_Loadfile)

---

## 🧱 Tech Stack

- Node.js
- Express
- Axios
- Intelbras RPC API (RPC2 / RPC2_Login)

---

## ⚙️ Setup

### Requirements
- Node.js 18+
- Intelbras device reachable on the network
- Admin credentials

### Environment variables

Create a `.env` file **in the same folder as `index.js`**:

```env
FACIAL_IP=192.168.3.227
FACIAL_USER=admin
FACIAL_PASS=your_password_here
PORT=3000


Open door

curl -X POST http://localhost:3000/facial/door/open


Create user

curl -X POST http://localhost:3000/facial/user/create ^
  -H "Content-Type: application/json" ^
  -d "{\"userID\":\"888\",\"userName\":\"User 888\",\"password\":\"1234\"}"


Playload exemple

{
  "userID": "888",
  "userName": "John Doe",
  "password": "1234",
  "authority": 2
}

Get user by ID

curl http://localhost:3000/facial/user/888


Uptade user 

curl -X POST http://localhost:3000/facial/user/update ^
  -H "Content-Type: application/json" ^
  -d "{\"userID\":\"888\",\"userName\":\"User 888 RENAMED\"}"


Delete User

curl -X POST http://localhost:3000/facial/user/delete ^
  -H "Content-Type: application/json" ^
  -d "{\"userID\":\"888\"}"
