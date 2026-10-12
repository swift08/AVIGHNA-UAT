import { describe, expect, it } from "vitest";
import { deliveryProofReady } from "@/lib/erp-service";

describe("delivery proof", () => {
  it("requires both a location and a photo", () => {
    expect(deliveryProofReady(null, ["photo"])).toBe(false);
    expect(deliveryProofReady({ lat: 12.97, lng: 77.59 }, [])).toBe(false);
    expect(deliveryProofReady({ lat: 12.97, lng: 77.59 }, ["data:image/jpeg;base64,abc"])).toBe(
      true,
    );
  });
});