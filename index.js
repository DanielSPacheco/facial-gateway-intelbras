const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true })); // bom pra form-urlencoded também

const PORT = Number(process.env.PORT || 3000);

const FACIAL_IP = process.env.FACIAL_IP;
const FACIAL_USER = process.env.FACIAL_USER;
const FACIAL_PASS = process.env.FACIAL_PASS;
const FACIAL_CHANNEL = String(process.env.FACIAL_CHANNEL || "1");

if (!FACIAL_IP || !FACIAL_USER || !FACIAL_PASS) {
  console.error("❌ Falta configurar .env (FACIAL_IP, FACIAL_USER, FACIAL_PASS)");
  process.exit(1);
}

const baseUrl = `http://${FACIAL_IP}`;

/**
 * runCurl
 * - Windows-safe (sem shell)
 * - Digest auth
 * - Retorna httpCode real do equipamento
 */
function runCurl({ method = "GET", url, headers = {}, body = null, timeoutSec = 10 }) {
  return new Promise((resolve) => {
    // Importante: -w coloca HTTP_CODE no final pra gente ler
    const args = [
      "-sS",
      "--digest",
      "-m",
      String(timeoutSec),
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

    // Se tem body, mandamos via stdin (evita problemas de escape)
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
      const dataToSend = typeof body === "string" ? body : JSON.stringify(body);
      child.stdin.write(dataToSend);
      child.stdin.end();
    }
  });
}

// ========= ROTAS =========

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "FACIAL GATEWAY ONLINE (curl --digest)",
    config: { facialIp: FACIAL_IP, channel: FACIAL_CHANNEL, user: FACIAL_USER },
    routes: ["GET /health", "POST /facial/door/open", "POST /facial/user/create", "GET /facial/users/raw"],
  });
});

app.get("/health", (req, res) => res.json({ ok: true }));

// Abrir porta
app.post("/facial/door/open", async (req, res) => {
  // & NÃO quebra aqui porque vai pro spawn como argumento (shell:false)
  const url = `${baseUrl}/cgi-bin/accessControl.cgi?action=openDoor&channel=${encodeURIComponent(
    FACIAL_CHANNEL
  )}`;

  const r = await runCurl({ method: "GET", url });

  return res.status(r.ok ? 200 : 502).json({
    ok: r.ok,
    message: r.ok ? "command_sent" : "command_failed",
    command: "openDoor",
    httpCode: r.httpCode,
    url: r.url,
    data: (r.stdout || "").slice(0, 2000),
    error: (r.stderr || "").slice(0, 2000),
  });
});

// Listar usuários (RAW)
app.get("/facial/users/raw", async (req, res) => {
  const url = `${baseUrl}/cgi-bin/userManager.cgi?action=getUserInfoAll`;
  const r = await runCurl({ method: "GET", url });

  if (!r.ok) {
    return res.status(502).json({
      ok: false,
      httpCode: r.httpCode,
      url: r.url,
      data: (r.stdout || "").slice(0, 2000),
      error: (r.stderr || "").slice(0, 2000),
    });
  }

  res.type("text/plain").send(r.stdout);
});

// Criar usuário (PASSO 1)
app.post("/facial/user/create", async (req, res) => {
  const { userID, name, password } = req.body || {};

  if (!userID || !name || !password) {
    return res.status(400).json({
      ok: false,
      error: "Campos obrigatórios: userID, name, password",
      example: { userID: "1001", name: "Daniel", password: "123456" },
    });
  }

  const url = `${baseUrl}/cgi-bin/userManager.cgi?action=addUser`;

  const form =
    `userID=${encodeURIComponent(String(userID))}` +
    `&name=${encodeURIComponent(String(name))}` +
    `&password=${encodeURIComponent(String(password))}` +
    `&authority=User` +
    `&validityEnable=true` +
    `&validityBegin=2024-01-01` +
    `&validityEnd=2037-12-31`;

  const r = await runCurl({
    method: "POST",
    url,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });

  return res.status(r.ok ? 200 : 502).json({
    ok: r.ok,
    message: r.ok ? "command_sent" : "command_failed",
    command: "addUser",
    httpCode: r.httpCode,
    url: r.url,
    data: (r.stdout || "").slice(0, 4000),
    error: (r.stderr || "").slice(0, 2000),
  });
});

// 404
app.use((req, res) =>
  res.status(404).json({ ok: false, error: "ROTA NÃO EXISTE", path: req.path })
);

app.listen(PORT, "0.0.0.0", () => {
  console.log("====================================");
  console.log("🚀 FACIAL GATEWAY INICIADO");
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🎯 FACIAL: ${FACIAL_IP} | channel=${FACIAL_CHANNEL} | user=${FACIAL_USER}`);
  console.log("====================================");
});