const { rpc2Login, rpc2CallForm } = require("../clients/rpc2.client");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class Rpc2SessionService {
  constructor({ ip, user, pass }) {
    this.ip = ip;
    this.user = user;
    this.pass = pass;
    this.session = null;
    this.running = false;
  }

  async ensureSession() {
    if (this.session) return this.session;
    this.session = await rpc2Login({ ip: this.ip, user: this.user, pass: this.pass });
    return this.session;
  }

  async keepAliveOnce() {
    const session = await this.ensureSession();

    // IMPORTANT: use Form (igual webclient)
    const res = await rpc2CallForm({
      ip: this.ip,
      session,
      method: "global.keepAlive",
      params: { timeout: 60, active: true },
      id: 61,
    });

    return res;
  }

  async startKeepAliveLoop({ intervalMs = 45000 } = {}) {
    if (this.running) return;
    this.running = true;

    while (this.running) {
      try {
        await this.keepAliveOnce();
      } catch (e) {
        // sessão pode ter expirado / device resetou -> re-login
        this.session = null;
      }
      await sleep(intervalMs);
    }
  }

  stop() {
    this.running = false;
  }

  async call(method, params, { id = 1000, object } = {}) {
    const session = await this.ensureSession();
    return rpc2CallForm({ ip: this.ip, session, method, params, id, object });
  }
}

module.exports = { Rpc2SessionService };
