const { rpc2Login, rpc2Call } = require("../clients/rpc2.client");

// payload padrão baseado no doFind real do seu device
function buildUser({ userID, userName, password, authority = 2 }) {
  return {
    Authority: authority,
    CitizenIDNo: "",
    Doors: [0],
    FirstEnterDoors: [-1],
    IsFirstEnter: false,
    Password: password || "1234",
    SpecialDaysSchedule: [255],
    TimeSections: [255],
    UseTime: 200,
    UserID: String(userID),
    UserName: String(userName),
    UserStatus: 0,
    UserType: 0,
    VTOPosition: "",
    ValidFrom: "1970-01-01 00:00:00",
    ValidTo: "2037-12-31 23:59:59",
  };
}

async function getUser(cfg, userID) {
  const session = await rpc2Login({
    ip: cfg.FACIAL_IP,
    user: cfg.FACIAL_USER,
    pass: cfg.FACIAL_PASS,
    timeoutMs: cfg.TIMEOUT_MS,
  });

  const start = await rpc2Call({
    ip: cfg.FACIAL_IP,
    session,
    method: "AccessUser.startFind",
    params: { Condition: { UserID: String(userID) } },
    id: 1001,
    timeoutMs: cfg.TIMEOUT_MS,
  });

  const token = start?.params?.Token;

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
  return { ok: true, data: info };
}

async function createUser(cfg, { userID, userName, password, authority }) {
  const session = await rpc2Login({
    ip: cfg.FACIAL_IP,
    user: cfg.FACIAL_USER,
    pass: cfg.FACIAL_PASS,
    timeoutMs: cfg.TIMEOUT_MS,
  });

  const userObj = buildUser({ userID, userName, password, authority });

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
  return { ok: true, created: true, method: "AccessUser.insertMulti", userID: String(userID) };
}

async function updateUser(cfg, { userID, userName }) {
  const session = await rpc2Login({
    ip: cfg.FACIAL_IP,
    user: cfg.FACIAL_USER,
    pass: cfg.FACIAL_PASS,
    timeoutMs: cfg.TIMEOUT_MS,
  });

  // pega user atual e só troca o nome
  const current = await getUser(cfg, userID);
  const base = current?.data;
  if (!base) return { ok: false, error: { message: "user_not_found" } };

  base.UserName = String(userName);

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
  return { ok: true, updated: true, method: "AccessUser.updateMulti", userID: String(userID) };
}

async function deleteUser(cfg, { userID }) {
  const session = await rpc2Login({
    ip: cfg.FACIAL_IP,
    user: cfg.FACIAL_USER,
    pass: cfg.FACIAL_PASS,
    timeoutMs: cfg.TIMEOUT_MS,
  });

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
  return { ok: true, deleted: true, method: "AccessUser.removeMulti", userID: String(userID) };
}

module.exports = { getUser, createUser, updateUser, deleteUser };