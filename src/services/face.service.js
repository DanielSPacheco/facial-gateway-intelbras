const axios = require("axios");
const sharp = require("sharp");
const { rpc2Login } = require("../clients/rpc2.client");
const { resolveTarget } = require("../utils/target.util");

const MAX_REQUEST_BYTES = 14000;

// Cache de sessão por device (ip|user). Sessão válida por 10 minutos.
const SESSION_CACHE_MS = 10 * 60 * 1000;
const sessionCache = new Map(); // key -> { session, at }

/**
 * Remove prefixo data URI de base64
 */
function stripDataUri(s) {
  return String(s || "").replace(/^data:image\/\w+;base64,/, "");
}

function cacheKey(tcfg) {
  return `${tcfg.FACIAL_IP}|${tcfg.FACIAL_USER}`;
}

async function getSession(cfg, bodyOrPayload) {
  const tcfg = resolveTarget(cfg, bodyOrPayload);
  const key = cacheKey(tcfg);
  const now = Date.now();

  const cached = sessionCache.get(key);
  if (cached?.session && now - cached.at < SESSION_CACHE_MS) {
    console.log("[SESSION] Usando sessão em cache:", key);
    return cached.session;
  }

  console.log("[SESSION] Criando nova sessão:", key);
  const session = await rpc2Login({
    ip: tcfg.FACIAL_IP,
    user: tcfg.FACIAL_USER,
    pass: tcfg.FACIAL_PASS,
    timeoutMs: tcfg.TIMEOUT_MS || 15000,
  });

  sessionCache.set(key, { session, at: now });
  console.log("[SESSION] ✅ Sessão criada com sucesso:", key);
  return session;
}

/**
 * RPC2 estilo browser (compatibilidade máxima)
 */
