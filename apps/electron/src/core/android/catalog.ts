import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AndroidHostSupport, SdkCatalog } from "../../shared/contracts/android";
import { IpcError } from "../../shared/ipc-types";
import {
  ANDROID_REPOSITORY_URL,
  ANDROID_SYSIMG_URL,
  CATALOG_CACHE_FILES,
  CATALOG_MAX_AGE_MS,
  CATALOG_META_SUFFIX,
  CATALOG_TIMEOUT_MS,
  CATALOG_URL_ENV,
  CATALOG_URL_PROTOCOLS,
  XML_SUFFIX,
} from "./constants";
import { ANDROID_LABELS } from "./labels";
import { buildCatalog, parseRepository } from "./repository";

export interface CatalogUrls {
  repository: string;
  systemImages: string;
}

export interface CatalogOptions {
  fetch?: typeof fetch;
  now?: () => number;
  urls?: CatalogUrls;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  onLog?(line: string): void;
}

function overrideUrl(env: Record<string, string | undefined>, name: string, fallback: string): string {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new IpcError("invalid_argument", ANDROID_LABELS.catalog.invalidOverride(name, raw));
  }
  if (!(CATALOG_URL_PROTOCOLS as readonly string[]).includes(url.protocol)) {
    throw new IpcError("invalid_argument", ANDROID_LABELS.catalog.invalidOverride(name, raw));
  }
  if (url.pathname.toLowerCase().endsWith(XML_SUFFIX)) return url.href;
  const file = fallback.slice(fallback.lastIndexOf("/") + 1);
  return new URL(file, url.href.endsWith("/") ? url.href : `${url.href}/`).href;
}

export function catalogUrls(env: Record<string, string | undefined>): CatalogUrls {
  return {
    repository: overrideUrl(env, CATALOG_URL_ENV.repository, ANDROID_REPOSITORY_URL),
    systemImages: overrideUrl(env, CATALOG_URL_ENV.systemImages, ANDROID_SYSIMG_URL),
  };
}

interface CacheMeta {
  url: string;
  etag: string | null;
  lastModified: string | null;
  fetchedAt: number;
}

interface CachedDocument {
  xml: string;
  fetchedAt: number;
}

async function readCache(file: string, url: string): Promise<{ xml: string; meta: CacheMeta } | null> {
  try {
    const [xml, metaText] = await Promise.all([readFile(file, "utf8"), readFile(`${file}${CATALOG_META_SUFFIX}`, "utf8")]);
    const meta = JSON.parse(metaText) as CacheMeta;
    return meta.url === url ? { xml, meta } : null;
  } catch {
    return null;
  }
}

async function writeAtomic(file: string, content: string): Promise<void> {
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, content);
  await rename(temp, file);
}

async function writeCache(file: string, xml: string | null, meta: CacheMeta): Promise<void> {
  if (xml !== null) await writeAtomic(file, xml);
  await writeAtomic(`${file}${CATALOG_META_SUFFIX}`, JSON.stringify(meta));
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return ANDROID_LABELS.catalog.timeout;
  if (error instanceof Error && error.cause instanceof Error) return `${error.message} (${error.cause.message})`;
  return error instanceof Error ? error.message : String(error);
}

export async function fetchRepositoryXml(url: string, cacheFile: string, refresh: boolean, options: CatalogOptions = {}): Promise<CachedDocument> {
  const now = options.now ?? Date.now;
  const fetcher = options.fetch ?? fetch;
  const cached = await readCache(cacheFile, url);
  if (cached && !refresh && now() - cached.meta.fetchedAt < CATALOG_MAX_AGE_MS) return { xml: cached.xml, fetchedAt: cached.meta.fetchedAt };
  const headers: Record<string, string> = {};
  if (cached?.meta.etag) headers["If-None-Match"] = cached.meta.etag;
  if (cached?.meta.lastModified) headers["If-Modified-Since"] = cached.meta.lastModified;
  try {
    const response = await fetcher(url, { headers, signal: AbortSignal.timeout(options.timeoutMs ?? CATALOG_TIMEOUT_MS) });
    if (response.status === 304 && cached) {
      const fetchedAt = now();
      await writeCache(cacheFile, null, { ...cached.meta, fetchedAt });
      return { xml: cached.xml, fetchedAt };
    }
    if (!response.ok) throw new Error(ANDROID_LABELS.catalog.http(response.status, url));
    const xml = await response.text();
    const fetchedAt = now();
    await writeCache(cacheFile, xml, {
      url,
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      fetchedAt,
    });
    return { xml, fetchedAt };
  } catch (error) {
    if (!cached) throw new Error(errorMessage(error));
    options.onLog?.(`${url}: ${errorMessage(error)}`);
    return { xml: cached.xml, fetchedAt: cached.meta.fetchedAt };
  }
}

export async function loadCatalog(
  cacheDir: string,
  support: AndroidHostSupport,
  refresh: boolean,
  options: CatalogOptions = {},
): Promise<SdkCatalog> {
  if (!support.supported) throw new IpcError("unavailable", support.reason);
  const urls = options.urls ?? catalogUrls(options.env ?? process.env);
  try {
    await mkdir(cacheDir, { recursive: true });
    const [repository, images] = await Promise.all([
      fetchRepositoryXml(urls.repository, join(cacheDir, CATALOG_CACHE_FILES.repository), refresh, options),
      fetchRepositoryXml(urls.systemImages, join(cacheDir, CATALOG_CACHE_FILES.systemImages), refresh, options),
    ]);
    const fetchedAt = new Date(Math.min(repository.fetchedAt, images.fetchedAt)).toISOString();
    return buildCatalog(
      parseRepository(repository.xml, urls.repository),
      parseRepository(images.xml, urls.systemImages),
      support,
      fetchedAt,
      ANDROID_LABELS.catalog.missing,
    );
  } catch (error) {
    throw new IpcError("unavailable", ANDROID_LABELS.catalog.failed(errorMessage(error)));
  }
}
