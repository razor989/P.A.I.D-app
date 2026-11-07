import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { createNativeShell } from "./native-shell";
import type { NativeShell } from "./native-shell";

export { createNativeShell, CHECKPOINT_KEY } from "./native-shell";
export type {
  CheckpointStorePort,
  NativeHost,
  NativeShell,
} from "./native-shell";

/** The Android shell, or null in a browser, where the web composition is unchanged. */
export function detectNativeShell(): NativeShell | null {
  if (Capacitor.getPlatform() !== "android") return null;
  return createNativeShell({
    preferences: Preferences,
    addBackButtonListener: (handler) => App.addListener("backButton", handler),
    minimizeApp: () => App.minimizeApp(),
  });
}
