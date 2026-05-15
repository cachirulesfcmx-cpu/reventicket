import type { Request, Response, NextFunction } from "express";

const ALLOWED_ORIGINS: (string | RegExp)[] = [
  "http://localhost:5173",
  "http://localhost:3000",
  // Vercel preview URLs
  /^https:\/\/.*\.vercel\.app$/,
  // Dominios de producción
  "https://reventicket.vercel.app",
  "https://reventicket.com.mx",
  "https://www.reventicket.com.mx",
];

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin || "";

  const allowed = ALLOWED_ORIGINS.some((o) =>
    typeof o === "string" ? o === origin : o.test(origin)
  );

  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type,Authorization,X-CSRF-Token,X-Idempotency-Key"
    );
  }

  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }

  next();
}
