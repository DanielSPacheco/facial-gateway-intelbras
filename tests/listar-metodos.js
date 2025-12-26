const axios = require("axios");
const crypto = require("crypto");

const IP = "192.168.3.227";
const USER = "admin";
const PASS = "g274050nf.";
const URL_LOGIN = `http://${IP}/RPC2_Login`;
const URL = `http://${IP}/RPC2`;

function calcularHash(user, pass, realm, random) {
  const passHash = crypto.createHash("md5").update(`${user}:${realm}:${pass}`).digest("hex").toUpperCase();
  return crypto.createHash("md5").update(`${user}:${random}:${passHash}`).digest("hex").toUpperCase();
}

async function login() {
  const step1 = await axios.post(URL_LOGIN, {
    method: "global.login",
    params: { userName: USER, password: "", clientType: "Web3.0" },
    id: 1
  });

  const ch = step1.data.params;

  const step2 = await axios.post(URL_LOGIN, {
    method: "global.login",
    params: {
      userName: USER,
      password: calcularHash(USER, PASS, ch.realm, ch.random),
      clientType: "Web3.0",
      authorityType: ch.encryption
    },
    session: step1.data.session,
    id: 2
  });

  return step2.data.session;
}

// tenta vários nomes porque isso varia por firmware
async function listMethods(session, service) {
  const candidates = [
    { method: "system.listMethod", params: { service } },
    { method: "system.listMethods", params: { service } },
    { method: "system.listMethod", params: service },
    { method: "system.listMethods", params: service },
  ];

  for (const c of candidates) {
    try {
      const resp = await axios.post(URL, { ...c, session, id: 100 });
      if (resp.data?.result !== false) return { ok: true, used: c.method, data: resp.data };
    } catch (e) {
      // segue tentando
    }
  }
  return { ok: false };
}

(async () => {
  const session = await login();
  console.log("✅ session:", session);

  // os mais prováveis no seu caso:
  const services = ["AccessUser", "AccessPersonInfo", "AccessFace", "accessControl", "userManager", "faceRecognitionServer"];

  for (const s of services) {
    const r = await listMethods(session, s);
    console.log("\n==============================");
    console.log("SERVICE:", s);
    if (!r.ok) {
      console.log("❌ Não consegui listar métodos (firmware não expõe listMethod).");
      continue;
    }
    console.log("✅ Usou:", r.used);
    console.log(JSON.stringify(r.data, null, 2));
  }
})().catch(e => {
  console.error("ERRO:", e.message);
  if (e.response) console.error(JSON.stringify(e.response.data, null, 2));
});