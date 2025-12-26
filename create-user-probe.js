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

async function rpc(session, method, params, id = 2000) {
  const { data } = await axios.post(
    URL,
    { method, params, session, id },
    { headers: { "Content-Type": "application/json", Connection: "close" }, timeout: 15000 }
  );
  return data;
}

function buildUser({ userID, userName, password }) {
  // Baseado no doFind REAL do seu device
  return {
    Authority: 2,                // 2 = "Usuário" no seu painel (pelo retorno)
    CitizenIDNo: "",
    Doors: [0],
    FirstEnterDoors: [-1],
    IsFirstEnter: false,
    Password: password,
    SpecialDaysSchedule: [255],
    TimeSections: [255],
    UseTime: 200,
    UserID: String(userID),
    UserName: userName,
    UserStatus: 0,
    UserType: 0,
    VTOPosition: "",
    ValidFrom: "1970-01-01 00:00:00",
    ValidTo: "2037-12-31 23:59:59",
  };
}

(async () => {
  const session = await login();
  console.log("✅ session:", session);

  const userID = String(Date.now()).slice(-6); // id novo pra evitar conflito
  const userName = "TESTE_API";
  const password = "1234";

  const userObj = buildUser({ userID, userName, password });
  console.log("\n🧾 user payload:\n", JSON.stringify(userObj, null, 2));

  // Métodos mais comuns em AccessUser
  const candidates = [
    { method: "AccessUser.insertMulti", params: { UserList: [userObj] } },
    { method: "AccessUser.addMulti", params: { UserList: [userObj] } },
    { method: "AccessUser.updateMulti", params: { UserList: [userObj] } },
    { method: "AccessUser.setInfo", params: { User: userObj } },
    { method: "AccessUser.setUser", params: { User: userObj } },
    { method: "AccessUser.add", params: userObj },
  ];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    console.log("\n==============================");
    console.log("🚀 Tentando:", c.method);

    const res = await rpc(session, c.method, c.params, 2100 + i);
    console.log(JSON.stringify(res, null, 2));

    if (res?.result === true) {
      console.log("\n🎉 SUCESSO:", c.method);
      console.log("✅ userID criado:", userID);
      console.log("➡️ Agora valide com: AccessUser.startFind/ doFind");
      process.exit(0);
    }
  }

  console.log("\n😞 Nenhum método funcionou. Aí precisamos do DevTools do botão SALVAR usuário.");
})();