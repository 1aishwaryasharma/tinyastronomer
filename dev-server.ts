// A local stand-in for Cloudflare's static-asset serving.
//
// The site's canonical URLs are extensionless (`/seasons`, not `/seasons.html`),
// which a plain static file server cannot resolve — every cross-page link 404s.
// This server reproduces the production request pipeline in the same order
// Cloudflare applies it, reading the same config files, so a link that works
// here works on tinyastronomer.com and vice versa:
//
//   1. public/_redirects       — explicit permanent redirects
//   2. html_handling           — from wrangler.jsonc: "drop-trailing-slash"
//   3. static asset lookup     — public/
//   4. not_found_handling      — from wrangler.jsonc: "none" (a real 404)
//
// public/_headers is applied to every response too, so a Content-Security-Policy
// mistake surfaces locally instead of in production.
//
//   bun dev-server.ts [port]     (default 8765)

import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./public", import.meta.url));
const port = Number(process.argv[2] ?? process.env.PORT ?? 8765);

const wrangler = JSON.parse(
  readFileSync(fileURLToPath(new URL("./wrangler.jsonc", import.meta.url)), "utf8"),
);
const htmlHandling: string = wrangler.assets?.html_handling ?? "auto-trailing-slash";
const notFoundHandling: string = wrangler.assets?.not_found_handling ?? "none";

const readIfPresent = (name: string) => {
  try {
    return readFileSync(`${root}/${name}`, "utf8");
  } catch {
    return "";
  }
};

// `from to [status]`, one rule per line, `#` comments ignored.
const redirects = readIfPresent("_redirects")
  .split("\n")
  .map((line) => line.replace(/#.*$/, "").trim())
  .filter(Boolean)
  .map((line) => {
    const [from, to, status] = line.split(/\s+/);
    return { from, to, status: Number(status ?? 302) };
  });

// Blocks of `/pattern` at column 0 followed by indented `Name: value` lines.
const headerRules: { pattern: string; headers: [string, string][] }[] = [];
for (const line of readIfPresent("_headers").split("\n")) {
  if (!line.trim() || line.trimStart().startsWith("#")) continue;
  if (!/^\s/.test(line)) {
    headerRules.push({ pattern: line.trim(), headers: [] });
    continue;
  }
  const separator = line.indexOf(":");
  if (separator === -1 || headerRules.length === 0) continue;
  headerRules[headerRules.length - 1].headers.push([
    line.slice(0, separator).trim(),
    line.slice(separator + 1).trim(),
  ]);
}

// This process is HTTP-only. Production _headers still sends
// upgrade-insecure-requests; Safari would honor it here and then fail
// same-origin navigations like /seasons because nothing listens on 443.
for (const rule of headerRules) {
  for (const header of rule.headers) {
    if (header[0] !== 'Content-Security-Policy') continue;
    header[1] = header[1].replace(/;?\s*upgrade-insecure-requests/g, '').trim();
  }
}

const headersFor = (pathname: string) => {
  const headers = new Headers();
  for (const rule of headerRules) {
    const matches = rule.pattern.endsWith("/*")
      ? pathname.startsWith(rule.pattern.slice(0, -1))
      : rule.pattern === pathname;
    if (matches) for (const [name, value] of rule.headers) headers.set(name, value);
  }
  return headers;
};

const contentTypes: Record<string, string> = {
  css: "text/css; charset=utf-8",
  glb: "model/gltf-binary",
  html: "text/html; charset=utf-8",
  jpg: "image/jpeg",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  png: "image/png",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
};

// Cloudflare treats these as configuration and never serves them as assets.
const configFiles = new Set(["/_headers", "/_redirects", "/_routes.json", "/_worker.js"]);

const fileAt = (relativePath: string) => {
  // Reject traversal before touching the filesystem.
  const resolved = decodeURIComponent(new URL(`.${relativePath}`, `file://${root}/`).pathname);
  if (!resolved.startsWith(`${root}/`)) return null;
  if (configFiles.has(resolved.slice(root.length))) return null;
  try {
    return statSync(resolved).isFile() ? resolved : null;
  } catch {
    return null;
  }
};

const redirect = (location: string, status: number, pathname: string) => {
  const headers = headersFor(pathname);
  headers.set("Location", location);
  return new Response(null, { status, headers });
};

const server = Bun.serve({
  port,
  fetch(request) {
    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname);

    // 1. _redirects
    const rule = redirects.find((candidate) => candidate.from === pathname);
    if (rule) return redirect(rule.to + url.search, rule.status, pathname);

    // 2. html_handling. Cloudflare uses 308 for its own normalisation, which
    //    preserves the method and, like a 301, is permanent.
    if (htmlHandling !== "none") {
      const asHtml = pathname.replace(/\/$/, "");
      if (pathname.endsWith(".html") && fileAt(pathname)) {
        const extensionless = pathname === "/index.html" ? "/" : pathname.slice(0, -".html".length);
        return redirect(extensionless + url.search, 308, pathname);
      }
      if (
        htmlHandling === "drop-trailing-slash" &&
        pathname !== "/" &&
        pathname.endsWith("/") &&
        (fileAt(`${asHtml}.html`) || fileAt(`${asHtml}/index.html`))
      ) {
        return redirect(asHtml + url.search, 308, pathname);
      }
    }

    // 3. static assets, with the extensionless → .html rewrite
    const candidates =
      pathname === "/"
        ? ["/index.html"]
        : [pathname, `${pathname}.html`, `${pathname.replace(/\/$/, "")}/index.html`];
    for (const candidate of candidates) {
      const resolved = fileAt(candidate);
      if (!resolved) continue;
      const headers = headersFor(pathname);
      const extension = resolved.split(".").pop()?.toLowerCase() ?? "";
      headers.set("Content-Type", contentTypes[extension] ?? "application/octet-stream");
      headers.set("Cache-Control", "no-store");
      return new Response(Bun.file(resolved), { headers });
    }

    // 4. not_found_handling
    if (notFoundHandling === "single-page-application" && fileAt("/index.html")) {
      const headers = headersFor(pathname);
      headers.set("Content-Type", contentTypes.html);
      return new Response(Bun.file(`${root}/index.html`), { headers });
    }
    return new Response("Not found\n", { status: 404, headers: headersFor(pathname) });
  },
});

console.log(`tinyastronomer → http://localhost:${server.port}`);
console.log(`  html_handling: ${htmlHandling} · not_found_handling: ${notFoundHandling}`);
console.log(`  ${redirects.length} redirect rule(s), ${headerRules.length} header block(s)`);
