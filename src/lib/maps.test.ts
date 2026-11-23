import { describe, expect, it } from "vitest";
import { mapsSearchUrl, parseMapCoords } from "./maps";

describe("maps", () => {
  it("parses valid GPS and rejects junk", () => {
    expect(parseMapCoords(12.9716, 77.5946)).toEqual({ lat: 12.9716, lng: 77.5946 });
    expect(parseMapCoords("12.97", "77.59")).toEqual({ lat: 12.97, lng: 77.59 });
    expect(parseMapCoords(12.97, null)).toBeNull();
    expect(parseMapCoords(null, 77.59)).toBeNull();
    expect(parseMapCoords(999, 77.59)).toBeNull();
  });

  it("builds a Google Maps search URL", () => {
    expect(mapsSearchUrl(12.97, 77.59)).toContain("query=12.97%2C77.59");
  });
});
