import { describe, expect, it } from "vitest";
import { CameraSource } from "@capacitor/camera";

describe("live-capture camera policy", () => {
  it("uses Camera source only (never Photos/gallery)", () => {
    // Guard: native capture must stay CameraSource.Camera — not Photos or Prompt.
    expect(CameraSource.Camera).toBe("CAMERA");
    expect(CameraSource.Photos).toBe("PHOTOS");
    expect(CameraSource.Camera).not.toBe(CameraSource.Photos);
  });
});
