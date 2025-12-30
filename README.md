Facial Gateway – Intelbras RPC API
Node.js (Express) gateway to integrate with Intelbras facial access controllers using
RPC2 / RPC2_Login / RPC3_Loadfile.
This project exposes a clean HTTP API to control Intelbras facial devices without relying on browser sessions.
🚀 Features
✅ Open door
✅ Create user (AccessUser.insertMulti)
✅ Update user (AccessUser.updateMulti)
✅ Delete user (AccessUser.removeMulti)
✅ Get user by ID
✅ Card / Tag assignment (AccessCard.insertMulti)
🔜 Face image upload (RPC3_Loadfile)

🧱 Tech Stack
Node.js 18+
Express
Axios
Intelbras RPC API (RPC2 / RPC2_Login)

⚙️ Setup
Requirements
Node.js 18+
Intelbras facial controller reachable on the network
Admin credentials for the device

Environment variables
Create a .env file in the project root:

FACIAL_IP=192.168.3.227
FACIAL_USER=admin
FACIAL_PASS=your_password_here
FACIAL_CHANNEL=1
PORT=3000


▶️ Run the server

npm install
node index.js

Health check:

curl http://localhost:3000/health

🔐 Door Control
Open door

curl -X POST http://localhost:3000/facial/door/open


👤 Users
Create user

curl -X POST http://localhost:3000/facial/user/create \
  -H "Content-Type: application/json" \
  -d '{
    "userID": "888",
    "userName": "User 888",
    "password": "1234",
    "authority": 2
  }'


  Get user by ID

curl http://localhost:3000/facial/user/888


Update user

curl -X POST http://localhost:3000/facial/user/update \
  -H "Content-Type: application/json" \
  -d '{
    "userID": "888",
    "userName": "User 888 RENAMED"
  }'


Delete user

curl -X POST http://localhost:3000/facial/user/delete \
  -H "Content-Type: application/json" \
  -d '{
    "userID": "888"
  }'


🪪 Cards / Tags (RFID)
Assign card to user ✅

curl -X POST http://localhost:3000/facial/card/add \
  -H "Content-Type: application/json" \
  -d '{
    "userID": "888",
    "cardNo": "3333333333333333"
  }'

ℹ️ Cards are managed as a separate entity using AccessCard.insertMulti.
Browser cookies are not used — sessions are handled via RPC2 login.

📌 API Summary

| Feature     | Endpoint               | Method |
| ----------- | ---------------------- | ------ |
| Health      | `/health`              | GET    |
| Open door   | `/facial/door/open`    | POST   |
| Create user | `/facial/user/create`  | POST   |
| Get user    | `/facial/user/:userID` | GET    |
| Update user | `/facial/user/update`  | POST   |
| Delete user | `/facial/user/delete`  | POST   |
| Assign card | `/facial/card/add`     | POST   |
| Upload face | `/facial/face/upload`  | 🔜     |


🧠 Design Notes
RPC2 session is handled by backend (rpc2Login)
No dependency on browser cookies
Users and cards are separate entities
Safe for Raspberry Pi / embedded gateway usage
Ready for UI (web or mobile) on top


✅ Status
MVP functional and stable
Door + Users + Cards working end-to-end.




