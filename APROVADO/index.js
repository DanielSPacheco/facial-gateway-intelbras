require("dotenv").config();
const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "2mb" }));

// .env (no APROVADO)
const IP = process.env.FACIAL_IP;
const USER = process.env.FACIAL_USER;
const PASS = process.env.FACIAL_PASS;
const PORT = Number(process.env.PORT || 3000);

if (!IP || !USER || !PASS) {
  console.error("❌ Falta configurar .env (FACIAL_IP, FACIAL_USER, FACIAL_PASS)");
  process.exit(1);
}

const URL_LOGIN = `http://${IP}/RPC2_Login`;
const URL = `http://${IP}/RPC2`;

function md5Upper(s) {
  return crypto.createHash("md5").update(s).digest("hex").toUpperCase();
}
function calcularHash(user, pass, realm, random) {
  const passHash = md5Upper(`${user}:${realm}:${pass}`);
  return md5Upper(`${user}:${random}:${passHash}`);
}

async function login() {
  const step1 = await axios.post(URL_LOGIN, {
    method: "global.login",
    params: { userName: USER, password: "", clientType: "Web3.0" },
    id: 1,
  });

  const ch = step1.data.params;

  const step2 = await axios.post(URL_LOGIN, {
    method: "global.login",
    params: {
      userName: USER,
      password: calcularHash(USER, PASS, ch.realm, ch.random),
      clientType: "Web3.0",
      authorityType: ch.encryption,
    },
    session: step1.data.session,
    id: 2,
  });

  return step2.data.session;
}

async function rpc(session, method, params, id = 2000) {
  const { data } = await axios.post(
    URL,
    { method, params, session, id },
    {
      headers: { "Content-Type": "application/json", Connection: "close" },
      timeout: 15000,
    }
  );
  return data;
}

// Baseado no doFind REAL do seu device (777)
function buildUser({
  userID,
  userName,
  password,
  authority = 2,
  validFrom = "1970-01-01 00:00:00",
  validTo = "2037-12-31 23:59:59",
}) {
  return {
    Authority: authority,
    CitizenIDNo: "",
    Doors: [0],
    FirstEnterDoors: [-1],
    IsFirstEnter: false,
    Password: String(password ?? ""), // alguns firmwares aceitam vazio em update
    SpecialDaysSchedule: [255],
    TimeSections: [255],
    UseTime: 200,
    UserID: String(userID),
    UserName: String(userName),
    UserStatus: 0,
    UserType: 0,
    VTOPosition: "",
    ValidFrom: validFrom,
    ValidTo: validTo,
  };
}

// GET user by id (startFind/doFind/stopFind)
async function getUserById(session, userID) {
  const start = await rpc(session, "AccessUser.startFind", { Condition: { UserID: String(userID) } }, 3101);
  if (!start?.result) return { ok: false, step: "startFind", start };

  const token = start?.params?.Token;
  const found = await rpc(session, "AccessUser.doFind", { Token: token, Offset: 0, Count: 1 }, 3102);
  await rpc(session, "AccessUser.stopFind", { Token: token }, 3103);

  return { ok: true, data: found?.params?.Info?.[0] ?? null };
}

// ---------- ROTAS ----------

