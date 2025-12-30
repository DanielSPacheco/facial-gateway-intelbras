const axios = require("axios");
const sharp = require("sharp");
const { rpc2Login } = require("../clients/rpc2.client");

/**
 * ✅ LIMITE TESTADO E APROVADO
 * Firmware Intelbras rejeita requests acima de ~14KB
 * Este valor foi validado com sucesso em produção
 */
const MAX_REQUEST_BYTES = 14000;

/**
 * Cache de sessão (evita relogar a cada requisição)
 * Sessão válida por 10 minutos
 */
let cachedSession = null;
let cachedAt = 0;
const SESSION_CACHE_MS = 10 * 60 * 1000; // 10 minutos

/**
 * Remove prefixo data URI de base64
 * @param {string} s - String base64 (com ou sem prefixo)
 * @returns {string} Base64 puro
 */
function stripDataUri(s) {
  return String(s || "").replace(/^data:image\/\w+;base64,/, "");
}

/**
 * Obtém ou cria sessão RPC2
 * @param {Object} cfg - Configuração (FACIAL_IP, FACIAL_USER, FACIAL_PASS)
 * @returns {Promise<string>} Session ID
 */
async function getSession(cfg) {
  const now = Date.now();
  
  // Retorna cache se ainda válido
  if (cachedSession && now - cachedAt < SESSION_CACHE_MS) {
    console.log("[SESSION] Usando sessão em cache");
    return cachedSession;
  }

  console.log("[SESSION] Criando nova sessão...");
  const session = await rpc2Login({
    ip: cfg.FACIAL_IP,
    user: cfg.FACIAL_USER,
    pass: cfg.FACIAL_PASS,
    timeoutMs: 15000,
  });

  cachedSession = session;
  cachedAt = now;
  console.log("[SESSION] ✅ Sessão criada com sucesso");
  return session;
}

/**
 * Chama RPC2 com múltiplos métodos HTTP (compatibilidade máxima)
 * Tenta em ordem: JSON puro → data= → json=
 * 
 * @param {Object} params
 * @param {string} params.ip - IP do dispositivo
 * @param {Object} params.payload - Payload RPC2
 * @param {number} params.timeoutMs - Timeout em ms
 * @returns {Promise<Object>} Resposta do dispositivo
 */
