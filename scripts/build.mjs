import { access, cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const entry of ["index.html", "src", "runtime-config.js"]) {
  await cp(resolve(root, entry), resolve(dist, entry), { recursive: true });
}

try {
  await access(resolve(root, "public"));
  await cp(resolve(root, "public"), resolve(dist, "public"), { recursive: true });
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

console.log("Готово: папка dist собрана. Её можно публиковать на статическом хостинге.");
