const axios = require("axios");
const crypto = require("crypto");

const IP = "192.168.3.227";
const USER = "admin";
const PASS = "g274050nf.";
const URL_LOGIN = `http://${IP}/RPC2_Login`;
const URL = `http://${IP}/RPC2`;

function md5Upper(s) { return crypto.createHash("md5").update(s).digest("hex").toUpperCase(); }
function calcularHash(user, pass, realm, random) {
  const passHash = md5Upper(`${user}:${realm}:${pass}`);
  return md5Upper(`${user}:${random}:${passHash}`);
}
async function login() {
  const step1 = await axios.post(URL_LOGIN, { method: "global.login", params: { userName: USER, password: "", clientType: "Web3.0" }, id: 1 });
  const ch = step1.data.params;
  const step2 = await axios.post(URL_LOGIN, {
    method: "global.login",
    params: { userName: USER, password: calcularHash(USER, PASS, ch.realm, ch.random), clientType: "Web3.0", authorityType: ch.encryption },
    session: step1.data.session,
    id: 2
  });
  return step2.data.session;
}

async function rpc(session, method, params, id=30) {
  const { data } = await axios.post(URL, { method, params, session, id }, { headers: { Connection: "close" }, timeout: 15000 });
  return data;
}

(async () => {
  const session = await login();
  console.log("✅ session:", session);

  const targets = ["AccessUser.startFind", "AccessUser.doFind", "AccessUser.stopFind"];

  for (const m of targets) {
    console.log("\n== methodSignature:", m);
    // ✅ aqui é methodName, não method
    const sig = await rpc(session, "system.methodSignature", { methodName: m });
    console.log(JSON.stringify(sig, null, 2));

    console.log("\n== methodHelp:", m);
    const help = await rpc(session, "system.methodHelp", { methodName: m });
    console.log(JSON.stringify(help, null, 2));
  }
})();