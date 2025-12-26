const axios = require("axios");
const crypto = require("crypto");

const IP = "192.168.3.227";
const USER = "admin";
const PASS = "g274050nf.";
const URL_LOGIN = `http://${IP}/RPC2_Login`;
const URL = `http://${IP}/RPC2`;

function md5Upper(s) {
  return crypto.createHash("md5").update(s).digest("hex").toUpperCase();
}
function calcularHash(user, pass, realm, random) {
  const passHash = md5Upper(`${user}:${realm}:${pass}`);
  return md5Upper(`${user}:${random}:${passHash}`);
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
      password: calcularHash(USER, PASS, ch.realm, ch.random),
      clientType: "Web3.0",
      authorityType: ch.encryption,
    },
    session: step1.data.session,
    id: 2,
  });

  return step2.data.session;
}

// tenta methodHelp e methodSignature com nome completo do método
async function probe(session, fullMethodName) {
  const tries = [
    { method: "system.methodHelp", params: { methodName: fullMethodName } },
    { method: "system.methodHelp", params: fullMethodName },
    { method: "system.methodSignature", params: { methodName: fullMethodName } },
    { method: "system.methodSignature", params: fullMethodName },
  ];

  for (const t of tries) {
    try {
      const r = await axios.post(URL, { ...t, session, id: 500 });
      // se não der erro “method not found”, já é um sinal
      return { ok: true, used: t.method, data: r.data };
    } catch (e) {
      if (e.response?.data) {
        const msg = JSON.stringify(e.response.data);
        if (!msg.toLowerCase().includes("method not found")) {
          return { ok: true, used: t.method, data: e.response.data };
        }
      }
    }
  }
  return { ok: false };
}

(async () => {
  const session = await login();
  console.log("✅ session:", session);

  // lista curta e certeira (a gente expande se precisar)
  const candidates = [
    "AccessUser.addUser",
    "AccessUser.insert",
    "AccessUser.add",
    "AccessUser.setUser",
    "AccessPersonInfo.add",
    "AccessPersonInfo.insert",
    "AccessPersonInfo.addPerson",
    "AccessPersonInfo.set",
    "accessControl.addUser",
    "userManager.addUser",
    "faceRecognitionServer.addPerson",
  ];

  for (const name of candidates) {
    const r = await probe(session, name);
    if (r.ok) {
      console.log("\n=======================");
      console.log("FOUND-ish:", name, "via", r.used);
      console.log(JSON.stringify(r.data, null, 2));
    }
  }

  console.log("\nFim. Se não achou nada, DevTools é obrigatório.");
})().catch((e) => {
  console.error("ERRO:", e.message);
  if (e.response) console.error(JSON.stringify(e.response.data, null, 2));
});
