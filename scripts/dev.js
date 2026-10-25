const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const children = new Set();
let stopping = false;

function get(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () =>
        resolve({
          status: response.statusCode,
          contentType: response.headers["content-type"] || "",
          body: Buffer.concat(chunks).toString("utf8"),
        }),
      );
    });
    request.setTimeout(1500, () => request.destroy(new Error("Request timed out")));
    request.on("error", reject);
  });
}

async function isAfriScoreApiRunning() {
  try {
    const response = await get("http://127.0.0.1:4000/v1/health");
    return (
      response.status === 200 &&
      JSON.parse(response.body).service === "afriscore"
    );
  } catch {
    return false;
  }
}

async function findWebsitePort() {
  for (let port = 5175; port < 5200; port += 1) {
    try {
      const response = await get(`http://127.0.0.1:${port}/`);
      if (
        response.status === 200 &&
        response.contentType.includes("text/html") &&
        response.body.includes("/@vite/client") &&
        response.body.includes("/src/main.tsx")
      ) {
        return port;
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

function isPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") resolve(false);
      else reject(error);
    });
    server.listen(port, "127.0.0.1", () => {
      server.close((error) => (error ? reject(error) : resolve(true)));
    });
  });
}

function lanAddresses() {
  return [...new Set(
    Object.values(os.networkInterfaces())
      .flatMap((addresses) => addresses || [])
      .filter((address) => address.family === "IPv4" && !address.internal)
      .map((address) => address.address),
  )];
}

function printPhoneUrls(port, alreadyRunning) {
  console.log(
    alreadyRunning
      ? `Website already running on port ${port}.`
      : "Phone-ready website addresses:",
  );
  for (const address of lanAddresses()) {
    console.log(`  http://${address}:${port}/`);
  }
}

function startChild(name, args, env = process.env) {
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });
  children.add(child);

  child.once("error", (error) => {
    console.error(`${name} failed to start: ${error.message}`);
    stop(1);
  });
  child.once("exit", (code, signal) => {
    children.delete(child);
    if (!stopping) {
      if (code !== 0) {
        console.error(`${name} exited unexpectedly${signal ? ` (${signal})` : ` with code ${code}`}.`);
        stop(code || 1);
      } else if (children.size === 0) {
        stop(0);
      }
    }
  });
  return child;
}

function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) child.kill();
}

async function main() {
  if (await isAfriScoreApiRunning()) {
    console.log("AfriScore API is already running on port 4000.");
  } else if (await isPortAvailable(4000)) {
    console.log("Starting AfriScore API...");
    startChild(
      "API",
      [path.join("node_modules", "ts-node", "dist", "bin.js"), "src/index.ts"],
      { ...process.env, LOG_LEVEL: "error" },
    );
  } else {
    throw new Error(
      "Port 4000 is in use by another app. Stop it, then run npm run dev again.",
    );
  }

  const websitePort = await findWebsitePort();
  if (websitePort) {
    printPhoneUrls(websitePort, true);
  } else {
    console.log("Starting the website...");
    startChild("Website", [
      path.join("website", "node_modules", "vite", "bin", "vite.js"),
      "--config",
      path.join("website", "vite.config.ts"),
      "--configLoader",
      "runner",
      "--port",
      "5175",
      "website",
    ]);
  }
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  stop(1);
});
