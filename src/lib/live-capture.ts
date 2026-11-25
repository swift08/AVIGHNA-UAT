import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

export type LiveGps = { lat: number; lng: number; time: string };

export type VisitCameraDraft = {
  savedAt: number;
  visitFirm: string;
  visitSelectedCustomer: string;
  visitPurpose: string;
  visitCustomPurpose: string;
  visitRequirement: string;
  visitLogDate: string;
  visitLogTime: string;
  gpsLocation: LiveGps | null;
  proofPhotos: string[];
  visitOrderProductId?: string;
  visitOrderQty?: string;
  visitOrderUnit?: string;
  visitOrderPrice?: string;
  visitOrderGstRate?: string;
  visitOrderIsInterstate?: boolean;
  visitOrderTransportMode?: "Logistics / Assigned Vehicle" | "Manufacturer Vehicle";
  visitOrderDispatchDetails?: string;
  visitOrderTerms?: string;
};

const VISIT_CAMERA_DRAFT_KEY = "avighna_visit_camera_draft";
const DRAFT_TTL_MS = 10 * 60 * 1000;

export function saveVisitCameraDraft(draft: Omit<VisitCameraDraft, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const payload: VisitCameraDraft = { ...draft, savedAt: Date.now() };
    window.localStorage.setItem(VISIT_CAMERA_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    /* ignore storage quota errors */
  }
}

export function clearVisitCameraDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(VISIT_CAMERA_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function readVisitCameraDraft(): VisitCameraDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(VISIT_CAMERA_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VisitCameraDraft;
    if (!parsed || typeof parsed.savedAt !== "number" || Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      window.localStorage.removeItem(VISIT_CAMERA_DRAFT_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function consumeVisitCameraDraft(): VisitCameraDraft | null {
  const draft = readVisitCameraDraft();
  if (draft) clearVisitCameraDraft();
  return draft;
}

function appendPhotoToVisitCameraDraft(dataUrl: string): boolean {
  const draft = readVisitCameraDraft();
  if (!draft) return false;
  if (!draft.proofPhotos.includes(dataUrl)) {
    draft.proofPhotos = [...draft.proofPhotos, dataUrl];
  }
  draft.savedAt = Date.now();
  try {
    window.localStorage.setItem(VISIT_CAMERA_DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

let cameraRestoreInitialized = false;

/**
 * On Android, launching the native camera can cause the OS to kill and recreate
 * the WebView Activity. Capacitor emits `appRestoredResult` with the photo when
 * the user taps Done; this listener saves it to the visit draft and returns to
 * `/field-visits` instead of leaving the user on the home page.
 */
export function initNativeCameraRestore(onReturnToFieldVisits: () => void): void {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return;
  if (cameraRestoreInitialized) return;
  cameraRestoreInitialized = true;

  void App.addListener("appRestoredResult", (event) => {
    if (event.pluginId !== "Camera" || !event.success) return;
    const data = event.data as { dataUrl?: string; base64String?: string; format?: string } | undefined;
    const dataUrl =
      data?.dataUrl ||
      (data?.base64String
        ? `data:image/${data.format || "jpeg"};base64,${data.base64String}`
        : undefined);
    if (dataUrl) {
      appendPhotoToVisitCameraDraft(dataUrl);
    }
    if (readVisitCameraDraft()) {
      onReturnToFieldVisits();
    }
  });
}

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
      quality: 65,
      width: 1280,
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
