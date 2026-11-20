import { mkdirSync } from "node:fs";
import { createAppleVerifier } from "./apple";
import { createApp, hashPassword } from "./app";
import { loadConfig } from "./config";
import { seedDemoAccount } from "./demo";
import { createHeadscaleClient } from "./headscale";
import { Store } from "./store";

const config = loadConfig();
mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
const store = new Store(config.dbPath);

const demo = await seedDemoAccount(store, config.demoEmail, config.demoPassword);
if (demo !== "skipped") console.log(`demo account ${demo}: ${config.demoEmail}`);

const app = createApp({
  config,
  store,
  headscale: createHeadscaleClient(config.headscaleUrl, config.headscaleApiKey),
  apple: createAppleVerifier({ audiences: config.appleAudiences, jwksUrl: config.appleJwksUrl }),
  dummyPasswordHash: await hashPassword(crypto.randomUUID()),
});

const prune = setInterval(() => store.pruneSessions(Date.now()), 60 * 60 * 1000);

const server = Bun.serve({ hostname: config.host, port: config.port, fetch: app.fetch });
console.log(`tesseract account service listening on http://${config.host}:${server.port}`);

function shutdown(): void {
  clearInterval(prune);
  void server.stop().then(() => {
    store.close();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
