import "@testing-library/jest-dom/vitest";
import { SYSTEM_USERS } from "@/lib/auth-service";
import { setDemoActor } from "@/lib/security";

// Integration tests exercise erp-service with DEV demo auth (not production Auth).
const owner = SYSTEM_USERS.find((user) => user.role === "super_admin") ?? null;
setDemoActor(owner);

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
