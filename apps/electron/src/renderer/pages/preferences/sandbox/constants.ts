export const SANDBOX_SETTINGS_KEYS = {
  docker: ["docker", "report"] as const,
  stack: ["sandbox", "stack"] as const,
  status: ["sandbox", "status"] as const,
  defaults: ["sandbox", "defaults"] as const,
  phase: ["sandbox", "phase"] as const,
};

export const BUILD_LOG_LIMIT = 200;

export const BYTES_PER_GB = 1024 ** 3;

export const RUNNING_STATE = "running";
