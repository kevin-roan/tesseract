import { defineSocketFixtures } from "../types";
import { conversationDetail, runningEvents } from "./data";

const STREAM_PATH = /^\/v1\/agent\/runs\/([^/]+)\/stream$/;

export default defineSocketFixtures([
  {
    path: STREAM_PATH,
    frames: (url) => {
      const id = decodeURIComponent(STREAM_PATH.exec(url.pathname)?.[1] ?? "");
      const detail = conversationDetail(id);
      if (!detail) return [];
      const { events, ...run } = detail;
      const replay = run.state === "running" ? runningEvents : events;
      return [{ type: "run", run }, ...replay.map((event) => ({ type: "event", event }))];
    },
  },
]);
