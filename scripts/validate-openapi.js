const spec = require("../openapi.json");

if (!String(spec.openapi || "").startsWith("3.")) {
  throw new Error("openapi.json must declare an OpenAPI 3.x version");
}
if (!spec.info?.title || !spec.info?.version) {
  throw new Error("openapi.json must include info.title and info.version");
}
if (!spec.paths || Object.keys(spec.paths).length === 0) {
  throw new Error("openapi.json must document at least one path");
}

for (const [path, pathItem] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
    if (!operation.responses || Object.keys(operation.responses).length === 0) {
      throw new Error(`${method.toUpperCase()} ${path} has no responses`);
    }
  }
}

console.log(`Validated OpenAPI ${spec.openapi}: ${Object.keys(spec.paths).length} paths`);
