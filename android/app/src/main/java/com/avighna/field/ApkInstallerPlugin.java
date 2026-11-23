package com.avighna.field;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String apkUrl = call.getString("url");
        if (apkUrl == null || apkUrl.isEmpty()) {
            call.reject("Missing url");
            return;
        }

        new Thread(() -> {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                        && !getContext().getPackageManager().canRequestPackageInstalls()) {
                    Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                    settings.setData(Uri.parse("package:" + getContext().getPackageName()));
                    settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(settings);
                    call.reject("Allow install from this app, then tap Download again.");
                    return;
                }

                File apk = downloadApk(apkUrl);
                getActivity().runOnUiThread(() -> {
                    try {
                        installApk(apk);
                        call.resolve();
                    } catch (Exception e) {
                        call.reject(e.getMessage() != null ? e.getMessage() : "Install failed");
                    }
                });
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "Download failed");
            }
        }).start();
    }

    private File downloadApk(String apkUrl) throws Exception {
        URL url = new URL(apkUrl);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setConnectTimeout(30000);
        conn.setReadTimeout(120000);
        conn.setInstanceFollowRedirects(true);
        conn.connect();

        int code = conn.getResponseCode();
        if (code >= 300 && code < 400) {
            String redirect = conn.getHeaderField("Location");
            conn.disconnect();
            if (redirect == null || redirect.isEmpty()) {
                throw new Exception("Download redirect failed");
            }
            return downloadApk(redirect);
        }
        if (code < 200 || code >= 300) {
            conn.disconnect();
            throw new Exception("Download failed (" + code + ")");
        }

        File out = new File(getContext().getCacheDir(), "avighna-field-update.apk");
        try (InputStream in = conn.getInputStream(); FileOutputStream fos = new FileOutputStream(out)) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) {
                fos.write(buf, 0, n);
            }
        } finally {
            conn.disconnect();
        }
        return out;
    }

    private void installApk(File apk) {
        Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                apk
        );
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getContext().startActivity(intent);
    }
}
