import manifest from "../package.json" with { type: "json" };

export const CLI_VERSION: string = manifest.version;
