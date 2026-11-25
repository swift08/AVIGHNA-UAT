import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import tsConfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(async ({ command }) => {
  const plugins = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      server: { entry: "server" },
    }),
    viteReact(),
  ];

  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    plugins.push(
      nitro({
        // Include Tesseract language model in the server bundle for hosted OCR.
        ...(process.env["VERCEL"] ? { preset: "vercel" as const } : {}),
        serverAssets: [
          {
            baseName: "tessdata",
            dir: "./tessdata",
          },
        ],
        // Ensure NFT / Vercel file tracing keeps the OCR model file.
        externals: {
          traceInclude: ["./tessdata/eng.traineddata"],
        },
      } as Record<string, unknown>),
    );
  }

  return {
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    server: {
      host: "::",
      port: 8080,
      watch: {
        ignored: [
          "**/.git/**",
          "**/node_modules/**",
          "**/.output/**",
          "**/.vercel/**",
          // Capacitor Android sync dirs can throw UNKNOWN scandir errors under OneDrive.
          "**/android/**",
          "**/ios/**",
        ],
      },
    },
    plugins,
  };
});
