import { join } from "node:path";
import { planNotarization, type NotarizeCredentials } from "../lib/notarize.ts";

export interface AfterSignContext {
  electronPlatformName: string;
  appOutDir: string;
  packager: { appInfo: { productFilename: string } };
}

type Notarize = (options: { appPath: string } & NotarizeCredentials) => Promise<void>;

const NOTARIZE_MODULE = "@electron/notarize";

async function loadNotarize(): Promise<Notarize> {
  const module = (await import(NOTARIZE_MODULE)) as { notarize: Notarize };
  return module.notarize;
}

export default async function afterSign(context: AfterSignContext, notarize: () => Promise<Notarize> = loadNotarize): Promise<string> {
  const plan = planNotarization(process.env, context.electronPlatformName);
  if (!plan.notarize) {
    console.log(`  • skipped notarization  reason=${plan.reason}`);
    return "skipped";
  }
  const appPath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log(`  • notarizing  app=${appPath} method=${plan.method}`);
  await (await notarize())({ appPath, ...plan.credentials });
  return appPath;
}
