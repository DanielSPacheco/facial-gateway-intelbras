/**
 * FACIAL GATEWAY - Intelbras SS 3235 MF (LAB)
 *
 * Contexto (pra eu não me perder depois):
 * - Abrir porta eu já validei que funciona via CGI + Digest:
 *   GET /cgi-bin/accessControl.cgi?action=openDoor&channel=1
 *
 * - Cadastro de usuário NÃO funciona via userManager.cgi?action=addUser (dá 400 Bad Request).
 *   Nesse firmware, o painel WEB usa RPC2 (POST /RPC2) com cookie WebClientSessionID.
 *   Então, pra cadastrar e listar usuário eu vou pelo RPC2 (igual o painel).
 *
 * Observação:
 * - Eu uso o cookie FACIAL_COOKIE no .env:
 *   FACIAL_COOKIE=username=admin; WebClientSessionID=xxxxx
 *   (Esse WebClientSessionID eu pego no DevTools do navegador)
 */

const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const qs = require("querystring");
require("dotenv").config();

console.log("### FACIAL GATEWAY - RPC2 VERSION LOADED ###");

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));

// ====== ENV ======
const PORT = Number(process.env.PORT || 3000);

const FACIAL_IP = process.env.FACIAL_IP;
const FACIAL_USER = process.env.FACIAL_USER;
const FACIAL_PASS = process.env.FACIAL_PASS;
const FACIAL_CHANNEL = String(process.env.FACIAL_CHANNEL || "1");

// Cookie do painel web (pego no DevTools -> Headers -> Cookie)
const FACIAL_COOKIE = process.env.FACIAL_COOKIE || "";

if (!FACIAL_IP || !FACIAL_USER || !FACIAL_PASS) {
  console.error("❌ Falta configurar .env (FACIAL_IP, FACIAL_USER, FACIAL_PASS)");
  process.exit(1);
}

const baseUrl = `http://${FACIAL_IP}`;

// ============================================================================
// CURL HELPER (Windows-safe)
// - Eu uso spawn (shell:false) pra não ter dor de cabeça com & e escape no Windows
// - Por padrão eu uso Digest auth (porque pros CGI funciona assim)
// - Quando for RPC2 eu desligo o Digest e uso cookie
// ============================================================================
function runCurl({
  method = "GET",
  url,
  headers = {},
  body = null,
  timeoutSec = 12,
  useDigest = true,
}) {
  return new Promise((resolve) => {
    const args = [
      "-sS",
      "-m",
      String(timeoutSec),
      "-X",
      method,
      url,
      "-w",
      "\nHTTP_CODE:%{http_code}\n",
    ];

    if (useDigest) {
      args.unshift("--digest", "-u", `${FACIAL_USER}:${FACIAL_PASS}`);
    }

    for (const [k, v] of Object.entries(headers || {})) {
      args.push("-H", `${k}: ${v}`);
    }

    // Se eu passar body, mando via stdin pra evitar problema com aspas/escape
    if (body !== null && body !== undefined) {
      args.push("--data-binary", "@-");
    }

    const child = spawn("curl", args, { shell: false });

    let out = "";
    let err = "";

    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));

    child.on("close", (exitCode) => {
      const match = out.match(/HTTP_CODE:(\d{3})/);
      const httpCode = match ? Number(match[1]) : null;

      const stdout = out.replace(/\nHTTP_CODE:\d{3}\n?/, "").trim();
      const stderr = (err || "").trim();

      resolve({
        ok: httpCode ? httpCode >= 200 && httpCode < 300 : false,
        httpCode,
        exitCode,
        stdout,
        stderr,
        url,
        method,
      });
    });

    if (body !== null && body !== undefined) {
      if (Buffer.isBuffer(body)) child.stdin.write(body);
      else if (typeof body === "string") child.stdin.write(body);
      else child.stdin.write(JSON.stringify(body));
      child.stdin.end();
    }
  });
}

