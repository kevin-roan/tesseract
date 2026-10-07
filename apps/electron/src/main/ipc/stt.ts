import { systemPreferences } from "electron";
import { microphoneAccess, requestMicrophoneAccess, type MicrophoneProbe } from "../../core/stt";
import { defineService } from "./_framework/define";

function probe(): MicrophoneProbe {
  return {
    platform: process.platform,
    status: () => systemPreferences.getMediaAccessStatus("microphone"),
    ask: () => systemPreferences.askForMediaAccess("microphone"),
  };
}

export default defineService("stt", {
  microphone: () => microphoneAccess(probe()),
  requestMicrophone: () => requestMicrophoneAccess(probe()),
});
