const axios = require("axios");
const crypto = require("crypto");

// ========================
// HASH LOGIN (RPC2_Login)
// ========================
function md5Upper(s) {
  return crypto.createHash("md5").update(s).digest("hex").toUpperCase();
}

function calcularHash(user, pass, realm, random) {
  const passHash = md5Upper(`${user}:${realm}:${pass}`);
  return md5Upper(`${user}:${random}:${passHash}`);
}

async function rpc2Login({ ip, user, pass, timeoutMs = 15000 }) {
  if (!ip) throw new Error("rpc2Login: missing ip");
  if (!user) throw new Error("rpc2Login: missing user");
  if (!pass) throw new Error("rpc2Login: missing pass");

  const URL_LOGIN = `http://${ip}/RPC2_Login`;

  // Step 1: challenge
  const step1 = await axios.post(
    URL_LOGIN,
    { method: "global.login", params: { userName: user, password: "", clientType: "Web3.0" }, id: 1 },
    { timeout: timeoutMs }
  );

  const ch = step1.data?.params;
  const session1 = step1.data?.session;

  if (!ch?.realm || !ch?.random || !session1) {
    throw new Error("RPC2_Login challenge inválido (sem realm/random/session).");
  }

  // Step 2: hashed login
  const step2 = await axios.post(
    URL_LOGIN,
    {
      method: "global.login",
      params: {
        userName: user,
        password: calcularHash(user, pass, ch.realm, ch.random),
        clientType: "Web3.0",
        authorityType: ch.encryption || "Default",
      },
      session: session1,
      id: 2,
    },
    { timeout: timeoutMs }
  );

  const session2 = step2.data?.session;
  if (!session2) throw new Error("RPC2_Login step2 não retornou session.");

  return session2;
}

// ========================
// CORE CALL BUILDER
// ========================
function buildRpcPayload({ method, params, session, id = 1000, object }) {
  const payload = { method, params, session, id };
  if (typeof object !== "undefined") payload.object = object; // igual WebUI
  return payload;
}

// 1) JSON normal (application/json)
async function rpc2CallJson({ ip, session, method, params, id = 1000, object, timeoutMs = 15000 }) {
  if (!ip) throw new Error("rpc2CallJson: missing ip");
  if (!session) throw new Error("rpc2CallJson: missing session");
  if (!method) throw new Error("rpc2CallJson: missing method");

  const URL = `http://${ip}/RPC2`;
  const payload = buildRpcPayload({ method, params, session, id, object });

  const { data } = await axios.post(URL, payload, {
    headers: { "Content-Type": "application/json", Connection: "close" },
    timeout: timeoutMs,
  });

  return data;
}

// 2) “WebUI mode”: Content-Type x-www-form-urlencoded + body = JSON string
async function rpc2CallForm({
  ip,
  session,
  method,
  params,
  id = 1000,
  object,
  timeoutMs = 15000,

  // opcional: simular browser
  cookieSession,
  cookieUser,
  origin,
  referer,
}) {
  if (!ip) throw new Error("rpc2CallForm: missing ip");
  if (!session) throw new Error("rpc2CallForm: missing session");
  if (!method) throw new Error("rpc2CallForm: missing method");

  const URL = `http://${ip}/RPC2`;

  // ⚠️ IMPORTANTE: alguns devices aceitam o body como "json puro string"
  // e o Content-Type como x-www-form-urlencoded.
  const payload = JSON.stringify({
    method,
    params,
    session,
    id,
    ...(typeof object !== "undefined" ? { object } : {}),
  });

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    Connection: "close",
  };

  if (cookieSession && cookieUser) {
    headers["Cookie"] = `WebClientSessionID=${cookieSession}; username=${cookieUser}`;
    headers["Origin"] = origin || `http://${ip}`;
    headers["Referer"] = referer || `http://${ip}/`;
    headers["Accept"] = "application/json, text/plain, */*";
    headers["Accept-Language"] = "pt-BR,pt;q=0.9";
  }

  const { data } = await axios.post(URL, payload, { headers, timeout: timeoutMs });
  return data;
}

// 3) AUTO: tenta Form primeiro (mais compatível), se falhar tenta JSON
async function rpc2CallAuto({ ip, session, method, params, id = 1000, object, timeoutMs = 15000 }) {
  try {
    return await rpc2CallForm({ ip, session, method, params, id, object, timeoutMs });
  } catch (e1) {
    return await rpc2CallJson({ ip, session, method, params, id, object, timeoutMs });
  }
}

// ========================
// multiSec helper (opcional)
// ========================
// Ideia: o WebUI às vezes manda "multiSec": 1 no params/root dependendo do método.

async function rpc2MultiSec({
  ip,
  session,
  method,
  params,
  id = 1000,
  object,
  timeoutMs = 15000,
  multiSec = true,
}) {
  const p = params && typeof params === "object" ? { ...params } : params;

  // padrão mais comum: multiSec dentro do params
  if (multiSec && p && typeof p === "object" && p.multiSec === undefined) {
    p.multiSec = 1;
  }

  return rpc2CallAuto({ ip, session, method, params: p, id, object, timeoutMs });
}

// ========================
// Default wrapper
// ========================
async function rpc2Call(args) {
  return rpc2CallAuto(args);
}

module.exports = {
  rpc2Login,
  rpc2Call,
  rpc2CallJson,
  rpc2CallForm,
  rpc2CallAuto,
  rpc2MultiSec,
};