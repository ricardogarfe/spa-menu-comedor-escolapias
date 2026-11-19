const optionalTextFields = ["holiday_description", "dinner_recommendation", "recommended_dinner"];

export function parseMonth(rows, month, aliases = new Map()) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Expected a non-empty array of menus.");
  }

  const seen = new Set();
  const menus = rows.map((row, index) => {
    const entry = `Entry ${index + 1}`;
    if (!row || typeof row !== "object") throw new Error(`${entry}: invalid menu.`);

    const { menu_id, date, menu_type, items, is_holiday } = row;
    const day = new Date(`${date}T00:00:00Z`);
    if (typeof date !== "string" || !date.startsWith(`${month}-`) ||
        !Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) {
      throw new Error(`${entry}: invalid date for ${month}.`);
    }
    if (typeof menu_type !== "string" || !/^[a-z][a-z0-9_]*$/.test(menu_type)) {
      throw new Error(`${entry}: invalid menu_type.`);
    }
    if (!Array.isArray(items) || !items.every((item) => typeof item === "string") ||
        typeof is_holiday !== "boolean") {
      throw new Error(`${entry}: items must be an array of strings and is_holiday must be a boolean.`);
    }
    if (menu_id !== undefined && typeof menu_id !== "string") {
      throw new Error(`${entry}: invalid menu_id.`);
    }

    const type = aliases.get(menu_type) ?? menu_type;
    const key = `${date}/${type}`;
    if (seen.has(key)) throw new Error(`${entry}: duplicate menu (${key}).`);
    seen.add(key);

    const menu = { ...(menu_id === undefined ? {} : { menu_id }), date, menu_type: type, items, is_holiday };
    for (const field of optionalTextFields) {
      const value = row[field];
      if (value === undefined) continue;
      if (value !== null && typeof value !== "string") throw new Error(`${entry}: invalid ${field}.`);
      menu[field] = value;
    }
    return menu;
  });

  return menus.sort((a, b) => a.date.localeCompare(b.date) || a.menu_type.localeCompare(b.menu_type));
}

export function buildCatalog(months) {
  const orderedMonths = [...months].sort((a, b) => a.key.localeCompare(b.key));
  const menus = orderedMonths.flatMap((month) => month.menus);
  const menusByType = Object.groupBy(menus, (menu) => menu.menu_type);
  const menuTypes = Object.keys(menusByType).sort();

  return {
    version: 1,
    range: { first: menus[0].date, last: menus.at(-1).date },
    menu_types: menuTypes,
    dates_by_type: Object.fromEntries(menuTypes.map((type) => [
      type, menusByType[type].map((menu) => menu.date),
    ])),
    service_dates_by_type: Object.fromEntries(menuTypes.map((type) => [
      type, menusByType[type].filter((menu) => !menu.is_holiday).map((menu) => menu.date),
    ])),
    months: orderedMonths.map(({ key, file, menus }) => ({
      key,
      file,
      types: [...new Set(menus.map((menu) => menu.menu_type))].sort(),
      count: menus.length,
    })),
  };
}