// Porta
app.post("/facial/door/open", async (req, res) => {
  try {
    const session = await login();
    // seu projeto já tem a call certa; aqui só deixo um placeholder genérico
    // Se sua rota atual já funciona 100%, mantenha a sua implementação.
    // Exemplo (ajuste para o seu método real):
    const r = await rpc(session, "accessControl.openDoor", { DoorID: 0 }, 4001);

    return res.json({
      ok: r?.result === true,
      command: "openDoor",
      httpCode: 200,
      data: r,
      error: r?.error || "",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// CREATE user (já validado por você: insertMulti)
app.post("/facial/user/create", async (req, res) => {
  try {
    const { userID, userName, password, authority, validFrom, validTo } = req.body || {};

    const missing = [];
    if (!userID) missing.push("userID");
    if (!userName) missing.push("userName");
    if (!password) missing.push("password");

    if (missing.length) {
      return res.status(400).json({
        ok: false,
        error: `Campos obrigatórios: ${missing.join(", ")}`,
        example: { userID: "888", userName: "Joao", password: "1234", authority: 2 },
      });
    }

    const session = await login();
    const userObj = buildUser({ userID, userName, password, authority, validFrom, validTo });

    const r = await rpc(session, "AccessUser.insertMulti", { UserList: [userObj] }, 2100);

    if (r?.result === true) {
      return res.json({ ok: true, created: true, method: "AccessUser.insertMulti", userID: String(userID) });
    }
    return res.status(400).json({ ok: false, created: false, error: r?.error || r });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// UPDATE user (tentativa com métodos comuns)
app.post("/facial/user/update", async (req, res) => {
  try {
    const { userID, userName, password, authority, validFrom, validTo } = req.body || {};
    if (!userID) return res.status(400).json({ ok: false, error: "Campo obrigatório: userID" });

    // Se não mandar userName, a gente tenta buscar o atual e manter
    const session = await login();
    let current = null;

    if (!userName || password == null || authority == null || !validFrom || !validTo) {
      const found = await getUserById(session, userID);
      current = found.data;
    }

    const finalUser = {
      ...(current || {}),
      ...buildUser({
        userID,
        userName: userName ?? (current?.UserName || ""),
        password: password ?? (current?.Password || ""), // cuidado: alguns firmwares não devolvem senha real
        authority: authority ?? (current?.Authority ?? 2),
        validFrom: validFrom ?? (current?.ValidFrom || "1970-01-01 00:00:00"),
        validTo: validTo ?? (current?.ValidTo || "2037-12-31 23:59:59"),
      }),
    };

    // lista de candidatos (probe)
    const candidates = [
      { method: "AccessUser.updateMulti", params: { UserList: [finalUser] } },
      { method: "AccessUser.modifyMulti", params: { UserList: [finalUser] } },
      { method: "AccessUser.setInfo", params: { User: finalUser } },
      { method: "AccessUser.setUser", params: { User: finalUser } },
      { method: "AccessUser.insertMulti", params: { UserList: [finalUser] } }, // alguns firmwares "upsert"
    ];

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const r = await rpc(session, c.method, c.params, 2200 + i);

      // Method not found? segue para o próximo
      if (r?.error?.message?.includes("Method not found")) continue;

      if (r?.result === true) {
        return res.json({ ok: true, updated: true, method: c.method, userID: String(userID) });
      }
    }

    return res.status(400).json({
      ok: false,
      updated: false,
      error: "Nenhum método de update funcionou nesse firmware. Precisamos do método exato via DevTools (OK) decifrado ou tentar outros candidates.",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// DELETE user (probe)
app.post("/facial/user/delete", async (req, res) => {
  try {
    const { userID } = req.body || {};
    if (!userID) return res.status(400).json({ ok: false, error: "Campo obrigatório: userID" });

    const session = await login();

    const candidates = [
      { method: "AccessUser.deleteMulti", params: { UserIDList: [String(userID)] } },
      { method: "AccessUser.removeMulti", params: { UserIDList: [String(userID)] } },
      { method: "AccessUser.delete", params: { UserID: String(userID) } },
      { method: "AccessUser.remove", params: { UserID: String(userID) } },
    ];

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const r = await rpc(session, c.method, c.params, 2300 + i);

      if (r?.error?.message?.includes("Method not found")) continue;
      if (r?.result === true) return res.json({ ok: true, deleted: true, method: c.method, userID: String(userID) });
    }

    return res.status(400).json({ ok: false, deleted: false, error: "Nenhum método de delete funcionou (firmware diferente)." });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// GET user
app.get("/facial/user/:id", async (req, res) => {
  try {
    const session = await login();
    const out = await getUserById(session, req.params.id);
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(PORT, () => console.log(`✅ Facial Gateway ON: http://localhost:${PORT}`));