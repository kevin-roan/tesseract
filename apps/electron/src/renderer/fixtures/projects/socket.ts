import { wsPaths } from "@tesseract/protocol";
import { defineSocketFixtures } from "../types";
import { CLONE_PROCESS_ID, cloneLogFrames } from "./data";

export default defineSocketFixtures([{ path: wsPaths.processLogStream(CLONE_PROCESS_ID), frames: cloneLogFrames }]);
