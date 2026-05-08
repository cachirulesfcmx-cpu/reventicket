import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm } from "fs/promises";

async function buildAll() {
  await rm("dist", { recursive: true, force: true });
  console.log("Building client...");
  await viteBuild();
  console.log("Building server...");
  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: { "process.env.NODE_ENV": '"production"' },
    external: ["whatsapp-web.js","puppeteer","lightningcss","esbuild","tsx","vite","@babel/core","@babel/preset-typescript","pg-native","fsevents","cpu-features","ssh2"],
    minify: false,
    logLevel: "info",
  });
  console.log("Done!");
}
buildAll().catch((err) => { console.error(err); process.exit(1); });
