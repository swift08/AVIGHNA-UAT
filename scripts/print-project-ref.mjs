import { readFileSync } from "fs";
const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1).replace(/^["']|["']$/g, "")];
    }),
);
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL || "";
const ref = url.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] || "";
console.log(ref);
