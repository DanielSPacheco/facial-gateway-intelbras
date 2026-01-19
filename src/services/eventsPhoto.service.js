const axios = require("axios");
const crypto = require("crypto");

// ========================
// RPC2_LOGIN (challenge + hash) — igual seu rpc2cliente.js
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
    { timeout: timeoutMs, validateStatus: () => true }
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
    { timeout: timeoutMs, validateStatus: () => true }
  );

  const session2 = step2.data?.session;
  if (!session2) throw new Error("RPC2_Login step2 não retornou session.");

  return session2;
}

// ========================
// Helpers
// ========================
function resolveIp(deviceId) {
  const s = String(deviceId || "").trim();
  if (!s) return null;
  if (s.includes(".")) return s; // modo atual: deviceId = IP
  return null;
}

function normalizePath(urlPath) {
  const raw = String(urlPath || "").trim();
  if (!raw) return null;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

// cache simples em memória
const sessionCache = new Map(); // ip|user -> { session, ts }
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 min

function cacheKey(ip, user) {
  return `${ip}|${user}`;
}

function getCachedSession(ip, user) {
  const k = cacheKey(ip, user);
  const v = sessionCache.get(k);
  if (!v) return null;
  if (Date.now() - v.ts > SESSION_TTL_MS) {
    sessionCache.delete(k);
    return null;
  }
  return v.session;
}

function setCachedSession(ip, user, session) {
  sessionCache.set(cacheKey(ip, user), { session, ts: Date.now() });
}

async function fetchLoadfile(cfg, ip, user, session, path) {
  const ts = Date.now();
  const url = `http://${ip}/RPC2_Loadfile${path}?timestamp=${ts}`;

  const resp = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: cfg.TIMEOUT_MS ?? 15000,
    headers: {
      Cookie: `WebClientSessionID=${session}; username=${user}`,
      Referer: `http://${ip}/`,
      Origin: `http://${ip}`,
      Connection: "close",
      Accept: "image/*,*/*;q=0.8",
    },
    validateStatus: () => true,
  });

  if (resp.status !== 200) {
    const txt = Buffer.from(resp.data || "").toString("utf8").slice(0, 400);
    return { ok: false, status: resp.status, body: txt, url };
  }

  let contentType = resp.headers?.["content-type"] || "image/jpeg";
  if (String(contentType).includes("application/http")) contentType = "image/jpeg";

  return { ok: true, url, contentType, bytes: Buffer.from(resp.data) };
}

/**
 * Baixa a foto EXATA do evento:
 * GET /facial/events/:deviceId/photo?url=/mnt/...
 * -> usa RPC2_Login para obter session
 * -> usa RPC2_Loadfile para baixar o arquivo com Cookie
 */
async function fetchEventPhoto(cfg, { deviceId, urlPath }) {
  try {
    const ip = resolveIp(deviceId);
    if (!ip) {
      return { ok: false, error: "MISSING_DEVICE", message: "IP do dispositivo não resolvido" };
    }

    const path = normalizePath(urlPath);
    if (!path) {
      return { ok: false, error: "MISSING_URL", message: "urlPath não informado" };
    }

    const user = cfg.FACIAL_USER || process.env.FACIAL_USER || "admin";
    const pass = cfg.FACIAL_PASS || process.env.FACIAL_PASS;

    if (!pass) {
      return { ok: false, error: "MISSING_AUTH", message: "Defina FACIAL_PASS no .env" };
    }

    const timeoutMs = cfg.TIMEOUT_MS ?? 15000;

    // 1) session cache
    let session = getCachedSession(ip, user);

    // 2) login (RPC2_Login)
    if (!session) {
      session = await rpc2Login({ ip, user, pass, timeoutMs });
      setCachedSession(ip, user, session);
    }

    // 3) fetch loadfile
    let r = await fetchLoadfile(cfg, ip, user, session, path);
    if (r.ok) {
      return { ok: true, url: r.url, contentType: r.contentType, bytes: r.bytes };
    }

    // 4) se auth expirou, reloga 1x e tenta de novo
    if (r.status === 401 || r.status === 403) {
      sessionCache.delete(cacheKey(ip, user));
      session = await rpc2Login({ ip, user, pass, timeoutMs });
      setCachedSession(ip, user, session);

      const r2 = await fetchLoadfile(cfg, ip, user, session, path);
      if (r2.ok) {
        return { ok: true, url: r2.url, contentType: r2.contentType, bytes: r2.bytes };
      }

      return {
        ok: false,
        error: "LOADFILE_FAILED",
        message: "Falha ao baixar imagem via RPC2_Loadfile (apos relogin)",
        details: r2,
      };
    }

    return {
      ok: false,
      error: "LOADFILE_FAILED",
      message: "Falha ao baixar imagem via RPC2_Loadfile",
      details: r,
    };
  } catch (e) {
    return { ok: false, error: "INTERNAL_ERROR", message: e?.message || "Erro inesperado" };
  }
}

module.exports = { fetchEventPhoto };