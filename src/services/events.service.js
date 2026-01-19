const { rpc2Login, rpc2CallForm } = require("../clients/rpc2.client");
const { resolveTarget } = require("../utils/target.util");

function parseEpochSeconds(v) {
  if (v === undefined || v === null || v === "") return null;
  if (/^\d+$/.test(String(v))) return Number(v);

  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor(d.getTime() / 1000);
}

function mustInt(n, def, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return def;
  const xi = Math.floor(x);
  if (min !== undefined && xi < min) return min;
  if (max !== undefined && xi > max) return max;
  return xi;
}

async function resolveDeviceForEvents(cfg, bodyOrPayload = {}) {
  // 1) target explícito (prioridade)
  if (bodyOrPayload?.target?.ip) {
    const tcfg = resolveTarget(cfg, bodyOrPayload);
    return {
      ip: tcfg.FACIAL_IP,
      user: tcfg.FACIAL_USER,
      pass: tcfg.FACIAL_PASS,
      timeoutMs: tcfg.TIMEOUT_MS || 15000,
    };
  }

  // 2) deviceId via resolver do cfg
  if (bodyOrPayload?.deviceId && typeof cfg.resolveDevice === "function") {
    const device = await cfg.resolveDevice(bodyOrPayload.deviceId);
    if (device?.ip) {
      return {
        ip: device.ip,
        user: device.user,
        pass: device.pass,
        timeoutMs: cfg.timeouts?.rpc2 ?? cfg.TIMEOUT_MS ?? 15000,
      };
    }
  }

  // 3) fallback env do gateway
  const tcfg = resolveTarget(cfg, bodyOrPayload);
  return {
    ip: tcfg.FACIAL_IP,
    user: tcfg.FACIAL_USER,
    pass: tcfg.FACIAL_PASS,
    timeoutMs: tcfg.TIMEOUT_MS || 15000,
  };
}

async function getEvents(cfg, bodyOrPayload = {}) {
  const { from, to } = bodyOrPayload;

  const fromEpoch = parseEpochSeconds(from);
  const toEpoch = parseEpochSeconds(to);

  if (!fromEpoch || !toEpoch || fromEpoch >= toEpoch) {
    return {
      ok: false,
      error: "VALIDATION_ERROR",
      message: "from/to inválidos (use ISO ou epoch seconds)",
      example: {
        good1: `?from=1768359600&to=1768446000&limit=50`,
        good2: `?from=2026-01-14T00:00:00-03:00&to=2026-01-15T00:00:00-03:00&limit=50`,
      },
    };
  }

  let limit = mustInt(bodyOrPayload.limit, 50, 1, 200);
  let offset = mustInt(bodyOrPayload.offset, 0, 0, 5000);

  const device = await resolveDeviceForEvents(cfg, bodyOrPayload);
  if (!device?.ip) {
    return { ok: false, error: "DEVICE_NOT_FOUND", deviceId: bodyOrPayload.deviceId || null };
  }

  const session = await rpc2Login({
    ip: device.ip,
    user: device.user,
    pass: device.pass,
    timeoutMs: device.timeoutMs,
  });

  const create = await rpc2CallForm({
    ip: device.ip,
    session,
    method: "RecordFinder.factory.create",
    params: { name: "AccessControlCardRec" },
    id: 73,
    timeoutMs: device.timeoutMs,
  });

  const object = create?.result;
  if (!object) {
    return { ok: false, error: "FACTORY_CREATE_FAILED", raw: create };
  }

  const start = await rpc2CallForm({
    ip: device.ip,
    session,
    method: "RecordFinder.startFind",
    params: {
      condition: {
        CreateTime: ["<>", fromEpoch, toEpoch],
        Orders: [{ Field: "CreateTime", Type: "Descent" }],
      },
    },
    id: 74,
    object,
    timeoutMs: device.timeoutMs,
  });

  if (!start?.result) {
    try {
      await rpc2CallForm({
        ip: device.ip,
        session,
        method: "RecordFinder.stopFind",
        params: null,
        id: 78,
        object,
        timeoutMs: device.timeoutMs,
      });
    } catch {}
    return { ok: false, error: "START_FIND_FAILED", raw: start };
  }

  const doFind = await rpc2CallForm({
    ip: device.ip,
    session,
    method: "RecordFinder.doFind",
    params: { count: limit, begin: offset },
    id: 75,
    object,
    timeoutMs: device.timeoutMs,
  });

  const records = doFind?.params?.records || [];
  const found = doFind?.params?.found ?? records.length;

  const stop = await rpc2CallForm({
    ip: device.ip,
    session,
    method: "RecordFinder.stopFind",
    params: null,
    id: 78,
    object,
    timeoutMs: device.timeoutMs,
  });

  return {
    ok: true,
    fromEpoch,
    toEpoch,
    limit,
    offset,
    found,
    stop_ok: !!stop?.result,
    device: { ip: device.ip },
    records,
    raw: { create, start, doFind, stop },
  };
}

function buildPhotoUrl({ gatewayBaseUrl, deviceId, urlPath }) {
  if (!gatewayBaseUrl || !deviceId || !urlPath) return null;
  const base = String(gatewayBaseUrl).replace(/\/+$/, "");
  const id = encodeURIComponent(String(deviceId));
  const path = encodeURIComponent(String(urlPath));
  return `${base}/facial/events/${id}/photo?url=${path}`;
}

async function listEvents(cfg, bodyOrPayload = {}) {
  const result = await getEvents(cfg, bodyOrPayload);
  if (!result?.ok) return result;

  const gatewayBaseUrl = bodyOrPayload.gatewayBaseUrl;
  const deviceId = bodyOrPayload.deviceId;

  if (!gatewayBaseUrl || !deviceId) return result;

  const records = (result.records || []).map((r) => {
    const photoUrl = buildPhotoUrl({
      gatewayBaseUrl,
      deviceId,
      urlPath: r?.URL,
    });

    return photoUrl ? { ...r, photo_url: photoUrl } : r;
  });

  return { ...result, records };
}

module.exports = { getEvents, listEvents };
