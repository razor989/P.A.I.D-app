import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The Android shell around the unchanged Vite build.
 * Keep the default `https://localhost` origin: changing `server.androidScheme`
 * or `server.hostname` after an install changes the WebView origin and loses
 * its browser storage.
 */
const config: CapacitorConfig = {
  appId: "com.paidplatform.app",
  appName: "P.A.I.D.",
  webDir: "dist",
  // The page canvas (--palette-canvas), so launch never flashes white.
  backgroundColor: "#fbf7ef",
};

export default config;
