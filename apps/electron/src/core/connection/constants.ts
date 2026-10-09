export const DISCOVERY = {
  project: "tesseract",
  service: "sandbox",
  controllerPort: 7700,
  execUser: "dev",
  binary: "tesseract-controller",
  dockerTimeoutMs: 15_000,
  healthTimeoutMs: 2_000,
  startupTimeoutMs: 2_500,
  remoteTimeoutMs: 8_000,
  protocolVersion: 1,
} as const;

export const DISCOVERY_ENV = {
  project: "TESSERACT_COMPOSE_PROJECT",
  hostPort: "TESSERACT_CONTROLLER_HOST_PORT",
  bindAddr: "TESSERACT_BIND_ADDR",
  disabled: "TESSERACT_DISABLE_DISCOVERY",
} as const;

export const CONTAINER_CLIS = ["docker", "podman"] as const;

export const WILDCARD_BINDS: readonly string[] = ["", "0.0.0.0", "::", "[::]"];
export const LOOPBACK_HOST = "127.0.0.1";
export const HEALTH_PATH = "/v1/health";
export const PAIR_ARGS = ["pair", "--json"] as const;

export const SEALED_TOKEN_KEY = "tokenSealed";
export const TOKEN_KEY = "token";
export const SANDBOX_STACK_KEY = "sandboxStack";
export const PROJECT_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
