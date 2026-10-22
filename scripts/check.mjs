import { execFileSync, spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const failures = [];

async function walk(dir) {
  const items = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const item of items) {
    if (["dist", ".git", "node_modules"].includes(item.name)) continue;
    const full = join(dir, item.name);
    if (item.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

const files = await walk(root);

for (const file of files.filter((f) => [".js", ".mjs"].includes(extname(f)))) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    failures.push(`Синтаксис: ${file}\n${error.stderr?.toString() || error.message}`);
  }
}

for (const required of ["index.html", "src/app.js", "src/styles.css", "AGENTS.md", "CLAUDE.md", "PRODUCT.md"]) {
  if (!files.some((file) => file === join(root, required))) failures.push(`Нет обязательного файла: ${required}`);
}

try {
  execFileSync(process.execPath, [join(root, "scripts/store-smoke.mjs")], { stdio: "pipe" });
} catch (error) {
  failures.push(`Хранилище: ${error.stderr?.toString() || error.message}`);
}

const secretPatterns = [
  /service[_-]?role\s*[:=]\s*["'][A-Za-z0-9._-]{20,}/i,
  /sb_secret_[A-Za-z0-9_-]{12,}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /BEGIN (RSA|OPENSSH|EC) PRIVATE KEY/,
];

for (const file of files.filter((f) => !f.endsWith(".zip"))) {
  const content = await readFile(file, "utf8").catch(() => "");
  for (const pattern of secretPatterns) {
    if (pattern.test(content)) failures.push(`Похожее на секрет значение найдено в ${file}`);
  }
}

const port = 4187;
const child = spawn(process.execPath, [join(root, "scripts/dev.mjs")], {
  env: { ...process.env, PORT: String(port) },
  stdio: "ignore",
});

try {
  await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  const response = await fetch(`http://127.0.0.1:${port}`);
  const html = await response.text();
  if (!response.ok || !html.includes('id="app"')) failures.push("Smoke-test: стартовая страница не открылась.");
} catch (error) {
  failures.push(`Smoke-test: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  child.kill();
}

if (failures.length) {
  console.error("\nПроверка не пройдена:\n");
  for (const failure of failures) console.error(`— ${failure}\n`);
  process.exit(1);
}

console.log("\nПроверка пройдена:");
console.log("— синтаксис JavaScript");
console.log("— обязательные файлы");
console.log("— базовый поиск секретов");
console.log("— локальный CRUD и публичная Supabase-вставка");
console.log("— запуск локального сайта\n");
