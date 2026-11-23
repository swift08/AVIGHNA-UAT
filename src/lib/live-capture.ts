import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";

export type LiveGps = { lat: number; lng: number; time: string };

function stamp(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function isNativeFieldCapture(): boolean {
  return Capacitor.isNativePlatform();
}

/** Ask OS for camera / mic / location once (Android install-time + runtime prompts). */
export async function requestFieldPermissions(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Geolocation.requestPermissions();
  } catch {
    /* user may deny; capture paths surface errors */
  }
  try {
    await Camera.requestPermissions({ permissions: ["camera"] });
  } catch {
    /* ignore */
  }
  // Mic: getUserMedia prompts on first record; declare RECORD_AUDIO in the manifest.
}

/** Live rear-camera only — never opens the gallery. */
export async function takeLivePhoto(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const photo = await Camera.getPhoto({
      quality: 80,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      correctOrientation: true,
      saveToGallery: false,
    });
    if (!photo.dataUrl) throw new Error("Camera returned no image. Try again.");
    return photo.dataUrl;
  }

  // Browser fallback: capture=environment prefers the camera over gallery.
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error("No photo taken."));
        return;
      }
      if (file.type && !file.type.startsWith("image/")) {
        reject(new Error("Take a live photo with the camera."));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read the photo."));
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

export async function captureLiveGps(): Promise<LiveGps> {
  if (Capacitor.isNativePlatform()) {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 12000,
    });
    return {
      lat: Number(pos.coords.latitude.toFixed(4)),
      lng: Number(pos.coords.longitude.toFixed(4)),
      time: stamp(),
    };
  }

  if (!navigator.geolocation) {
    throw new Error("This device cannot share location.");
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: Number(pos.coords.latitude.toFixed(4)),
          lng: Number(pos.coords.longitude.toFixed(4)),
          time: stamp(),
        }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Location permission was denied. Allow location access, then try again."
              : "Could not read GPS. Turn location on and try again.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  });
}
