const fs = require("node:fs");
const path = require("node:path");

for (const name of fs.readdirSync(process.cwd())) {
  if (/^test-.*\.db(?:-shm|-wal)?$/.test(name)) {
    fs.rmSync(path.join(process.cwd(), name), { force: true });
  }
}