// ============================================================================
// RPC2 helper (igual o painel WEB do Intelbras)
// - endpoint: POST /RPC2
// - Content-Type: application/x-www-form-urlencoded
// - auth: cookie (FACIAL_COOKIE)
// ============================================================================
async function rpc2Send({ method, params = null }) {
  const url = `${baseUrl}/RPC2`;

  const form = qs.stringify({
    method,
    params: params ? JSON.stringify(params) : "",
    id: String(Date.now()), // id qualquer (uso timestamp só pra não repetir)
    session: "", // nesse device normalmente a sessão fica no cookie
  });

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (FACIAL_COOKIE) {
    headers["Cookie"] = FACIAL_COOKIE;
  }

  const r = await runCurl({
    method: "POST",
    url,
    headers,
    body: form,
    timeoutSec: 12,
    useDigest: false, // RPC2 usa cookie, não digest
  });

  let parsed = null;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    // se vier algo não-JSON, eu deixo parsed = null e olho no raw
  }

  return { ...r, parsed };
}

// ============================================================================
// Helpers de usuários (RPC2)
// ============================================================================
function rpcUsersFromResponse(parsed) {
  const users = parsed?.params?.users;
  return Array.isArray(users) ? users : [];
}

function nextNumericId(users) {
  // eu prefiro pegar o maior Id existente e somar 1,
  // porque nem sempre users.length + 1 bate (depende de deletados)
  let maxId = 0;
  for (const u of users) {
    const id = Number(u?.Id);
    if (Number.isFinite(id) && id > maxId) maxId = id;
  }
  return maxId + 1;
}

// ============================================================================
// ROTAS
// ============================================================================
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "FACIAL GATEWAY ONLINE (RPC2)",
    config: {
      facialIp: FACIAL_IP,
      channel: FACIAL_CHANNEL,
      user: FACIAL_USER,
      cookieConfigured: Boolean(FACIAL_COOKIE),
    },
    routes: [
      "GET  /health",
      "POST /facial/door/open",
      "GET  /facial/users",
      "POST /facial/user/create",
      "GET  /test/rpc2/ping",
    ],
  });
});

app.get("/health", (req, res) => res.json({ ok: true }));

// ----------------------------------------------------------------------------
// Abrir porta (esse aqui eu já validei na mão com curl)
// ----------------------------------------------------------------------------
app.post("/facial/door/open", async (req, res) => {
  const url = `${baseUrl}/cgi-bin/accessControl.cgi?action=openDoor&channel=${FACIAL_CHANNEL}`;

  const r = await runCurl({
    method: "GET",
    url,
    useDigest: true,
    timeoutSec: 10,
  });

  return res.status(r.ok ? 200 : 502).json({
    ok: r.ok,
    message: r.ok ? "command_sent" : "command_failed",
    command: "openDoor",
    httpCode: r.httpCode,
    url,
    data: r.stdout,
    error: r.stderr,
  });
});

// ----------------------------------------------------------------------------
// Listar usuários (RPC2)
// - eu uso isso pra confirmar se o cookie tá ok e pra ver se o usuário entrou
// ----------------------------------------------------------------------------
app.get("/facial/users", async (req, res) => {
  if (!FACIAL_COOKIE) {
    return res.status(400).json({
      ok: false,
      error: "Falta FACIAL_COOKIE no .env (username=admin; WebClientSessionID=...)",
    });
  }

  const r = await rpc2Send({
    method: "userManager.getUserInfoAll",
    params: null,
  });

  if (!r.ok || !r.parsed) {
    return res.status(502).json({
      ok: false,
      message: "rpc2_failed",
      httpCode: r.httpCode,
      raw: r.stdout,
      error: r.stderr,
    });
  }

  const users = rpcUsersFromResponse(r.parsed);

  return res.json({
    ok: Boolean(r.parsed?.result),
    total: users.length,
    users,
    rpc: r.parsed,
  });
});

