const { rpc2Login, rpc2Call } = require("../clients/rpc2.client");
const { resolveTarget } = require("../utils/target.util");

async function login(cfg, bodyOrPayload) {
  const tcfg = resolveTarget(cfg, bodyOrPayload);
  return rpc2Login({
    ip: tcfg.FACIAL_IP,
    user: tcfg.FACIAL_USER,
    pass: tcfg.FACIAL_PASS,
    timeoutMs: tcfg.TIMEOUT_MS,
  });
}

async function assignCard(cfg, bodyOrPayload = {}) {
  const { userID, cardNo } = bodyOrPayload;

  if (!userID || !cardNo) {
    return { ok: false, error: { message: "Campos obrigatórios: userID, cardNo" } };
  }

  const tcfg = resolveTarget(cfg, bodyOrPayload);
  const session = await login(cfg, bodyOrPayload);

  const result = await rpc2Call({
    ip: tcfg.FACIAL_IP,
    session,
    method: "AccessCard.insertMulti",
    params: {
      CardList: [{ CardNo: String(cardNo), UserID: String(userID) }],
    },
    id: 3100,
    timeoutMs: tcfg.TIMEOUT_MS,
  });

  if (result?.result !== true) {
    return { ok: false, error: result?.error || { message: "assign_card_failed" }, raw: result };
  }

  return {
    ok: true,
    assigned: true,
    userID: String(userID),
    cardNo: String(cardNo),
    method: "AccessCard.insertMulti",
  };
}

async function removeCard(cfg, bodyOrPayload = {}) {
  const { cardNo } = bodyOrPayload;

  if (!cardNo) {
    return { ok: false, error: { message: "Campo obrigatório: cardNo" } };
  }

  const tcfg = resolveTarget(cfg, bodyOrPayload);
  const session = await login(cfg, bodyOrPayload);

  const result = await rpc2Call({
    ip: tcfg.FACIAL_IP,
    session,
    method: "AccessCard.removeMulti",
    params: { CardNoList: [String(cardNo)] },
    id: 3101,
    timeoutMs: tcfg.TIMEOUT_MS,
  });

  if (result?.result !== true) {
    return { ok: false, error: result?.error || { message: "remove_card_failed" }, raw: result };
  }

  return {
    ok: true,
    removed: true,
    cardNo: String(cardNo),
    method: "AccessCard.removeMulti",
  };
}

module.exports = { assignCard, removeCard };