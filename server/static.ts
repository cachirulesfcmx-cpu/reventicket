import type { Express } from "express";
import path from "path";
import fs from "fs";

export function serveStatic(app: Express) {
  // En producción con Vercel, el frontend lo sirve Vercel, no el servidor
  if (process.env.NODE_ENV === "production" && process.env.SERVE_STATIC !== "true") {
    console.log("Modo API: el frontend lo sirve Vercel");
    return;
  }

  const distPath = path.resolve(process.cwd(), "dist/public");
  if (!fs.existsSync(distPath)) {
    console.log("Sin archivos estáticos, modo API puro");
    return;
  }

  const express = require("express");
  app.use(express.static(distPath));
  app.get("*", (_req: any, res: any) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
