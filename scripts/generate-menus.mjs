import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCatalog, parseMonth } from "./menus.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceDir = join(root, "parsed");
const dataDir = join(root, "data");
const sourcePattern = /^(\d{4})\/(0[1-9]|1[0-2])\/menu-\1-\2\.json$/;
const monthFormat = new Intl.DateTimeFormat("es-ES", { month: "long", timeZone: "UTC" });

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  if (existsSync(path) && readFileSync(path, "utf8") === content) return;

  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, content);
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function generateMenus() {
  const sources = existsSync(sourceDir)
    ? readdirSync(sourceDir, { recursive: true }).filter((file) => file.endsWith(".json")).sort()
    : [];
  if (sources.length === 0) {
    throw new Error("No source files found under parsed/YYYY/MM/menu-YYYY-MM.json.");
  }

  const aliases = new Map(Object.entries(readJson(new URL("./menu-type-aliases.json", import.meta.url))));
  const imported = new Map();
  for (const source of sources) {
    const match = source.split(sep).join("/").match(sourcePattern);
    if (!match) throw new Error(`Invalid source path: ${source}. Use YYYY/MM/menu-YYYY-MM.json.`);

    const [, year, month] = match;
    const key = `${year}-${month}`;
    const name = monthFormat.format(new Date(`${key}-01T00:00:00Z`));
    const file = `${year}/${name}.json`;
    try {
      const menus = parseMonth(readJson(join(sourceDir, source)), key, aliases);
      imported.set(key, { key, file, menus });
    } catch (error) {
      throw new Error(`parsed/${source}: ${error.message}`);
    }
  }

  const indexPath = join(dataDir, "index.json");
  const published = existsSync(indexPath) ? readJson(indexPath).months : [];
  const retained = published.filter(({ key }) => !imported.has(key)).map(({ key, file }) => ({
    key, file, menus: readJson(join(dataDir, file)),
  }));
  const catalog = buildCatalog([...retained, ...imported.values()]);

  for (const { file, menus } of imported.values()) writeJson(join(dataDir, file), menus);
  writeJson(indexPath, catalog);
  console.log(`Imported ${imported.size} months. The catalog contains ${catalog.months.length} months.`);
}

try {
  generateMenus();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
