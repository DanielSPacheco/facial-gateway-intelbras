const { rpc2Login, rpc2Call } = require("../clients/rpc2.client");
const { resolveTarget } = require("../utils/target.util");

/**
 * Monta payload padrão para o dispositivo
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
    UserTime: 200,
    UserID: String(userID),
    UserName: String(userName),
    UserStatus: 0,
    UserType: 0,
    VTOPosition: "",
    ValidFrom: "1970-01-01 00:00:00",
    ValidTo: "2037-12-31 23:59:59",
  };

  //  Inclui Cartão se fornecido
  if (cardNo !== undefined && cardNo !== null && String(cardNo).trim() !== "") {
    userObj.CardNo = String(cardNo);
  }

  return userObj;
}

/**
 * Login no dispositivo, respeitando target se vier no body/payload
 */
async function login(cfg, bodyOrPayload) {
  const tcfg = resolveTarget(cfg, bodyOrPayload);

  return rpc2Login({
    ip: tcfg.FACIAL_IP,
    user: tcfg.FACIAL_USER,
    pass: tcfg.FACIAL_PASS,
    timeoutMs: tcfg.TIMEOUT_MS,
  });
}

/**
 * Busca usuário por UserID
 */
async function getUser(cfg, bodyOrPayload, userID) {
  const tcfg = resolveTarget(cfg, bodyOrPayload);
  const session = await login(cfg, bodyOrPayload);

  const start = await rpc2Call({
    ip: tcfg.FACIAL_IP,
    session,
    method: "AccessUser.startFind",
    params: { Condition: { UserID: String(userID) } },
    id: 1001,
    timeoutMs: tcfg.TIMEOUT_MS,
  });

  const token = start?.params?.Token;
  if (!start?.result || !token) {
    return { ok: false, error: { message: "startFind_failed" }, raw: start };
  }

  const found = await rpc2Call({
    ip: tcfg.FACIAL_IP,
    session,
    method: "AccessUser.doFind",
    params: { Token: token, Offset: 0, Count: 1 },
    id: 1002,
    timeoutMs: tcfg.TIMEOUT_MS,
  });

  // sempre tenta stopFind
  await rpc2Call({
    ip: tcfg.FACIAL_IP,
    session,
    method: "AccessUser.stopFind",
    params: { Token: token },
    id: 1003,
    timeoutMs: tcfg.TIMEOUT_MS,
  });

  const info = found?.params?.Info?.[0] || null;

  if (!info) {
    return { ok: false, error: { message: "user_not_found" }, raw: found };
  }

  return { ok: true, data: info };
}

/**
 * Cria usuário
 */
async function createUser(cfg, bodyOrPayload) {
  const { userID, userName, password, authority, cardNo } = bodyOrPayload || {};

  if (!userID || !userName) {
    return { ok: false, error: { message: "Campos obrigatórios: userID, userName" } };
  }

  const tcfg = resolveTarget(cfg, bodyOrPayload);
  const session = await login(cfg, bodyOrPayload);

  const userObj = buildUser({ userID, userName, password, authority, cardNo });

  const r = await rpc2Call({
    ip: tcfg.FACIAL_IP,
    session,
    method: "AccessUser.insertMulti",
    params: { UserList: [userObj] },
    id: 2100,
    timeoutMs: tcfg.TIMEOUT_MS,
  });

  if (r?.result !== true) {
    return { ok: false, error: r?.error || { message: "create_failed" }, raw: r };
  }

  return {
    ok: true,
    created: true,
    userID: String(userID),
  };
}

/**
 * Atualiza usuário (mantendo outros dados) + Cartão opcional
 */
async function updateUser(cfg, bodyOrPayload) {
  const { userID, userName, password, authority, cardNo } = bodyOrPayload || {};

  if (!userID) {
    return { ok: false, error: { message: "Campo obrigatório: userID" } };
  }

  const tcfg = resolveTarget(cfg, bodyOrPayload);
  const session = await login(cfg, bodyOrPayload);

  // Busca user para não perder dados antigos
  const current = await getUser(cfg, bodyOrPayload, userID);
  if (!current.ok) {
    if (current.error?.message === "user_not_found") {
      return { ok: false, error: { message: "Usuário não existe no dispositivo para atualizar." } };
    }
    return current;
  }

  const base = current.data;

  if (userName) base.UserName = String(userName);
  if (password) base.Password = String(password);
  if (authority !== undefined) base.Authority = Number(authority);

  // Atualiza cartão se vier
  if (cardNo !== undefined && cardNo !== null) {
    if (String(cardNo).trim() === "") delete base.CardNo; // Remove se vazio
    else base.CardNo = String(cardNo);
  }

  // Garante ID
  base.UserID = String(userID);

  const r = await rpc2Call({
    ip: tcfg.FACIAL_IP,
    session,
    method: "AccessUser.updateMulti",
    params: { UserList: [base] },
    id: 2200,
    timeoutMs: tcfg.TIMEOUT_MS,
  });

  if (r?.result !== true) {
    return { ok: false, error: r?.error || { message: "update_failed" }, raw: r };
  }

  return {
    ok: true,
    updated: true,
    userID: String(userID),
  };
}

/**
 * Atribui cartão (reusa updateUser)
 */
async function assignCard(cfg, bodyOrPayload) {
  const { userID, cardNo } = bodyOrPayload || {};

  if (!userID || !cardNo) {
    return { ok: false, error: { message: "Campos obrigatórios: userID, cardNo" } };
  }

  return updateUser(cfg, { ...bodyOrPayload, userID, cardNo });
}

/**
 * Remove usuário
 */
async function deleteUser(cfg, bodyOrPayload) {
  const { userID } = bodyOrPayload || {};

  if (!userID) {
    return { ok: false, error: { message: "Campo obrigatório: userID" } };
  }

  const tcfg = resolveTarget(cfg, bodyOrPayload);
  const session = await login(cfg, bodyOrPayload);

  const r = await rpc2Call({
    ip: tcfg.FACIAL_IP,
    session,
    method: "AccessUser.removeMulti",
    params: { UserIDList: [String(userID)] },
    id: 2300,
    timeoutMs: tcfg.TIMEOUT_MS,
  });

  if (r?.result !== true) {
    return { ok: false, error: r?.error || { message: "delete_failed" }, raw: r };
  }

  return { ok: true, deleted: true, userID: String(userID) };
}

module.exports = {
  // assinatura “amiga” para routes:
  // getUser(cfg, req.body) -> usa req.body.userID
  getUser: async (cfg, bodyOrPayload) => {
    const { userID } = bodyOrPayload || {};
    if (!userID) return { ok: false, error: { message: "Campo obrigatório: userID" } };
    return getUser(cfg, bodyOrPayload, userID);
  },

  createUser,
  updateUser,
  assignCard,
  deleteUser,
};