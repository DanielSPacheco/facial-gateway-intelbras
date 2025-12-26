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

(async () => {
  const session = await login();
  console.log("✅ session:", session);

  const resp = await axios.post(URL, {
    method: "system.listService",
    params: null,
    session,
    id: 10
  });

  console.log("\n📦 system.listService response:\n", JSON.stringify(resp.data, null, 2));
})().catch(e => {
  console.error("ERRO:", e.message);
  if (e.response) console.error(JSON.stringify(e.response.data, null, 2));
});