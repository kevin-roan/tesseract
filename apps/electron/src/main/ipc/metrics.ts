import { cacheDir } from "../../core/paths";
import { loadMetrics, saveMetrics } from "../../core/metrics";
import { mainContext } from "../context";
import { defineService } from "./_framework/define";

const nowSeconds = () => Date.now() / 1000;

export default defineService("metrics", {
  load: () => loadMetrics(cacheDir(mainContext().paths), nowSeconds()),
  save: (_context, cache) => saveMetrics(cacheDir(mainContext().paths), cache, nowSeconds()),
});
