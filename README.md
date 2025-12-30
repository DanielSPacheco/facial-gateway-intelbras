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

## 🧱 Tech Stack

- Node.js 18+
- Express
- Axios
- Sharp (image preprocessing)
- Intelbras RPC API (`RPC2 / RPC2_Login / RPC3_Loadfile`)

---

## ⚙️ Setup

### Requirements

- Node.js 18+
- Intelbras facial controller reachable on the network
- Admin credentials for the device

### Environment variables

Create a `.env` file in the project root:

```env
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

## ▶️ Run the server

- Install dependencies:

```bash
npm install

```

## Run the server

```bash
curl http://localhost:3000/health

```

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
