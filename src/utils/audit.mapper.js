// src/utils/audit.mapper.js

function maskCard(cardNo) {
  const s = String(cardNo || "");
  if (!s) return "";
  if (s.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}

function mapDeviceEventToAuditRow(deviceId, r) {
  const ts = Number(r.CreateTime) * 1000;
  const when = new Date(ts).toISOString();

  const hasUser = !!(r.UserID && String(r.UserID).trim());
  const method = Number(r.Method);

  let action = "Acesso";

  if (method === 15) action = "Reconhecimento facial";
  else if (r.CardNo) action = "Acesso via cartão";
  else action = "Acesso não identificado";

  const ok = Number(r.Status) === 1 && Number(r.ErrorCode) === 0;

  return {
    eventKey: `${deviceId}:${r.RecNo ?? ""}:${r.CreateTime ?? ""}:${method}:${r.UserID ?? ""}:${r.CardNo ?? ""}`,

    deviceId,
    occurredAt: when,

    action,
    status: ok ? "Success" : "Failed",

    userLabel: hasUser ? (r.CardName || `User ${r.UserID}`) : "Desconhecido",
    userId: hasUser ? String(r.UserID) : null,

    method,
    type: r.Type || null,

    cardLast4: r.CardNo ? maskCard(r.CardNo) : null,

    snapshotUrl: r.URL || null
  };
}

module.exports = {
  mapDeviceEventToAuditRow
};