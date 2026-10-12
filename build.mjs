import { build } from "esbuild";
import { cp, mkdir } from "node:fs/promises";

await mkdir("dist/background", { recursive: true });

await build({
  entryPoints: ["src/background/index.ts"],
  outfile: "dist/background/index.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2020",
  sourcemap: true,
  logLevel: "info",
});

await build({
  entryPoints: ["src/popup.ts"],
  outfile: "dist/popup.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  sourcemap: true,
  logLevel: "info",
});

await cp("manifest.json", "dist/manifest.json");
await cp("popup.html", "dist/popup.html");