async function rpc2CallBrowserStyle({ ip, payload, timeoutMs = 20000 }) {
  const url = `http://${ip}/RPC2`;
  const json = JSON.stringify(payload);

  try {
    console.log("[RPC2] Tentando: application/json (método 1)");
    const { data } = await axios.post(url, json, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Connection: "keep-alive",
      },
      timeout: timeoutMs,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    console.log("[RPC2] ✅ Método 1 funcionou!");
    return data;
  } catch (e) {
    console.log(`[RPC2] ❌ Método 1 falhou: ${e.message}`);
  }

  const formHeaders = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json, text/plain, */*",
    Connection: "keep-alive",
  };

  try {
    console.log("[RPC2] Tentando: data=<json> (método 2)");
    const { data } = await axios.post(url, `data=${encodeURIComponent(json)}`, {
      headers: formHeaders,
      timeout: timeoutMs,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    console.log("[RPC2] ✅ Método 2 funcionou!");
    return data;
  } catch (e) {
    console.log(`[RPC2] ❌ Método 2 falhou: ${e.message}`);
  }

  console.log("[RPC2] Tentando: json=<json> (método 3)");
  const { data } = await axios.post(url, `json=${encodeURIComponent(json)}`, {
    headers: formHeaders,
    timeout: timeoutMs,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  console.log("[RPC2] ✅ Método 3 funcionou!");
  return data;
}

function buildInsertPayload({ session, userID, b64, id = 70 }) {
  const payload = {
    method: "AccessFace.insertMulti",
    params: {
      FaceList: [{ UserID: String(userID), PhotoData: [b64] }],
    },
    id,
    session,
  };

  const reqBytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
  return { payload, reqBytes };
}

async function makeB64ThatFits(imageBuffer, { session, userID, maxRequestBytes }) {
  const configs = [
    { size: 200, quality: 70 },
    { size: 180, quality: 70 },
    { size: 160, quality: 70 },

    { size: 220, quality: 65 },
    { size: 200, quality: 65 },
    { size: 180, quality: 65 },
    { size: 160, quality: 65 },

    { size: 240, quality: 60 },
    { size: 220, quality: 60 },
    { size: 200, quality: 60 },
    { size: 180, quality: 60 },
    { size: 160, quality: 60 },

    { size: 220, quality: 55 },
    { size: 200, quality: 55 },
    { size: 180, quality: 55 },
    { size: 160, quality: 55 },

    { size: 200, quality: 50 },
    { size: 180, quality: 50 },
    { size: 160, quality: 50 },
    { size: 140, quality: 50 },
  ];

  for (const { size, quality } of configs) {
    const jpg = await sharp(imageBuffer)
      .rotate()
      .resize(size, size, { fit: "cover", position: "attention" })
      .jpeg({
        quality,
        chromaSubsampling: "4:2:0",
        progressive: false,
        optimizeCoding: true,
      })
      .withMetadata({})
      .toBuffer();

    const b64 = jpg.toString("base64");
    const { reqBytes } = buildInsertPayload({ session, userID, b64 });

    console.log(
      `[COMPRESS] Testando: ${size}px @ quality ${quality} → ${reqBytes} bytes (limite: ${maxRequestBytes})`
    );

    if (reqBytes <= maxRequestBytes) {
      console.log(`[COMPRESS] ✅ SUCESSO! ${reqBytes}/${maxRequestBytes}`);
      return { b64, meta: { size, quality, jpgBytes: jpg.length, reqBytes } };
    }
  }

  console.log("[COMPRESS] ❌ Não foi possível comprimir para caber no limite");
  return null;
}

async function sendFace(cfg, bodyOrPayload, { session, userID, b64 }) {
  const tcfg = resolveTarget(cfg, bodyOrPayload);
  const { payload, reqBytes } = buildInsertPayload({ session, userID, b64 });

  if (reqBytes > MAX_REQUEST_BYTES) {
    return {
      ok: false,
      error: "REQUEST_TOO_LARGE",
      message: `Payload excede o limite: ${reqBytes} > ${MAX_REQUEST_BYTES} bytes`,
      reqBytes,
      maxRequestBytes: MAX_REQUEST_BYTES,
    };
  }

  console.log(`[FACE] Enviando face: ip=${tcfg.FACIAL_IP} userID=${userID} bytes=${reqBytes}`);

  const resp = await rpc2CallBrowserStyle({
    ip: tcfg.FACIAL_IP,
    payload,
    timeoutMs: 20000,
  });

  if (resp?.result !== true) {
    const errorCode = resp?.error?.code || resp?.errCode;
    const failCode = resp?.error?.detail?.FailCodes?.[0];

    let friendlyError = "Erro ao cadastrar face";
    if (failCode === 286064926) {
      friendlyError =
        "Face não detectada/qualidade insuficiente. Use foto frontal, boa luz e rosto visível.";
    } else if (errorCode === 268632336) {
      friendlyError = "Erro no processamento. Verifique se o userID existe no dispositivo.";
    } else if (errorCode === 287638033) {
      friendlyError = "Tamanho do request excedido. A imagem é muito grande.";
    }

    return {
      ok: false,
      error: "FACE_INSERT_FAILED",
      message: friendlyError,
      raw: resp,
      reqBytes,
    };
  }

  return { ok: true, userID: String(userID), reqBytes };
}

/**
 * Upload via arquivo (multipart)
 */
async function uploadFaceFile(cfg, bodyOrPayload = {}) {
  const { userID, imageBuffer } = bodyOrPayload;

  try {
    const tcfg = resolveTarget(cfg, bodyOrPayload);

    if (!tcfg?.FACIAL_IP) return { ok: false, error: "CFG_MISSING", message: "FACIAL_IP não configurado" };
    if (!tcfg?.FACIAL_USER || !tcfg?.FACIAL_PASS) {
      return { ok: false, error: "CFG_MISSING", message: "FACIAL_USER/FACIAL_PASS não configurados" };
    }
    if (!userID || !imageBuffer) {
      return { ok: false, error: "VALIDATION_ERROR", message: "Campos obrigatórios: userID, imageBuffer" };
    }

    console.log(`[FACE] Upload file: ip=${tcfg.FACIAL_IP} userID=${userID}`);

    const session = await getSession(cfg, bodyOrPayload);

    const built = await makeB64ThatFits(imageBuffer, {
      session,
      userID,
      maxRequestBytes: MAX_REQUEST_BYTES,
    });

    if (!built) {
      return {
        ok: false,
        error: "REQUEST_TOO_LARGE",
        message: `Não foi possível comprimir para caber em ${MAX_REQUEST_BYTES} bytes.`,
        maxRequestBytes: MAX_REQUEST_BYTES,
      };
    }

    const sent = await sendFace(cfg, bodyOrPayload, { session, userID, b64: built.b64 });
    if (!sent.ok) return { ...sent, meta: built.meta };

    return {
      ...sent,
      meta: built.meta,
      success: true,
      message: `Face cadastrada! size=${built.meta.size}px quality=${built.meta.quality}`,
    };
  } catch (e) {
    // Se sessão “morreu”, zera cache desse device
    const msg = String(e?.message || "").toLowerCase();
    if (msg.includes("session")) {
      const tcfg = resolveTarget(cfg, bodyOrPayload);
      sessionCache.delete(cacheKey(tcfg));
    }

    return { ok: false, error: "RPC_ERROR", message: e?.message || "Erro ao cadastrar face" };
  }
}

/**
 * Upload via base64 direto
 */
async function uploadFaceBase64(cfg, bodyOrPayload = {}) {
  const { userID, photoData } = bodyOrPayload;

  try {
    const tcfg = resolveTarget(cfg, bodyOrPayload);

    if (!tcfg?.FACIAL_IP) return { ok: false, error: "CFG_MISSING", message: "FACIAL_IP não configurado" };
    if (!tcfg?.FACIAL_USER || !tcfg?.FACIAL_PASS) {
      return { ok: false, error: "CFG_MISSING", message: "FACIAL_USER/FACIAL_PASS não configurados" };
    }

    const b64 = stripDataUri(photoData);
    if (!b64 || b64.length < 1000) {
      return { ok: false, error: "VALIDATION_ERROR", message: "photoData inválido (muito curto ou vazio)" };
    }
    if (!userID) {
      return { ok: false, error: "VALIDATION_ERROR", message: "Campo obrigatório: userID" };
    }

    console.log(`[FACE] Upload base64: ip=${tcfg.FACIAL_IP} userID=${userID}`);

    const session = await getSession(cfg, bodyOrPayload);
    return await sendFace(cfg, bodyOrPayload, { session, userID, b64 });
  } catch (e) {
    const msg = String(e?.message || "").toLowerCase();
    if (msg.includes("session")) {
      const tcfg = resolveTarget(cfg, bodyOrPayload);
      sessionCache.delete(cacheKey(tcfg));
    }
    return { ok: false, error: "RPC_ERROR", message: e?.message || "Erro ao cadastrar face" };
  }
}

module.exports = {
  uploadFaceFile,
  uploadFaceBase64,
};