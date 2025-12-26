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

async function callKeepAlive(session, innerMethod, innerParams, id = 1000) {
  const payload = {
    method: "global.keepAlive",
    params: {
      method: innerMethod,
      params: innerParams,
      id,
      session
    }
  };

  const resp = await axios.post(URL, payload);
  return resp.data;
}

(async () => {
  const session = await login();
  console.log("✅ session:", session);

  // ✅ TESTE GARANTIDO: esse você já viu funcionando no DevTools
  const r = await callKeepAlive(
    session,
    "AccessUser.startFind",
    { Condition: { UserID: "777" } },
    313
  );

  console.log(JSON.stringify(r, null, 2));
})().catch(e => {
  console.error("ERRO:", e.message);
  if (e.response) console.error(JSON.stringify(e.response.data, null, 2));
});