async function rpc2CallBrowserStyle({ ip, payload, timeoutMs = 20000 }) {
  const url = `http://${ip}/RPC2`;
  const json = JSON.stringify(payload);

  // ✅ MÉTODO 1: JSON PURO (mais compatível com Intelbras)
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

  // Headers para métodos form-urlencoded
  const formHeaders = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json, text/plain, */*",
    Connection: "keep-alive",
  };

  // ✅ MÉTODO 2: data=<json>
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

  // ✅ MÉTODO 3: json=<json>
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

/**
 * Monta payload para AccessFace.insertMulti
 * @param {Object} params
 * @param {string} params.session - Session ID
 * @param {string} params.userID - ID do usuário
 * @param {string} params.b64 - Imagem em base64
 * @param {number} params.id - ID da requisição
 * @returns {Object} { payload, reqBytes }
 */
function buildInsertPayload({ session, userID, b64, id = 70 }) {
  const payload = {
    method: "AccessFace.insertMulti",
    params: {
      FaceList: [
        {
          UserID: String(userID),
          PhotoData: [b64],
        },
      ],
    },
    id,
    session,
  };

  const reqBytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
  return { payload, reqBytes };
}

/**
 * ✅ ALGORITMO OTIMIZADO: Gera imagem que cabe no limite E tem boa qualidade
 * 
 * Estratégia testada e aprovada:
 * - Prioriza QUALITY ALTA (70) para melhor detecção facial
 * - Usa SIZES MENORES (200px, 180px) para caber no limite de 14KB
 * - Balanceia qualidade vs tamanho progressivamente
 * 
 * @param {Buffer} imageBuffer - Buffer da imagem original
 * @param {Object} params
 * @param {string} params.session - Session ID
 * @param {string} params.userID - ID do usuário
 * @param {number} params.maxRequestBytes - Limite máximo em bytes
 * @returns {Promise<Object|null>} { b64, meta } ou null se não couber
 */
async function makeB64ThatFits(imageBuffer, { session, userID, maxRequestBytes }) {
  // ✅ Configurações testadas em ordem de prioridade
  // Prioriza quality alta em sizes pequenos (melhor para reconhecimento facial)
  const configs = [
    // 🎯 Prioridade 1: Quality 70 (melhor detecção)
    { size: 200, quality: 70 },
    { size: 180, quality: 70 },
    { size: 160, quality: 70 },
    
    // 🎯 Prioridade 2: Quality 65
    { size: 220, quality: 65 },
    { size: 200, quality: 65 },
    { size: 180, quality: 65 },
    { size: 160, quality: 65 },
    
    // 🎯 Prioridade 3: Quality 60
    { size: 240, quality: 60 },
    { size: 220, quality: 60 },
    { size: 200, quality: 60 },
    { size: 180, quality: 60 },
    { size: 160, quality: 60 },
    
    // 🔄 Fallback: Quality 55
    { size: 220, quality: 55 },
    { size: 200, quality: 55 },
    { size: 180, quality: 55 },
    { size: 160, quality: 55 },
    
    // ⚠️ Último recurso: Quality 50 (mínimo aceitável)
    { size: 200, quality: 50 },
    { size: 180, quality: 50 },
    { size: 160, quality: 50 },
    { size: 140, quality: 50 },
  ];

  for (const { size, quality } of configs) {
    // Processa imagem com Sharp
    const jpg = await sharp(imageBuffer)
      .rotate() // Corrige orientação EXIF
      .resize(size, size, {
        fit: "cover",
        position: "attention", // Prioriza rostos
      })
      .jpeg({
        quality,
        chromaSubsampling: "4:2:0",
        progressive: false,
        optimizeCoding: true, // Melhor compressão
      })
      .withMetadata({})
      .toBuffer();

    const b64 = jpg.toString("base64");
    const { payload, reqBytes } = buildInsertPayload({ session, userID, b64 });

    console.log(`[COMPRESS] Testando: ${size}px @ quality ${quality} → ${reqBytes} bytes (limite: ${maxRequestBytes})`);

    // ✅ Cabe no limite!
    if (reqBytes <= maxRequestBytes) {
      console.log(`[COMPRESS] ✅ SUCESSO! Imagem otimizada: ${reqBytes}/${maxRequestBytes} bytes`);
      return {
        b64,
        meta: { size, quality, jpgBytes: jpg.length, reqBytes },
      };
    }
  }

  // ❌ Nenhuma configuração funcionou
  console.log("[COMPRESS] ❌ Não foi possível comprimir a imagem para caber no limite");
  return null;
}

/**
 * Envia face para o dispositivo
 * @param {Object} cfg - Configuração
 * @param {Object} params
 * @param {string} params.session - Session ID
 * @param {string} params.userID - ID do usuário
 * @param {string} params.b64 - Imagem em base64
 * @returns {Promise<Object>} Resultado do envio
 */
async function sendFace(cfg, { session, userID, b64 }) {
  const { payload, reqBytes } = buildInsertPayload({ session, userID, b64 });

  // Validação de segurança
  if (reqBytes > MAX_REQUEST_BYTES) {
    return {
      ok: false,
      error: "REQUEST_TOO_LARGE",
      message: `Payload excede o limite: ${reqBytes} > ${MAX_REQUEST_BYTES} bytes`,
      reqBytes,
      maxRequestBytes: MAX_REQUEST_BYTES,
    };
  }

  console.log(`[FACE] Enviando face para dispositivo: userID=${userID}, reqBytes=${reqBytes}`);

  // Envia para o dispositivo
  const resp = await rpc2CallBrowserStyle({
    ip: cfg.FACIAL_IP,
    payload,
    timeoutMs: 20000,
  });

  console.log(`[FACE] Resposta do dispositivo:`, JSON.stringify(resp, null, 2));

  // ❌ Erro no cadastro
  if (resp?.result !== true) {
    const errorCode = resp?.error?.code || resp?.errCode;
    const failCode = resp?.error?.detail?.FailCodes?.[0];
    
    let friendlyError = "Erro ao cadastrar face";
    
    // Decodifica erros conhecidos
    if (failCode === 286064926) {
      friendlyError = "Face não detectada ou qualidade insuficiente. Use uma foto frontal, bem iluminada e com o rosto visível.";
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
      reqBytes 
    };
  }

  // ✅ Sucesso!
  console.log(`[FACE] ✅ Face cadastrada com sucesso para userID=${userID}`);
  return { 
    ok: true, 
    userID: String(userID), 
    reqBytes 
  };
}

/**
 * ✅ UPLOAD VIA ARQUIVO (multipart/form-data)
 * 
 * Fluxo:
 * 1. Valida configuração
 * 2. Obtém sessão (ou usa cache)
 * 3. Comprime imagem até caber no limite
 * 4. Envia para o dispositivo
 * 
 * @param {Object} cfg - Configuração (FACIAL_IP, FACIAL_USER, FACIAL_PASS)
 * @param {Object} params
 * @param {string} params.userID - ID do usuário (precisa existir no device)
 * @param {Buffer} params.imageBuffer - Buffer da imagem
 * @returns {Promise<Object>} { ok, userID?, reqBytes?, meta?, error?, message? }
 */
async function uploadFaceFile(cfg, { userID, imageBuffer }) {
  try {
    // Validação de configuração
    if (!cfg?.FACIAL_IP) {
      return { ok: false, error: "CFG_MISSING", message: "cfg.FACIAL_IP não configurado" };
    }
    if (!cfg?.FACIAL_USER || !cfg?.FACIAL_PASS) {
      return { ok: false, error: "CFG_MISSING", message: "cfg.FACIAL_USER/FACIAL_PASS não configurados" };
    }

    console.log(`[FACE] Iniciando upload de face para userID=${userID}`);

    // Obtém sessão
    const session = await getSession(cfg);

    // Comprime imagem até caber no limite
    const built = await makeB64ThatFits(imageBuffer, {
      session,
      userID,
      maxRequestBytes: MAX_REQUEST_BYTES,
    });

    if (!built) {
      return {
        ok: false,
        error: "REQUEST_TOO_LARGE",
        message: `Não foi possível comprimir a imagem para caber em ${MAX_REQUEST_BYTES} bytes. Tente com uma foto menor ou de melhor qualidade.`,
        maxRequestBytes: MAX_REQUEST_BYTES,
      };
    }

    // Envia para o dispositivo
    const sent = await sendFace(cfg, { session, userID, b64: built.b64 });

    if (!sent.ok) {
      return { ...sent, meta: built.meta };
    }

    return { 
      ...sent, 
      meta: built.meta,
      success: true,
      message: `Face cadastrada com sucesso! Tamanho: ${built.meta.size}px, Quality: ${built.meta.quality}`
    };

  } catch (e) {
    // Se sessão expirou, limpa cache
    if (String(e?.message || "").toLowerCase().includes("session")) {
      console.log("[SESSION] Sessão expirada, limpando cache...");
      cachedSession = null;
      cachedAt = 0;
    }

    console.error("[FACE] Erro inesperado:", e);
    return { 
      ok: false, 
      error: "RPC_ERROR", 
      message: e?.message || "Erro inesperado ao cadastrar face" 
    };
  }
}

/**
 * ✅ UPLOAD VIA BASE64 DIRETO
 * 
 * Envia base64 sem recompressão (útil para integração com banco de dados)
 * Aceita formatos:
 * - Base64 puro: "iVBORw0KGgoAAAANSUhEUgAA..."
 * - Data URI: "data:image/jpg;base64,iVBORw0KGg..."
 * 
 * @param {Object} cfg - Configuração
 * @param {Object} params
 * @param {string} params.userID - ID do usuário
 * @param {string} params.photoData - Base64 da imagem (com ou sem prefixo)
 * @returns {Promise<Object>} Resultado do envio
 */
async function uploadFaceBase64(cfg, { userID, photoData }) {
  try {
    // Validação de configuração
    if (!cfg?.FACIAL_IP) {
      return { ok: false, error: "CFG_MISSING", message: "cfg.FACIAL_IP não configurado" };
    }
    if (!cfg?.FACIAL_USER || !cfg?.FACIAL_PASS) {
      return { ok: false, error: "CFG_MISSING", message: "cfg.FACIAL_USER/FACIAL_PASS não configurados" };
    }

    // Remove prefixo data URI se existir
    const b64 = stripDataUri(photoData);
    
    // Validação de base64
    if (!b64 || b64.length < 1000) {
      return { 
        ok: false, 
        error: "VALIDATION_ERROR", 
        message: "photoData inválido (muito curto ou vazio)" 
      };
    }

    console.log(`[FACE] Upload base64 direto para userID=${userID} (${b64.length} chars)`);

    // Obtém sessão
    const session = await getSession(cfg);

    // Envia direto (sem recompressão)
    return await sendFace(cfg, { session, userID, b64 });

  } catch (e) {
    // Se sessão expirou, limpa cache
    if (String(e?.message || "").toLowerCase().includes("session")) {
      console.log("[SESSION] Sessão expirada, limpando cache...");
      cachedSession = null;
      cachedAt = 0;
    }

    console.error("[FACE] Erro inesperado:", e);
    return { 
      ok: false, 
      error: "RPC_ERROR", 
      message: e?.message || "Erro inesperado ao cadastrar face" 
    };
  }
}

module.exports = {
  uploadFaceFile,
  uploadFaceBase64,
};