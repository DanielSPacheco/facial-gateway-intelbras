/**
 * index.js (CommonJS)
 * - DOOR OPEN: CGI + DIGEST (curl)
 * - USER CRUD: RPC2_Login + RPC2 (AccessUser.*)
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
const { spawn } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

// ===== CONFIG =====
const PORT = Number(process.env.PORT || 3000);

const FACIAL_IP = process.env.FACIAL_IP;
const FACIAL_USER = process.env.FACIAL_USER;
const FACIAL_PASS = process.env.FACIAL_PASS;

const FACIAL_CHANNEL = String(process.env.FACIAL_CHANNEL || "1");
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 15000);

if (!FACIAL_IP || !FACIAL_USER || !FACIAL_PASS) {
  console.error("❌ Falta configurar .env (FACIAL_IP, FACIAL_USER, FACIAL_PASS)");
  process.exit(1);
}

const baseUrl = `http://${FACIAL_IP}`;
const URL_LOGIN = `${baseUrl}/RPC2_Login`;
const URL_RPC2 = `${baseUrl}/RPC2`;

// ===== CURL DIGEST helper (para CGI / ISAPI etc) =====
function runCurl({ method = "GET", path, headers = {}, body = null }) {
  return new Promise((resolve) => {
    const url = `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;

    const args = [
      "-sS",
      "--digest",
      "-u",
      `${FACIAL_USER}:${FACIAL_PASS}`,
      "-X",
      method,
      url,
      "-w",
      "\nHTTP_CODE:%{http_code}\n",
    ];

    for (const [k, v] of Object.entries(headers || {})) {
      args.push("-H", `${k}: ${v}`);
    }

    if (body !== null && body !== undefined) {
      args.push("--data-binary", "@-");
    }

    const child = spawn("curl", args, { shell: false });

    let out = "";
    let err = "";

    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));

    child.on("close", (code) => {
      const match = out.match(/HTTP_CODE:(\d{3})/);
      const httpCode = match ? Number(match[1]) : null;

      const cleaned = out.replace(/\nHTTP_CODE:\d{3}\n?/, "");

      resolve({
        ok: httpCode ? httpCode >= 200 && httpCode < 300 : false,
        httpCode,
        stdout: cleaned,
        stderr: err,
        exitCode: code,
        url,
        method,
      });
    });

    if (body !== null && body !== undefined) {
      const dataToSend = typeof body === "string" ? body : JSON.stringify(body);
      child.stdin.write(dataToSend);
      child.stdin.end();
    }
  });
}

// ===== RPC helpers (para AccessUser.*) =====
const http = axios.create({
  timeout: TIMEOUT_MS,
  headers: { "Content-Type": "application/json", Connection: "close" },
});

function md5Upper(s) {
  return crypto.createHash("md5").update(s).digest("hex").toUpperCase();
}
function calcularHash(user, pass, realm, random) {
  const passHash = md5Upper(`${user}:${realm}:${pass}`);
  return md5Upper(`${user}:${random}:${passHash}`);
}

async function rpcLoginSession() {
  const step1 = await http.post(URL_LOGIN, {
    method: "global.login",
    params: { userName: FACIAL_USER, password: "", clientType: "Web3.0" },
    id: 1,
  });

  const ch = step1.data?.params;
  if (!ch?.realm || !ch?.random) {
    throw new Error("Login challenge inválido (realm/random ausentes).");
  }

  const step2 = await http.post(URL_LOGIN, {
    method: "global.login",
    params: {
      userName: FACIAL_USER,
      password: calcularHash(FACIAL_USER, FACIAL_PASS, ch.realm, ch.random),
      clientType: "Web3.0",
      authorityType: ch.encryption,
    },
    session: step1.data?.session,
    id: 2,
  });

  const session = step2.data?.session;
  if (!session) throw new Error("Session não retornada no login.");
  return session;
}

async function rpcCall(session, method, params, id = 3000) {
  const { data } = await http.post(URL_RPC2, { method, params, session, id });
  return data;
}

function buildUser({ userID, userName, password, authority = 2 }) {
  return {
    Authority: Number(authority),
    CitizenIDNo: "",
    Doors: [0],
    FirstEnterDoors: [-1],
    IsFirstEnter: false,
    Password: String(password || ""),
    SpecialDaysSchedule: [255],
    TimeSections: [255],
    UseTime: 200,
    UserID: String(userID),
    UserName: String(userName),
    UserStatus: 0,
    UserType: 0,
    VTOPosition: "",
    ValidFrom: "1970-01-01 00:00:00",
    ValidTo: "2037-12-31 23:59:59",
  };
}

// ===== ROTAS =====
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "FACIAL GATEWAY ONLINE (door=CGI+digest | users=RPC)",
    config: { facialIp: FACIAL_IP, channel: FACIAL_CHANNEL, user: FACIAL_USER },
    routes: [
      "GET /health",
      "POST /facial/door/open",
      "GET /facial/deviceInfo",
      "POST /facial/raw",
      "POST /facial/user/create",
      "POST /facial/user/update",
      "POST /facial/user/delete",
      "GET /facial/user/:userID",
    ],
  });
});

app.get("/health", (req, res) => res.json({ ok: true }));

// ===== DOOR OPEN (CGI + DIGEST via curl) =====
app.post("/facial/door/open", async (req, res) => {
  const path = `/cgi-bin/accessControl.cgi?action=openDoor&channel=${encodeURIComponent(
    FACIAL_CHANNEL
  )}`;

  const r = await runCurl({ method: "GET", path });

  return res.status(r.ok ? 200 : 502).json({
    ok: r.ok,
    message: r.ok ? "command_sent" : "command_failed",
    command: "openDoor",
    httpCode: r.httpCode,
    url: r.url,
    data: (r.stdout || "").slice(0, 2000),
    error: (r.stderr || "").slice(0, 2000),
    tip: r.ok ? "" : "Se isso falhar, capture no DevTools a URL exata do open door (cgi-bin) e substituímos o path.",
  });
});

// ===== Extras via curl =====
app.get("/facial/deviceInfo", async (req, res) => {
  const r = await runCurl({ method: "GET", path: "/ISAPI/System/deviceInfo" });

  return res.status(r.ok ? 200 : 502).json({
    ok: r.ok,
    httpCode: r.httpCode,
    url: r.url,
    data: (r.stdout || "").slice(0, 5000),
    error: (r.stderr || "").slice(0, 2000),
  });
});

app.post("/facial/raw", async (req, res) => {
  const { method, path, headers, body } = req.body || {};
  if (!path) return res.status(400).json({ ok: false, error: "Faltou 'path'" });

  const r = await runCurl({ method: method || "GET", path, headers, body });

  return res.status(r.ok ? 200 : 502).json({
    ok: r.ok,
    httpCode: r.httpCode,
    url: r.url,
    method: r.method,
    data: (r.stdout || "").slice(0, 8000),
    error: (r.stderr || "").slice(0, 2000),
  });
});

// ===== USERS (RPC) =====
app.get("/facial/user/:userID", async (req, res) => {
  const userID = String(req.params.userID || "").trim();
  if (!userID) return res.status(400).json({ ok: false, error: "userID inválido" });

  try {
    const session = await rpcLoginSession();

    const start = await rpcCall(session, "AccessUser.startFind", { Condition: { UserID: userID } }, 3101);
    if (start?.result !== true) return res.status(502).json({ ok: false, error: "startFind falhou", data: start });

    const token = start?.params?.Token;
    const found = await rpcCall(session, "AccessUser.doFind", { Token: token, Offset: 0, Count: 0 }, 3102);
    await rpcCall(session, "AccessUser.stopFind", { Token: token }, 3103).catch(() => {});

    const info = found?.params?.Info;
    const first = Array.isArray(info) ? info[0] : null;

    res.json({ ok: true, data: first || null });
  } catch (err) {
    res.status(502).json({ ok: false, error: err?.message || String(err), detail: err?.response?.data ?? null });
  }
});

app.post("/facial/user/create", async (req, res) => {
  const userID = String(req.body?.userID || "").trim();
  const userName = String(req.body?.userName || req.body?.name || "").trim();
  const password = String(req.body?.password || "").trim();
  const authority = req.body?.authority ?? 2;

  if (!userID || !userName || !password) {
    return res.status(400).json({
      ok: false,
      error: "Campos obrigatórios: userID, userName, password",
      example: { userID: "888", userName: "Joao", password: "1234", authority: 2 },
    });
  }

  try {
    const session = await rpcLoginSession();
    const userObj = buildUser({ userID, userName, password, authority });

    const r = await rpcCall(session, "AccessUser.insertMulti", { UserList: [userObj] }, 3201);
    if (r?.result !== true) return res.status(502).json({ ok: false, error: "insertMulti falhou", data: r });

    res.json({ ok: true, created: true, method: "AccessUser.insertMulti", userID });
  } catch (err) {
    res.status(502).json({ ok: false, error: err?.message || String(err), detail: err?.response?.data ?? null });
  }
});

app.post("/facial/user/update", async (req, res) => {
  const userID = String(req.body?.userID || "").trim();
  const newUserName = req.body?.userName ?? req.body?.name;
  const newPassword = req.body?.password;
  const newAuthority = req.body?.authority;

  if (!userID) return res.status(400).json({ ok: false, error: "Campo obrigatório: userID" });

  try {
    const session = await rpcLoginSession();

    // pega o atual
    const start = await rpcCall(session, "AccessUser.startFind", { Condition: { UserID: userID } }, 3301);
    if (start?.result !== true) return res.status(502).json({ ok: false, error: "startFind falhou", data: start });

    const token = start?.params?.Token;
    const found = await rpcCall(session, "AccessUser.doFind", { Token: token, Offset: 0, Count: 0 }, 3302);
    await rpcCall(session, "AccessUser.stopFind", { Token: token }, 3303).catch(() => {});

    const current = Array.isArray(found?.params?.Info) ? found.params.Info[0] : null;
    if (!current) return res.status(404).json({ ok: false, error: "Usuário não encontrado", userID });

    const merged = {
      ...current,
      UserID: String(userID),
      UserName: typeof newUserName === "string" && newUserName.trim() ? newUserName.trim() : current.UserName,
      Password: typeof newPassword === "string" && newPassword.trim() ? newPassword.trim() : current.Password,
      Authority: typeof newAuthority === "number" ? newAuthority : current.Authority,
    };

    const r = await rpcCall(session, "AccessUser.updateMulti", { UserList: [merged] }, 3304);
    if (r?.result !== true) return res.status(502).json({ ok: false, error: "updateMulti falhou", data: r });

    res.json({ ok: true, updated: true, method: "AccessUser.updateMulti", userID });
  } catch (err) {
    res.status(502).json({ ok: false, error: err?.message || String(err), detail: err?.response?.data ?? null });
  }
});

app.post("/facial/user/delete", async (req, res) => {
  const userID = String(req.body?.userID || "").trim();
  if (!userID) return res.status(400).json({ ok: false, error: "Campo obrigatório: userID" });

  try {
    const session = await rpcLoginSession();
    const r = await rpcCall(session, "AccessUser.removeMulti", { UserIDList: [userID] }, 3401);
    if (r?.result !== true) return res.status(502).json({ ok: false, error: "removeMulti falhou", data: r });

    res.json({ ok: true, deleted: true, method: "AccessUser.removeMulti", userID });
  } catch (err) {
    res.status(502).json({ ok: false, error: err?.message || String(err), detail: err?.response?.data ?? null });
  }
});

app.use((req, res) =>
  res.status(404).json({ ok: false, error: "ROTA NÃO EXISTE", path: req.path })
);

app.listen(PORT, "0.0.0.0", () => {
  console.log("====================================");
  console.log("🚀 FACIAL GATEWAY INICIADO");
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🎯 FACIAL: ${FACIAL_IP} | channel=${FACIAL_CHANNEL} | user=${FACIAL_USER}`);
  console.log("Door: CGI + DIGEST (curl) | Users: RPC2_Login/RPC2");
  console.log("====================================");
});