// ----------------------------------------------------------------------------
// Criar usuário (RPC2) ✅
// - aqui eu não obrigo userID, eu gero automático pelo maior Id + 1
// - pego o AuthorityList do primeiro usuário como “default”, igual o painel faz
// - tento addUserPlain primeiro e se não der, tento addUser
// ----------------------------------------------------------------------------
app.post("/facial/user/create", async (req, res) => {
  if (!FACIAL_COOKIE) {
    return res.status(400).json({
      ok: false,
      error: "Falta FACIAL_COOKIE no .env (username=admin; WebClientSessionID=...)",
    });
  }

  const { name, password, memo = "LAB" } = req.body || {};

  if (!name || !password) {
    return res.status(400).json({
      ok: false,
      error: "Campos obrigatórios: name, password",
      example: { name: "daniel01", password: "12345678", memo: "LAB" },
    });
  }

  // 1) buscar lista de users pra eu conseguir:
  // - AuthorityList default
  // - gerar Id novo
  const list = await rpc2Send({
    method: "userManager.getUserInfoAll",
    params: null,
  });

  if (!list.ok || !list.parsed?.result) {
    return res.status(502).json({
      ok: false,
      step: "getUserInfoAll",
      httpCode: list.httpCode,
      raw: list.stdout,
      error: list.stderr,
    });
  }

  const users = rpcUsersFromResponse(list.parsed);
  const defaultAuth = users[0]?.AuthorityList || [];
  const newId = nextNumericId(users);

  const userObj = {
    Id: newId,
    Name: String(name),
    Password: String(password),
    Memo: String(memo),
    Sharable: true,
    Group: "admin",
    AuthorityList: defaultAuth,
  };

  // 2) criar usuário (tento o plain primeiro)
  let create = await rpc2Send({
    method: "userManager.addUserPlain",
    params: { user: userObj },
  });

  // fallback
  if (!create.ok || !create.parsed?.result) {
    create = await rpc2Send({
      method: "userManager.addUser",
      params: { user: userObj },
    });
  }

  const ok = Boolean(create.ok && create.parsed?.result === true);

  return res.status(ok ? 200 : 502).json({
    ok,
    message: ok ? "user_created" : "user_creation_failed",
    createdUser: { Id: userObj.Id, Name: userObj.Name, Memo: userObj.Memo },
    rpc: create.parsed || create.stdout,
    httpCode: create.httpCode,
    error: create.stderr,
  });
});

// ----------------------------------------------------------------------------
// Ping RPC2 (só pra eu testar se cookie/session ainda tá válido)
// ----------------------------------------------------------------------------
app.get("/test/rpc2/ping", async (req, res) => {
  if (!FACIAL_COOKIE) {
    return res.status(400).json({
      ok: false,
      error: "Falta FACIAL_COOKIE no .env (username=admin; WebClientSessionID=...)",
    });
  }

  const r = await rpc2Send({ method: "global.getCurrentTime", params: null });

  return res.status(r.ok ? 200 : 502).json({
    ok: r.ok,
    httpCode: r.httpCode,
    parsed: r.parsed,
    raw: r.stdout,
    error: r.stderr,
  });
});

// ----------------------------------------------------------------------------
// 404
// ----------------------------------------------------------------------------
app.use((req, res) =>
  res.status(404).json({ ok: false, error: "ROTA NÃO EXISTE", path: req.path })
);

// ----------------------------------------------------------------------------
// START
// ----------------------------------------------------------------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log("====================================");
  console.log("🚀 FACIAL GATEWAY INICIADO");
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🎯 FACIAL: ${FACIAL_IP} | channel=${FACIAL_CHANNEL} | user=${FACIAL_USER}`);
  console.log(`🍪 FACIAL_COOKIE configurado? ${Boolean(FACIAL_COOKIE)}`);
  console.log("====================================");
});