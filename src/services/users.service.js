const { rpc2Login, rpc2Call } = require("../clients/rpc2.client");

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

    // ✅ Inclui Cartão se fornecido
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
    if (!start?.result || !token) {
        // startFind falhou
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
        userID: String(userID),
    };
}

// Atualiza user (mantendo outros dados) + Cartão opcional
async function updateUser(cfg, { userID, userName, password, authority, cardNo }) {
    if (!userID) {
        return { ok: false, error: { message: "Campo obrigatório: userID" } };
    }

    const session = await login(cfg);

    // Busca user para não perder dados antigos
    const current = await getUser(cfg, userID);
    if (!current.ok) {
        if (current.error?.message === "user_not_found") {
            // Opcional: Se não existe, cria? Não, update deve atualizar.
            return { ok: false, error: "Usuário não existe no dispositivo para atualizar." };
        }
        return current;
    }

    const base = current.data;

    if (userName) base.UserName = String(userName);
    if (password) base.Password = String(password);
    if (authority !== undefined) base.Authority = Number(authority);

    // ✅ Atualiza cartão se vier
    if (cardNo !== undefined && cardNo !== null) {
        if (String(cardNo).trim() === "") delete base.CardNo; // Remove se vazio
        else base.CardNo = String(cardNo);
    }

    // Garante ID
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
        userID: String(userID),
    };
}

async function assignCard(cfg, { userID, cardNo }) {
    if (!userID || !cardNo) {
        return { ok: false, error: { message: "Campos obrigatórios: userID, cardNo" } };
    }
    // Reusa o updateUser para garantir consistência
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

    return { ok: true, deleted: true, userID: String(userID) };
}

module.exports = {
    getUser,
    createUser,
    updateUser,
    assignCard,
    deleteUser,
};