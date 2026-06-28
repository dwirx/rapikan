import { $ } from "bun";
import fs from "node:fs";
import path from "node:path";

console.log("Building...");
await $`bun build ./index.ts --outfile=./dist/index.js --target=node`;

const distPath = path.resolve("./dist/index.js");
let content = fs.readFileSync(distPath, "utf8");
if (!content.startsWith("#!/usr/bin/env node")) {
  content = "#!/usr/bin/env node\n" + content;
}
// Normalize line endings to LF (\n) for cross-platform compatibility
content = content.replace(/\r\n/g, "\n");
fs.writeFileSync(distPath, content, "utf8");
console.log("Build complete with shebang and LF line endings!");
