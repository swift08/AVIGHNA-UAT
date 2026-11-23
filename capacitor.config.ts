import type { CapacitorConfig } from "@capacitor/cli";

// ponytail: live WebView → hosted app (exact UI). Override with CAP_SERVER_URL for local USB.
const serverUrl =
  process.env["CAP_SERVER_URL"]?.replace(/\/$/, "") || "https://avighna-uat-six.vercel.app";
const useCleartext = serverUrl.startsWith("http://");

const config: CapacitorConfig = {
  appId: "com.avighna.field",
  appName: "Avighna Field",
  webDir: "www",
  server: {
    url: `${serverUrl}/?app=field`,
    cleartext: useCleartext,
  },
  android: {
    allowMixedContent: useCleartext,
  },
};

export default config;
