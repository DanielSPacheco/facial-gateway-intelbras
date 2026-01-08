const { rpc2Login, rpc2Call } = require("../clients/rpc2.client");

async function assignCard(cfg, { userID, cardNo }) {
  if (!userID || !cardNo) {
    return { ok: false, error: { message: "Campos obrigatórios: userID, cardNo" } };
  }

  const session = await rpc2Login({
    ip: cfg.FACIAL_IP,
    user: cfg.FACIAL_USER,
    pass: cfg.FACIAL_PASS,
    timeoutMs: cfg.TIMEOUT_MS,
  });

  const result = await rpc2Call({
    ip: cfg.FACIAL_IP,
    session,
    method: "AccessCard.insertMulti",
    params: {
      CardList: [{ CardNo: String(cardNo), UserID: String(userID) }],
    },
    id: 3100,
    timeoutMs: cfg.TIMEOUT_MS,
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

async function removeCard(cfg, { cardNo }) {
  if (!cardNo) {
    return { ok: false, error: { message: "Campo obrigatório: cardNo" } };
  }

  const session = await rpc2Login({
    ip: cfg.FACIAL_IP,
    user: cfg.FACIAL_USER,
    pass: cfg.FACIAL_PASS,
    timeoutMs: cfg.TIMEOUT_MS,
  });

  // ✅ O método que você validou via curl
  const result = await rpc2Call({
    ip: cfg.FACIAL_IP,
    session,
    method: "AccessCard.removeMulti",
    params: { CardNoList: [String(cardNo)] },
    id: 3101,
    timeoutMs: cfg.TIMEOUT_MS,
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