import { useEffect, useState } from "react";
import {
  checkFieldAppUpdate,
  installFieldAppUpdate,
  type FieldAppVersionInfo,
} from "@/lib/field-app-update";

export function FieldAppUpdateDialog() {
  const [remote, setRemote] = useState<FieldAppVersionInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    void checkFieldAppUpdate().then((status) => {
      if (!alive || !status.available || !status.remote) return;
      setRemote(status.remote);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!remote || dismissed) return null;

  const onDownload = async () => {
    setBusy(true);
    setError(null);
    try {
      await installFieldAppUpdate(remote.apkUrl);
    } catch {
      setError("Download failed. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <div className="field-update-overlay" role="dialog" aria-modal="true" aria-labelledby="field-update-title">
      <div className="field-update-card">
        <h2 id="field-update-title">New version is available</h2>
        <p>
          {remote.message || "A new version of Avighna Field is available."}
          {remote.versionName ? ` (v${remote.versionName})` : null}
        </p>
        {error ? (
          <p className="field-update-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="field-update-actions">
          <button type="button" className="field-update-later" onClick={() => setDismissed(true)} disabled={busy}>
            Later
          </button>
          <button type="button" className="field-update-download" onClick={() => void onDownload()} disabled={busy}>
            {busy ? "Downloading…" : "Download"}
          </button>
        </div>
      </div>
    </div>
  );
}
