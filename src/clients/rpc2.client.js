const axios = require("axios");
const crypto = require("crypto");

function md5Upper(s) {
  return crypto.createHash("md5").update(s).digest("hex").toUpperCase();
}

function calcularHash(user, pass, realm, random) {
  const passHash = md5Upper(`${user}:${realm}:${pass}`);
  return md5Upper(`${user}:${random}:${passHash}`);
}

async function rpc2Login({ ip, user, pass, timeoutMs }) {
  const URL_LOGIN = `http://${ip}/RPC2_Login`;

  // Step 1: challenge
  const step1 = await axios.post(
    URL_LOGIN,
    { method: "global.login", params: { userName: user, password: "", clientType: "Web3.0" }, id: 1 },
    { timeout: timeoutMs || 15000 }
  );

  const ch = step1.data.params;

  // Step 2: hashed login
  const step2 = await axios.post(
    URL_LOGIN,
    {
      method: "global.login",
      params: {
        userName: user,
        password: calcularHash(user, pass, ch.realm, ch.random),
        clientType: "Web3.0",
        authorityType: ch.encryption,
      },
      session: step1.data.session,
      id: 2,
    },
    { timeout: timeoutMs || 15000 }
  );

  return step2.data.session;
}

async function rpc2Call({ ip, session, method, params, id = 1000, timeoutMs }) {
  const URL = `http://${ip}/RPC2`;
  const { data } = await axios.post(
    URL,
    { method, params, session, id },
    {
      headers: { "Content-Type": "application/json", Connection: "close" },
      timeout: timeoutMs || 15000,
    }
  );
  return data;
}

module.exports = { rpc2Login, rpc2Call };