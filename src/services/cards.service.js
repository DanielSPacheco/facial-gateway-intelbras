const { rpc2Login, rpc2Call } = require("../clients/rpc2.client");

async function assignCard(cfg, { userID, cardNo }) {
  if (!userID || !cardNo) {
    return {
      ok: false,
      error: { message: "Campos obrigatórios: userID, cardNo" },
    };
  }

  // 1) Login RPC2 (gera session válida)
  const session = await rpc2Login({
    ip: cfg.FACIAL_IP,
    user: cfg.FACIAL_USER,
    pass: cfg.FACIAL_PASS,
    timeoutMs: cfg.TIMEOUT_MS,
  });

  // 2) Insere cartão usando método próprio
  const result = await rpc2Call({
    ip: cfg.FACIAL_IP,
    session,
    method: "AccessCard.insertMulti",
    params: {
      CardList: [
        {
          CardNo: String(cardNo),
          UserID: String(userID),
        },
      ],
    },
    id: 3100,
    timeoutMs: cfg.TIMEOUT_MS,
  });

  if (result?.result !== true) {
    return {
      ok: false,
      error: result?.error || { message: "assign_card_failed" },
      raw: result,
    };
  }

  return {
    ok: true,
    assigned: true,
    userID: String(userID),
    cardNo: String(cardNo),
    method: "AccessCard.insertMulti",
  };
}

module.exports = { assignCard };