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

async function rpc(session, method, params, id = 313) {
  const { data } = await axios.post(
    URL,
    { method, params, session, id },
    { headers: { "Content-Type": "application/json", Connection: "close" }, timeout: 15000 }
  );
  return data;
}

(async () => {
  const session = await login();
  console.log("✅ session:", session);

  // 1) startFind
  const start = await rpc(session, "AccessUser.startFind", { Condition: { UserID: "777" } }, 1001);
  console.log("\nSTART:", JSON.stringify(start, null, 2));

  // se ele te der Token, tenta doFind
  const token = start?.params?.Token;
  if (token) {
    const find = await rpc(session, "AccessUser.doFind", { Token: token, Offset: 0, Count: 50 }, 1002);
    console.log("\nDOFIND:", JSON.stringify(find, null, 2));

    const stop = await rpc(session, "AccessUser.stopFind", { Token: token }, 1003);
    console.log("\nSTOP:", JSON.stringify(stop, null, 2));
  } else {
    console.log("\n⚠️ Não veio Token. Me manda esse START pra eu ver o erro.");
  }
})();