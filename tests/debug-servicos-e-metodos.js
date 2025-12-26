const axios = require("axios");

const IP = process.env.FACIAL_IP || "192.168.3.227";
const USER = process.env.FACIAL_USER || "admin";
const PASS = process.env.FACIAL_PASS || "g274050nf.";
const URL_LOGIN = `http://${IP}/RPC2_Login`;
const URL = `http://${IP}/RPC2`;
const crypto = require("crypto");

function dhHash(user, pass, realm, random) {
  const passHash = crypto.createHash("md5").update(`${user}:${realm}:${pass}`).digest("hex").toUpperCase();
  return crypto.createHash("md5").update(`${user}:${random}:${passHash}`).digest("hex").toUpperCase();
}

async function login() {
  const step1 = await axios.post(URL_LOGIN, {
    method: "global.login",
    params: { userName: USER, password: "", clientType: "Web3.0" },
    id: 1,
  });

  const ch = step1.data.params;

  const step2 = await axios.post(URL_LOGIN, {
    method: "global.login",
    params: {
      userName: USER,
      password: dhHash(USER, PASS, ch.realm, ch.random),
      clientType: "Web3.0",
      authorityType: ch.encryption,
    },
    session: step1.data.session,
    id: 2,
  });

  return step2.data.session;
}

async function rpc(session, method, params = {}, id = 100) {
  const { data } = await axios.post(URL, { method, params, session, id });
  return data;
}

async function main() {
  const session = await login();
  console.log("✅ session:", session);

  console.log("\n== system.listService ==");
  const services = await rpc(session, "system.listService", {}, 10);
  console.log(JSON.stringify(services, null, 2));

  // Tenta listar métodos DO SERVIÇO (muitos firmwares suportam "service" aqui)
  for (const service of ["AccessUser", "AccessPersonInfo", "accessControl", "userManager", "faceRecognitionServer"]) {
    console.log(`\n== system.listMethod (service=${service}) ==`);
    const res = await rpc(session, "system.listMethod", { service }, 20);
    console.log(JSON.stringify(res, null, 2));
  }

  // E tenta assinatura dos métodos que você suspeita (isso costuma funcionar mesmo quando listMethod falha)
  for (const m of ["AccessUser.insertMulti", "AccessUser.updateMulti", "AccessUser.removeMulti"]) {
    console.log(`\n== system.methodSignature (${m}) ==`);
    const sig = await rpc(session, "system.methodSignature", { method: m }, 30);
    console.log(JSON.stringify(sig, null, 2));
  }
}

main().catch((e) => {
  console.error("❌ erro:", e.message);
  if (e.response?.data) console.error(JSON.stringify(e.response.data, null, 2));
});
