Gateway HTTP local para controle de equipamentos faciais Intelbras (abertura de porta, cadastro de usuários e faces), utilizando Digest Authentication via curl.

Este projeto atua como um middleware entre sistemas cloud (ou aplicações locais) e o equipamento facial, evitando exposição direta do dispositivo à internet.

Cloud / App / API
        ↓
   Facial Gateway (Node.js)
        ↓
   Equipamento Facial Intelbras (LAN)

POST /facial/door/open

curl -X POST http://localhost:3000/facial/door/open

{
  "message": "command_sent",
  "command": "openDoor",
  "httpCode": 200
}
