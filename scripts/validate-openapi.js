#!/usr/bin/env node
"use strict";

/**
 * OpenAPI contract drift checker.
 *
 * The spec is only useful as a contract if it is checked against the code
 * that actually serves the API. This script needs no build step: it scans
 * `src/app.ts` for Express mounts and `src/routes/*.ts` for
 * `router.<method>("<path>", ...)` declarations, normalises Express
 * `:param` segments to OpenAPI `{param}` segments, strips the `servers[0]`
 * path prefix (`/v1`), and compares the resulting operation set with
 * `openapi.json`.
 *
 * It also checks the parts of the spec that silently rot:
 *   - every documented operation has an operationId (unique) and responses
 *   - every security requirement names a scheme defined in
 *     components.securitySchemes
 *   - every `{param}` in a documented path is declared as a parameter
 *   - every local `$ref` resolves (no dangling component references)
 *
 * Exits non-zero and prints a missing/extra diff when the spec and the
 * mounted routes disagree. Exports its scanners so `src/__tests__/openapi.test.ts`
 * can assert the same invariant in the test suite.
 */

const fs = require("fs");
const path = require("path");

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "options", "head"];
const REPO_ROOT = path.join(__dirname, "..");

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") return null;
    throw err;
  }
}

function resolveSourceFile(fromFile, importSpecifier) {
  const base = path.resolve(path.dirname(fromFile), importSpecifier);
  for (const candidate of [base, `${base}.ts`, path.join(base, "index.ts")]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Normalise an Express route path (`/accounts/:accountId/sync`) or an
 *  OpenAPI path (`/accounts/{accountId}/sync`) to canonical OpenAPI form. */
function normalizePath(rawPath) {
  let p = String(rawPath).trim();
  p = p.replace(/\/:([A-Za-z0-9_]+)/g, "/{$1}");
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/\/{2,}/g, "/");
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return p || "/";
}

function joinPaths(prefix, child) {
  const left = prefix === "/" ? "" : prefix.replace(/\/+$/, "");
  const right = normalizePath(child);
  if (right === "/") return normalizePath(left || "/");
  return normalizePath(left + right);
}

/** `/v1` + `/health` -> `/health`. A spec path that already includes the
 *  server prefix is tolerated (and normalised away) so a mistake there is
 *  reported as a path mismatch only if the operation really is missing. */
function stripServerPrefix(routePath, serverPrefix) {
  if (!serverPrefix) return routePath;
  if (routePath === serverPrefix) return "/";
  if (routePath.startsWith(`${serverPrefix}/`)) return routePath.slice(serverPrefix.length);
  return routePath;
}

/**
 * Enumerate every route the Express app actually serves.
 * Returns a sorted array of `"METHOD /normalised/path"` strings.
 */
function collectCodeRoutes(repoRoot = REPO_ROOT) {
  const appPath = path.join(repoRoot, "src", "app.ts");
  const appSource = readText(appPath);
  if (appSource === null) throw new Error(`cannot read ${appPath}`);

  // import businessRoutes from "./routes/businesses"
  const importedRouters = new Map();
  const importRe = /import\s+([A-Za-z0-9_$]+)\s+from\s+["']([^"']+)["']/g;
  let match;
  while ((match = importRe.exec(appSource)) !== null) {
    const [, localName, specifier] = match;
    if (!specifier.startsWith(".")) continue;
    const resolved = resolveSourceFile(appPath, specifier);
    if (resolved) importedRouters.set(localName, resolved);
  }

  const routes = new Set();

  // Direct app-level routes: app.get("/v1/health", ...)
  const directRe = /\bapp\.(get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']/g;
  while ((match = directRe.exec(appSource)) !== null) {
    routes.add(`${match[1].toUpperCase()} ${normalizePath(match[2])}`);
  }

  // Mounted routers: app.use("/v1/businesses", businessRoutes)
  const mountRe = /\bapp\.use\(\s*["']([^"']+)["']\s*,\s*([A-Za-z0-9_$]+)\s*\)/g;
  let mountCount = 0;
  while ((match = mountRe.exec(appSource)) !== null) {
    const [, mountPrefix, routerName] = match;
    const routerFile = importedRouters.get(routerName);
    // app.use(requestContext) / app.use(express.json(...)) have no string
    // prefix and never match this regex; a string prefix with a non-router
    // second argument is also skipped here.
    if (!routerFile) continue;
    mountCount += 1;
    const routerSource = readText(routerFile);
    if (routerSource === null) throw new Error(`cannot read mounted router ${routerFile}`);

    const declarationRe = /\brouter\.(get|post|put|patch|delete)\s*\(\s*(["'`])([^"'`]+)\2/g;
    while ((match = declarationRe.exec(routerSource)) !== null) {
      const [, method, , declarationPath] = match;
      routes.add(`${method.toUpperCase()} ${joinPaths(mountPrefix, declarationPath)}`);
    }
  }

  if (mountCount === 0) {
    // Fail loudly rather than "validating" an empty route set if app.ts is
    // restructured (for example, routes registered some other way).
    throw new Error(
      `no mounted routers found in ${appPath}; the OpenAPI drift checker only understands app.use(prefix, router) mounts — update scripts/validate-openapi.js`
    );
  }

  return [...routes].sort();
}

/** Enumerate every `METHOD path` documented in openapi.json. */
function collectSpecRoutes(spec, serverPrefix = parseServerPrefix(spec)) {
  const routes = new Set();
  for (const [rawPath, pathItem] of Object.entries(spec.paths || {})) {
    if (!pathItem || typeof pathItem !== "object") continue;
    const normalised = stripServerPrefix(normalizePath(rawPath), serverPrefix);
    for (const method of HTTP_METHODS) {
      if (!pathItem[method]) continue;
      routes.add(`${method.toUpperCase()} ${normalised}`);
    }
  }
  return [...routes].sort();
}

function parseServerPrefix(spec) {
  const server = Array.isArray(spec.servers) && spec.servers.length > 0 ? spec.servers[0] : null;
  if (!server || typeof server.url !== "string") return "";
  try {
    const url = new URL(server.url);
    const prefix = url.pathname.replace(/\/+$/, "");
    return prefix === "/" || prefix === "" ? "" : prefix;
  } catch {
    // Relative server URLs ({url: "/v1"}) are legal OpenAPI; fall back to a
    // strict pathname read.
    const prefix = server.url.split("?")[0].replace(/\/+$/, "");
    return prefix.startsWith("/") ? prefix : "";
  }
}

function resolvePointer(root, pointer) {
  if (typeof pointer !== "string" || !pointer.startsWith("#/")) return undefined;
  let node = root;
  for (const rawToken of pointer.slice(2).split("/")) {
    const token = rawToken.replace(/~1/g, "/").replace(/~0/g, "~");
    if (node === null || typeof node !== "object" || !(token in node)) return undefined;
    node = node[token];
  }
  return node;
}

function collectRefs(node, refs = []) {
  if (Array.isArray(node)) {
    for (const item of node) collectRefs(item, refs);
  } else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "$ref" && typeof value === "string") refs.push(value);
      else collectRefs(value, refs);
    }
  }
  return refs;
}

function declaredParameterNames(spec, pathItem, operation) {
  const names = new Set();
  const add = (parameters) => {
    if (!Array.isArray(parameters)) return;
    for (const parameter of parameters) {
      const resolved =
        parameter && typeof parameter.$ref === "string"
          ? resolvePointer(spec, parameter.$ref)
          : parameter;
      if (resolved && typeof resolved.name === "string" && resolved.in === "path") names.add(resolved.name);
    }
  };
  add(pathItem && pathItem.parameters);
  add(operation && operation.parameters);
  return names;
}

function templateParameterNames(openapiPath) {
  return [...openapiPath.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
}

/**
 * Structural + operation-level lint that does not depend on the route diff.
 * Returns an array of human-readable problems (empty means clean).
 */
function collectSpecIssues(spec) {
  const issues = [];
  if (!String(spec.openapi || "").startsWith("3.")) {
    issues.push('spec.openapi must declare an OpenAPI 3.x version (e.g. "3.0.3")');
  }
  if (!spec.info || !spec.info.title || !spec.info.version) {
    issues.push("spec.info must include title and version");
  }
  if (!spec.paths || typeof spec.paths !== "object" || Object.keys(spec.paths).length === 0) {
    issues.push("spec.paths must document at least one path");
    return issues;
  }

  const securitySchemes = (spec.components && spec.components.securitySchemes) || {};
  const operationIds = new Map();

  for (const [rawPath, pathItem] of Object.entries(spec.paths)) {
    if (!pathItem || typeof pathItem !== "object") {
      issues.push(`${rawPath}: path item is not an object`);
      continue;
    }
    const openapiPath = normalizePath(rawPath);
    const templateParams = templateParameterNames(openapiPath);

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;
      const label = `${method.toUpperCase()} ${rawPath}`;

      if (typeof operation.operationId !== "string" || operation.operationId.trim() === "") {
        issues.push(`${label}: missing operationId`);
      } else if (operationIds.has(operation.operationId)) {
        issues.push(`${label}: duplicate operationId "${operation.operationId}" (also ${operationIds.get(operation.operationId)})`);
      } else {
        operationIds.set(operation.operationId, label);
      }

      if (!operation.responses || typeof operation.responses !== "object" || Object.keys(operation.responses).length === 0) {
        issues.push(`${label}: missing responses`);
      }

      for (const requirement of Array.isArray(operation.security) ? operation.security : []) {
        for (const schemeName of Object.keys(requirement || {})) {
          if (!securitySchemes[schemeName]) {
            issues.push(`${label}: security scheme "${schemeName}" is not defined in components.securitySchemes`);
          }
        }
      }

      const declared = declaredParameterNames(spec, pathItem, operation);
      for (const param of templateParams) {
        if (!declared.has(param)) {
          issues.push(`${label}: path parameter "{${param}}" is not declared in parameters (path item or operation)`);
        }
      }
    }
  }

  const seenRefs = new Set();
  for (const ref of collectRefs(spec)) {
    if (seenRefs.has(ref)) continue;
    seenRefs.add(ref);
    if (!ref.startsWith("#/")) continue; // external refs are out of scope here
    if (resolvePointer(spec, ref) === undefined) issues.push(`unresolved $ref "${ref}"`);
  }

  return issues;
}

function loadSpec(repoRoot = REPO_ROOT) {
  const specPath = path.join(repoRoot, "openapi.json");
  const source = readText(specPath);
  if (source === null) throw new Error(`cannot read ${specPath}`);
  try {
    return JSON.parse(source);
  } catch (err) {
    throw new Error(`openapi.json is not valid JSON: ${err.message}`);
  }
}

/**
 * Full report used by both the CLI and the test suite.
 * `ok` is true only when routes match exactly and there are no spec issues.
 */
function buildReport(repoRoot = REPO_ROOT) {
  const spec = loadSpec(repoRoot);
  const serverPrefix = parseServerPrefix(spec);
  // Spec paths are relative to servers[0]; strip that prefix from the Express
  // routes too so both sides compare `/health`, not `/v1/health`.
  const codeRoutes = [
    ...new Set(
      collectCodeRoutes(repoRoot).map((route) => {
        const separator = route.indexOf(" ");
        const method = route.slice(0, separator);
        const routePath = route.slice(separator + 1);
        return `${method} ${stripServerPrefix(routePath, serverPrefix)}`;
      })
    ),
  ].sort();
  const specRoutes = collectSpecRoutes(spec, serverPrefix);

  const codeSet = new Set(codeRoutes);
  const specSet = new Set(specRoutes);
  const missing = codeRoutes.filter((route) => !specSet.has(route));
  const extra = specRoutes.filter((route) => !codeSet.has(route));
  const issues = collectSpecIssues(spec);

  return {
    specVersion: spec.openapi,
    serverPrefix,
    codeRoutes,
    specRoutes,
    missing,
    extra,
    issues,
    ok: missing.length === 0 && extra.length === 0 && issues.length === 0,
  };
}

function printReport(report) {
  const prefix = report.serverPrefix || "";
  console.log(`OpenAPI drift check (${report.specVersion || "unknown version"}, server prefix "${prefix || "(none)"}")`);
  console.log(`  routes in src/app.ts + src/routes/*.ts: ${report.codeRoutes.length}`);
  console.log(`  operations in openapi.json:             ${report.specRoutes.length}`);

  if (report.missing.length > 0) {
    console.error("\nMISSING from openapi.json (served by Express, not documented):");
    for (const route of report.missing) console.error(`  - ${route}`);
  }
  if (report.extra.length > 0) {
    console.error("\nEXTRA in openapi.json (documented, not served by Express):");
    for (const route of report.extra) console.error(`  + ${route}`);
  }
  if (report.issues.length > 0) {
    console.error("\nSPEC ISSUES:");
    for (const issue of report.issues) console.error(`  ! ${issue}`);
  }

  if (report.ok) {
    console.log(`\nOK: openapi.json documents exactly the ${report.codeRoutes.length} mounted operations; no spec issues.`);
  } else {
    console.error(
      `\nFAIL: ${report.missing.length} missing, ${report.extra.length} extra, ${report.issues.length} spec issue(s).`
    );
  }
}

if (require.main === module) {
  try {
    const report = buildReport();
    printReport(report);
    if (!report.ok) process.exitCode = 1;
  } catch (err) {
    console.error(`validate-openapi: ${err && err.message ? err.message : err}`);
    process.exitCode = 1;
  }
}

module.exports = {
  REPO_ROOT,
  HTTP_METHODS,
  normalizePath,
  stripServerPrefix,
  parseServerPrefix,
  collectCodeRoutes,
  collectSpecRoutes,
  collectSpecIssues,
  loadSpec,
  buildReport,
  printReport,
};
