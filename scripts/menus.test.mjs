import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseMonth } from "./menus.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const parsedDir = join(root, "parsed");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const sample = { date: "2028-02-29", menu_type: "base", items: ["Arroz"], is_holiday: false };

function testWorkspace(t) {
  const dir = mkdtempSync(join(tmpdir(), "school-menus-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "scripts"));
  for (const file of ["generate-menus.mjs", "menus.mjs", "menu-type-aliases.json"]) {
    cpSync(join(root, "scripts", file), join(dir, "scripts", file));
  }
  return dir;
}

function runGenerator(dir) {
  const result = spawnSync(process.execPath, [join(dir, "scripts/generate-menus.mjs")], {
    cwd: tmpdir(),
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  return result;
}

function writeSource(dir, month, content) {
  const [year, number] = month.split("-");
  const folder = join(dir, "parsed", year, number);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, `menu-${month}.json`), JSON.stringify(content));
}

test("sorts menus, applies explicit aliases and keeps only public fields", () => {
  const holiday = {
    ...sample, date: "2028-02-28", items: [], is_holiday: true,
    holiday_description: "Festivo", dinner_recommendation: null,
  };
  const source = {
    ...sample, menu_id: "menu-1", menu_type: "old_variant",
    recommended_dinner: "Sopa", source_note: "Private",
  };
  const aliases = new Map([["old_variant", "base"]]);

  assert.deepEqual(parseMonth([source, holiday], "2028-02", aliases), [
    holiday,
    { ...sample, menu_id: "menu-1", recommended_dinner: "Sopa" },
  ]);
  assert.equal(source.menu_type, "old_variant");
  assert.throws(() => parseMonth([sample, source], "2028-02", aliases), /duplicate menu/);
});

test("rejects invalid menu data", () => {
  assert.throws(() => parseMonth([], "2028-02"), /non-empty array/);
  for (const [field, value, error] of [
    ["date", "2028-02-30", /invalid date/],
    ["date", "2028-03-01", /invalid date/],
    ["menu_type", "Bad Type", /invalid menu_type/],
    ["items", [42], /array of strings/],
    ["is_holiday", "false", /must be a boolean/],
    ["recommended_dinner", [], /invalid recommended_dinner/],
  ]) {
    assert.throws(() => parseMonth([{ ...sample, [field]: value }], "2028-02"), error);
  }
});

test("updates a single month, retains published history and validates before writing", (t) => {
  const dir = testWorkspace(t);
  writeSource(dir, "2028-02", [sample]);
  let result = runGenerator(dir);
  assert.equal(result.status, 0, result.stderr);
  const february = join(dir, "data/2028/febrero.json");
  const original = readFileSync(february, "utf8");
  rmSync(join(dir, "parsed"), { recursive: true });

  const holiday = { date: "2028-03-02", menu_type: "base", items: [], is_holiday: true };
  writeSource(dir, "2028-03", [holiday]);
  result = runGenerator(dir);
  assert.equal(result.status, 0, result.stderr);

  const index = join(dir, "data/index.json");
  const catalog = readJson(index);
  assert.deepEqual(catalog, {
    version: 1,
    range: { first: sample.date, last: holiday.date },
    menu_types: ["base"],
    dates_by_type: { base: [sample.date, holiday.date] },
    service_dates_by_type: { base: [sample.date] },
    months: [
      { key: "2028-02", file: "2028/febrero.json", types: ["base"], count: 1 },
      { key: "2028-03", file: "2028/marzo.json", types: ["base"], count: 1 },
    ],
  });
  assert.equal(readFileSync(february, "utf8"), original);
  assert.deepEqual(readJson(join(dir, "data/2028/marzo.json")), [holiday]);

  writeSource(dir, "2028-02", [{ ...sample, items: ["Pasta"] }]);
  writeSource(dir, "2028-03", [holiday, holiday]);
  result = runGenerator(dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /menu-2028-03\.json.*duplicate menu/);
  assert.equal(readFileSync(february, "utf8"), original);
  assert.deepEqual(readJson(index), catalog);

  rmSync(join(dir, "parsed/2028/03"), { recursive: true });
  result = runGenerator(dir);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readJson(february), [{ ...sample, items: ["Pasta"] }]);
  assert.deepEqual(readJson(index), catalog);
});

const sourceFiles = existsSync(parsedDir)
  ? readdirSync(parsedDir, { recursive: true }).filter((file) => file.endsWith(".json"))
  : [];

test("regenerates the real source menus and matches the published JSON", {
  skip: sourceFiles.length === 0 && "Local parsed/ data is unavailable",
}, (t) => {
  const dir = testWorkspace(t);
  cpSync(parsedDir, join(dir, "parsed"), { recursive: true });
  const result = runGenerator(dir);
  assert.equal(result.status, 0, result.stderr);

  const actualIndex = join(dir, "data/index.json");
  const expectedIndex = join(root, "data/index.json");
  const actual = readJson(actualIndex);
  const expected = readJson(expectedIndex);
  assert.equal(actual.months.length, sourceFiles.length);
  for (const month of actual.months) {
    assert.deepEqual(month, expected.months.find(({ key }) => key === month.key));
    assert.equal(
      readFileSync(join(dir, "data", month.file), "utf8"),
      readFileSync(join(root, "data", month.file), "utf8"),
      month.file,
    );
  }
  if (actual.months.length === expected.months.length) {
    assert.equal(readFileSync(actualIndex, "utf8"), readFileSync(expectedIndex, "utf8"));
  }
});
