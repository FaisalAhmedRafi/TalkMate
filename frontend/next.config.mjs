import { fileURLToPath } from "node:url";

// Security headers for every page (NIST CSF 2.0 PR.PS, see docs/security.md).
// A new third-party host must be added here, or the browser blocks it.
const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const GOOGLE = "https://accounts.google.com"; // Google sign-in (Identity Services)
const dev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  // Next.js inlines its bootstrap scripts (no nonces yet, see TODO.md); dev mode also needs eval.
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} ${GOOGLE}/gsi/client`,
  `style-src 'self' 'unsafe-inline' ${GOOGLE}/gsi/style`,
  // API /media pictures, flagcdn.com flags, Pexels/Pixabay/Wikipedia photos, data: avatars
  `img-src 'self' data: blob: https: ${API}`,
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  `connect-src 'self' ${API} ${GOOGLE}/gsi/`,
  `frame-src ${GOOGLE}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The microphone is used by speech recognition (Call, Sentence, Word, chats); nothing else.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)" },
  // Google sign-in opens a popup that must be able to talk back to this window.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

/** @type {import("next").NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // The repo has no root package.json; pin the root so Next does not pick a lockfile above it.
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store" }, { key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
};

export default nextConfig;
