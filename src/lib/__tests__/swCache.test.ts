/**
 * public/sw-cache.js — casca do app offline e isolamento por usuário.
 *
 * O SW roda num escopo próprio; aqui ele é carregado num sandbox com `self`,
 * `caches` e `fetch` falsos. O que importa provar:
 *  - com rede, a navegação SEMPRE vem da rede (deploy novo chega na hora);
 *  - sem rede, a navegação cai na casca guardada (app abre offline);
 *  - arquivos de build: cache primeiro;
 *  - leituras da operação (tela Hoje) entram no cache da API, por usuário.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE = readFileSync(resolve(__dirname, "../../../public/sw-cache.js"), "utf8");
const ORIGIN = "https://app.bwild.test";

class FakeCache {
  store = new Map<string, Response>();
  private key(req: string | Request) {
    return new URL(typeof req === "string" ? req : req.url, ORIGIN).href;
  }
  async match(req: string | Request) {
    const r = this.store.get(this.key(req));
    return r ? r.clone() : undefined;
  }
  async put(req: string | Request, res: Response) {
    this.store.set(this.key(req), res.clone());
  }
  async keys() {
    return [...this.store.keys()].map((u) => new Request(u));
  }
  async delete(req: string | Request) {
    return this.store.delete(this.key(req));
  }
}

class FakeCaches {
  map = new Map<string, FakeCache>();
  async open(name: string) {
    if (!this.map.has(name)) this.map.set(name, new FakeCache());
    return this.map.get(name)!;
  }
  async keys() {
    return [...this.map.keys()];
  }
  async delete(name: string) {
    return this.map.delete(name);
  }
}

type Listener = (event: unknown) => void;

function loadSW(fetchImpl: (input: unknown, init?: unknown) => Promise<Response>) {
  const listeners: Record<string, Listener[]> = {};
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Listener) => (listeners[type] ??= []).push(fn),
    skipWaiting: () => undefined,
    clients: { claim: () => undefined },
  };
  const caches = new FakeCaches();
  new Function("self", "caches", "fetch", SOURCE)(self, caches, fetchImpl);

  async function dispatch(type: string, event: Record<string, unknown>) {
    const waits: Promise<unknown>[] = [];
    let responded: Promise<Response> | undefined;
    const ev = {
      ...event,
      waitUntil: (p: Promise<unknown>) => waits.push(p),
      respondWith: (p: Promise<Response>) => (responded = p),
    };
    for (const fn of listeners[type] ?? []) fn(ev);
    const res = responded ? await responded : undefined;
    await Promise.all(waits);
    // Os waitUntil podem registrar outros waitUntil.
    await Promise.all(waits);
    return res;
  }

  const fetchEvent = (url: string, opts: { mode?: string; token?: string } = {}) =>
    dispatch("fetch", {
      request: {
        url,
        method: "GET",
        mode: opts.mode ?? "cors",
        headers: new Headers(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
    });

  return { caches, dispatch, fetchEvent };
}

const html = (version: string) =>
  new Response(
    `<!doctype html><html><head><script type="module" src="/assets/index-${version}.js"></script><link rel="stylesheet" href="/assets/index-${version}.css"></head><body>${version}</body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
  );

function jwt(sub: string) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256" })}.${b64({ sub })}.sig`;
}

let online: boolean;
let version: string;
let calls: string[];

const network = async (input: unknown) => {
  const url = typeof input === "string" ? new URL(input, ORIGIN).href : (input as { url: string }).url;
  calls.push(url);
  if (!online) throw new TypeError("Failed to fetch");
  if (url.includes("/assets/")) return new Response(`asset ${url}`, { status: 200 });
  if (url.includes("/rest/v1/")) return new Response(JSON.stringify([{ id: "a1" }]), { status: 200 });
  return html(version);
};

beforeEach(() => {
  online = true;
  version = "v1";
  calls = [];
});

describe("sw-cache: casca do app", () => {
  it("com rede, a navegação vem SEMPRE da rede — deploy novo aparece na hora", async () => {
    const sw = loadSW(network);
    const r1 = await sw.fetchEvent(`${ORIGIN}/gestao/hoje`, { mode: "navigate" });
    expect(await r1!.text()).toContain("v1");
    version = "v2"; // deploy no Lovable
    const r2 = await sw.fetchEvent(`${ORIGIN}/gestao/hoje`, { mode: "navigate" });
    expect(await r2!.text()).toContain("v2");
  });

  it("sem rede, a navegação abre a última casca guardada (e os assets dela estão no cache)", async () => {
    const sw = loadSW(network);
    await sw.fetchEvent(`${ORIGIN}/gestao/hoje`, { mode: "navigate" });
    online = false;
    const r = await sw.fetchEvent(`${ORIGIN}/gestao/hoje?data=2026-10-13`, { mode: "navigate" });
    expect(r!.status).toBe(200);
    expect(await r!.text()).toContain("v1");
    const js = await sw.fetchEvent(`${ORIGIN}/assets/index-v1.js`);
    expect(js!.status).toBe(200);
  });

  it("a instalação já guarda a casca (a primeira carga não passou pelo SW)", async () => {
    const sw = loadSW(network);
    await sw.dispatch("install", {});
    online = false;
    const r = await sw.fetchEvent(`${ORIGIN}/gestao/hoje`, { mode: "navigate" });
    expect(await r!.text()).toContain("v1");
  });

  it("nunca aberto com sinal: página 'Sem conexão' em português, não o erro do navegador", async () => {
    online = false;
    const sw = loadSW(network);
    const r = await sw.fetchEvent(`${ORIGIN}/gestao/hoje`, { mode: "navigate" });
    expect(r!.status).toBe(503);
    expect(await r!.text()).toContain("Sem conexão");
  });

  it("arquivo de build: cache primeiro (não vai à rede de novo)", async () => {
    const sw = loadSW(network);
    await sw.fetchEvent(`${ORIGIN}/assets/Hoje-abc.js`);
    calls = [];
    const r = await sw.fetchEvent(`${ORIGIN}/assets/Hoje-abc.js`);
    expect(r!.status).toBe(200);
    expect(calls).toEqual([]);
  });

  it("a página informa os assets já carregados (lazy) e o SW guarda", async () => {
    const sw = loadSW(network);
    await sw.dispatch("message", { data: { type: "bwild-cache-assets", urls: [`${ORIGIN}/assets/Hoje-x.js`, "https://cdn.outro/x.js"] } });
    const assets = await sw.caches.open("bwild-assets-v1");
    expect(await assets.match(`${ORIGIN}/assets/Hoje-x.js`)).toBeDefined();
    expect(calls).not.toContain("https://cdn.outro/x.js");
  });

  it("activate apaga caches de versões anteriores e mantém os atuais", async () => {
    const sw = loadSW(network);
    await sw.caches.open("bwild-api-cache-v3");
    await sw.caches.open("bwild-shell-v0");
    await sw.caches.open("outro-app");
    await sw.caches.open("bwild-api-cache-v4");
    await sw.dispatch("activate", {});
    const names = await sw.caches.keys();
    expect(names).not.toContain("bwild-api-cache-v3");
    expect(names).not.toContain("bwild-shell-v0");
    expect(names).toContain("outro-app");
    expect(names).toContain("bwild-api-cache-v4");
  });
});

describe("sw-cache: leituras da operação", () => {
  const dayUrl = `https://x.supabase.co/rest/v1/ops_assignments?select=*&work_date=eq.2026-10-12`;

  it("o dia (ops_assignments) fica disponível sem rede, só para a mesma conta", async () => {
    const sw = loadSW(network);
    await sw.fetchEvent(dayUrl, { token: jwt("user-a") });
    online = false;
    const mine = await sw.fetchEvent(dayUrl, { token: jwt("user-a") });
    expect(mine!.status).toBe(200);
    expect(await mine!.json()).toEqual([{ id: "a1" }]);
    const other = await sw.fetchEvent(dayUrl, { token: jwt("user-b") });
    expect(other!.status).toBe(503);
    expect((await other!.json()).code).toBe("BWILD_OFFLINE");
  });

  it("logout apaga o cache da API", async () => {
    const sw = loadSW(network);
    await sw.fetchEvent(dayUrl, { token: jwt("user-a") });
    await sw.dispatch("message", { data: { type: "bwild-clear-api-cache" } });
    expect(await sw.caches.keys()).not.toContain("bwild-api-cache-v4");
  });
});
