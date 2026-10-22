import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const major = Number(process.versions.node.split(".")[0]);

console.log("\nAIRC Doctor\n");
console.log(`Папка проекта: ${projectRoot}`);
console.log(`Node.js: ${process.version} ${major >= 22 ? "✓" : "✗ нужен Node.js 22+; рекомендуем Node.js 24 LTS"}`);

try {
  const git = execFileSync("git", ["--version"], { encoding: "utf8" }).trim();
  console.log(`${git} ✓`);
} catch {
  console.log("Git: не найден. Для первого запуска не блокирует, но нужен перед сохранением версий.");
}

if (/[А-Яа-яЁё]/.test(projectRoot)) {
  console.log("Предупреждение: в пути есть кириллица. Некоторые внешние инструменты могут путаться.");
}

console.log("\nСледующие команды:");
console.log("1. npm run dev");
console.log("2. открой http://127.0.0.1:4173");
console.log("3. npm run check перед коммитом\n");
