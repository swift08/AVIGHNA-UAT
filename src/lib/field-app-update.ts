import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { isFieldApp } from "./field-app";

export type FieldAppVersionInfo = {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  message?: string;
};

export type FieldAppUpdateStatus = {
  available: boolean;
  currentBuild: number;
  remote: FieldAppVersionInfo | null;
};

type ApkInstallerPlugin = {
  downloadAndInstall(options: { url: string }): Promise<void>;
};

const ApkInstaller = registerPlugin<ApkInstallerPlugin>("ApkInstaller");

export const FIELD_APP_VERSION_PATH = "/field-app-version.json";

export function isNewerFieldAppVersion(
  currentBuild: number,
  remoteVersionCode: number,
): boolean {
  return Number.isFinite(currentBuild) && Number.isFinite(remoteVersionCode) && remoteVersionCode > currentBuild;
}

export async function fetchFieldAppVersion(
  baseUrl = typeof window !== "undefined" ? window.location.origin : "",
): Promise<FieldAppVersionInfo | null> {
  try {
    const res = await fetch(`${baseUrl}${FIELD_APP_VERSION_PATH}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<FieldAppVersionInfo>;
    const versionCode = Number(data.versionCode);
    const apkUrl = typeof data.apkUrl === "string" ? data.apkUrl.trim() : "";
    if (!Number.isFinite(versionCode) || !apkUrl) return null;
    return {
      versionCode,
      versionName: String(data.versionName || versionCode),
      apkUrl,
      message: typeof data.message === "string" ? data.message : undefined,
    };
  } catch {
    return null;
  }
}

export async function getInstalledFieldAppBuild(): Promise<number> {
  if (!Capacitor.isNativePlatform()) return Number.POSITIVE_INFINITY;
  try {
    const info = await App.getInfo();
    const build = Number(info.build);
    return Number.isFinite(build) ? build : 0;
  } catch {
    return 0;
  }
}

export async function checkFieldAppUpdate(): Promise<FieldAppUpdateStatus> {
  if (!isFieldApp() || !Capacitor.isNativePlatform()) {
    return { available: false, currentBuild: 0, remote: null };
  }
  const [currentBuild, remote] = await Promise.all([
    getInstalledFieldAppBuild(),
    fetchFieldAppVersion(),
  ]);
  if (!remote || !isNewerFieldAppVersion(currentBuild, remote.versionCode)) {
    return { available: false, currentBuild, remote };
  }
  return { available: true, currentBuild, remote };
}

/** Downloads APK and opens the system installer (native). Falls back to opening the URL. */
export async function installFieldAppUpdate(apkUrl: string): Promise<void> {
  if (!apkUrl) throw new Error("Missing download URL");
  if (Capacitor.isNativePlatform()) {
    try {
      await ApkInstaller.downloadAndInstall({ url: apkUrl });
      return;
    } catch {
      // ponytail: plugin missing on older APKs — open URL so download still works
    }
  }
  window.open(apkUrl, "_blank", "noopener,noreferrer");
}
