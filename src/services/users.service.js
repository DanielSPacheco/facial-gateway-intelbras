const { rpc2Login, rpc2Call } = require("../clients/rpc2.client");

/**
 * Monta payload padrão compatível com AccessUser.insertMulti/updateMulti
 * - Mantém o "shape" que o device costuma aceitar
 * - Inclui CardNo somente se vier preenchido
 */
function buildUser({ userID, userName, password, authority, cardNo }) {
  const userObj = {
    Authority: Number(authority ?? 2),
    CitizenIDNo: "",
    Doors: [0],
    FirstEnterDoors: [-1],
    IsFirstEnter: false,
    Password: String(password || "1234"),
    SpecialDaysSchedule: [255],
    TimeSections: [255],
    UserTime: 200, // ✅ (no seu snippet estava UseTime)
    UserID: String(userID),
    UserName: String(userName),
    UserStatus: 0,
    UserType: 0,
    VTOPosition: "",
    ValidFrom: "1970-01-01 00:00:00",
    ValidTo: "2037-12-31 23:59:59",
  };

  // ✅ Tag/Cartão (decimal) — só envia se vier definido
  if (cardNo !== undefined && cardNo !== null && String(cardNo).trim() !== "") {
    userObj.CardNo = String(cardNo);
  }

  return userObj;
}

async function login(cfg) {
  return rpc2Login({
    ip: cfg.FACIAL_IP,
    user: cfg.FACIAL_USER,
    pass: cfg.FACIAL_PASS,
    timeoutMs: cfg.TIMEOUT_MS,
  });
}

async function getUser(cfg, userID) {
  const session = await login(cfg);

  const start = await rpc2Call({
    ip: cfg.FACIAL_IP,
    session,
    method: "AccessUser.startFind",
    params: { Condition: { UserID: String(userID) } },
    id: 1001,
    timeoutMs: cfg.TIMEOUT_MS,
  });

  const token = start?.params?.Token;
  if (!token) {
    return { ok: false, error: { message: "startFind_failed" }, raw: start };
  }

  const found = await rpc2Call({
    ip: cfg.FACIAL_IP,
    session,
    method: "AccessUser.doFind",
    params: { Token: token, Offset: 0, Count: 1 },
    id: 1002,
    timeoutMs: cfg.TIMEOUT_MS,
  });

  await rpc2Call({
    ip: cfg.FACIAL_IP,
    session,
    method: "AccessUser.stopFind",
    params: { Token: token },
    id: 1003,
    timeoutMs: cfg.TIMEOUT_MS,
  });

  const info = found?.params?.Info?.[0] || null;

  if (!info) {
    return { ok: false, error: { message: "user_not_found" }, raw: found };
  }

  return { ok: true, data: info };
}

async function createUser(cfg, { userID, userName, password, authority, cardNo }) {
  if (!userID || !userName) {
    return { ok: false, error: { message: "Campos obrigatórios: userID, userName" } };
  }

  const session = await login(cfg);

  const userObj = buildUser({ userID, userName, password, authority, cardNo });

  const r = await rpc2Call({
    ip: cfg.FACIAL_IP,
    session,
    method: "AccessUser.insertMulti",
    params: { UserList: [userObj] },
    id: 2100,
    timeoutMs: cfg.TIMEOUT_MS,
  });

  if (r?.result !== true) {
    return { ok: false, error: r?.error || { message: "create_failed" }, raw: r };
  }

  return {
    ok: true,
    created: true,
    method: "AccessUser.insertMulti",
    userID: String(userID),
  };
}

/**
 * Atualiza usuário mantendo o payload atual do device.
 * Você pode passar:
 * - userName
 * - password
 * - authority
 * - cardNo  (TAG decimal)
 *
 * O método:
 * 1) busca o user atual no device
 * 2) altera apenas os campos enviados
 * 3) envia updateMulti com o objeto completo
 */
async function updateUser(cfg, { userID, userName, password, authority, cardNo }) {
  if (!userID) {
    return { ok: false, error: { message: "Campo obrigatório: userID" } };
  }

  const session = await login(cfg);

  const current = await getUser(cfg, userID);
  if (!current.ok) return current;

  const base = current.data;

  if (userName !== undefined) base.UserName = String(userName);
  if (password !== undefined) base.Password = String(password);
  if (authority !== undefined) base.Authority = Number(authority);

  // ✅ Tag/Cartão
  if (cardNo !== undefined && cardNo !== null && String(cardNo).trim() !== "") {
    base.CardNo = String(cardNo);
  }

  // Garantir que UserID está consistente
  base.UserID = String(userID);

  const r = await rpc2Call({
    ip: cfg.FACIAL_IP,
    session,
    method: "AccessUser.updateMulti",
    params: { UserList: [base] },
    id: 2200,
    timeoutMs: cfg.TIMEOUT_MS,
  });

  if (r?.result !== true) {
    return { ok: false, error: r?.error || { message: "update_failed" }, raw: r };
  }

  return {
    ok: true,
    updated: true,
    method: "AccessUser.updateMulti",
    userID: String(userID),
  };
}

/**
 * Atalho específico para vincular cartão (TAG) ao usuário.
 * Internamente usa updateUser para manter o objeto completo.
 */
async function assignCard(cfg, { userID, cardNo }) {
  if (!userID || !cardNo) {
    return { ok: false, error: { message: "Campos obrigatórios: userID, cardNo" } };
  }
  return updateUser(cfg, { userID, cardNo });
}

async function deleteUser(cfg, { userID }) {
  if (!userID) {
    return { ok: false, error: { message: "Campo obrigatório: userID" } };
  }

  const session = await login(cfg);

  const r = await rpc2Call({
    ip: cfg.FACIAL_IP,
    session,
    method: "AccessUser.removeMulti",
    params: { UserIDList: [String(userID)] },
    id: 2300,
    timeoutMs: cfg.TIMEOUT_MS,
  });

  if (r?.result !== true) {
    return { ok: false, error: r?.error || { message: "delete_failed" }, raw: r };
  }

  return {
    ok: true,
    deleted: true,
    method: "AccessUser.removeMulti",
    userID: String(userID),
  };
}

module.exports = {
  buildUser,
  getUser,
  createUser,
  updateUser,
  assignCard,
  deleteUser,
};