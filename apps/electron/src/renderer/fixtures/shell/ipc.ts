import { defineIpcFixtures } from "../types";
import { installParityClock } from "./parity";

installParityClock();

export default defineIpcFixtures({});
