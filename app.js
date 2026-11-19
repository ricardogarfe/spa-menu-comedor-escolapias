const state = { catalog: null, monthCache: new Map(), searchReadyPromise: null, allMenus: [], menus: [], byDate: new Map(), typesByDate: new Map(), months: [], selectedDate: null, visibleMonth: null, selectedType: "base", searchQuery: "", searchResults: [], searchPage: 1 };
const SEARCH_PAGE_SIZE = 6;
const SEARCH_HINT_TEXT = "Escribe al menos dos caracteres. Buscaremos en todos los tipos de menú.";

const TYPE_LABELS = {
  base: "Menú general",
  infantil: "Infantil",
  sin_lactosa: "Sin lactosa",
  celiaco: "Celíaco",
  celiaco_sin_legumbres: "Celíaco · sin legumbres",
  alergico_huevo: "Alergia al huevo",
  alergico_proteina_vaca_huevo: "Alergia a proteína de vaca y huevo",
  alergico_proteina_vaca_lactosa_soja: "Alergia a proteína de vaca, lactosa y soja"
};

const TYPE_ICONS = { base: "G", infantil: "I", sin_lactosa: "SL", celiaco: "C", celiaco_sin_legumbres: "CL", alergico_huevo: "H", alergico_proteina_vaca_huevo: "VH", alergico_proteina_vaca_lactosa_soja: "VLS" };

const $ = (selector) => document.querySelector(selector);
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const parseDate = (value) => new Date(`${value}T12:00:00`);
const monthKey = (date) => dateKey(date).slice(0, 7);
const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const formatMonth = (value) => new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(parseDate(`${value}-01`));
const formatLong = (value) => new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(parseDate(value));
const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

async function init() {
  try {
    const response = await fetch("./data/index.json");
    if (!response.ok) throw new Error("No se pudo cargar el índice de menús");
    state.catalog = await response.json();
    buildTypeOptions();
    renderDataRange();
    bindEvents();
    await changeMenuType("base");
  } catch (error) {
    $("#selected-date").textContent = "No hemos podido cargar el menú";
    $("#menu-content").innerHTML = '<p class="empty-menu">Prueba a recargar la página en unos instantes.</p>';
    $("#dinner-text").textContent = "La recomendación no está disponible.";
  }
}

async function ensureMonthLoaded(month) {
  if (state.monthCache.has(month)) return state.monthCache.get(month);
  const entry = state.catalog.months.find((item) => item.key === month);
  if (!entry) throw new Error(`No existe el mes ${month}`);
  const response = await fetch(`./data/${entry.file}`);
  if (!response.ok) throw new Error(`No se pudo cargar el mes ${month}`);
  const menus = await response.json();
  state.monthCache.set(month, menus);
  return menus;
}

function refreshLoadedData() {
  state.allMenus = [...state.monthCache.values()].flat().sort((a, b) => a.date.localeCompare(b.date));
  state.typesByDate = state.allMenus.reduce((dates, menu) => {
    if (menu.is_holiday) return dates;
    if (!dates.has(menu.date)) dates.set(menu.date, new Set());
    dates.get(menu.date).add(menu.menu_type);
    return dates;
  }, new Map());
  state.menus = state.allMenus.filter((item) => item.menu_type === state.selectedType);
  state.byDate = new Map(state.menus.map((item) => [item.date, item]));
}

function monthsForType(type) {
  return state.catalog.months.filter((month) => month.types.includes(type)).map((month) => month.key);
}

function sortTypes(types) {
  const preferredOrder = Object.keys(TYPE_LABELS);
  return [...types].sort((a, b) => {
    const aIndex = preferredOrder.indexOf(a);
    const bIndex = preferredOrder.indexOf(b);
    return (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex);
  });
}

function availableTypesForDate(date) {
  return sortTypes(state.typesByDate.get(date) || []);
}

function preferredTypeForDate(date) {
  const available = availableTypesForDate(date);
  if (available.includes(state.selectedType)) return state.selectedType;
  return available.includes("base") ? "base" : available[0];
}

async function prepareSearchData() {
  if (!state.searchReadyPromise) {
    state.searchReadyPromise = Promise.all(state.catalog.months.map((month) => ensureMonthLoaded(month.key)))
      .then(() => {
        refreshLoadedData();
        renderCalendar();
      })
      .catch((error) => {
        state.searchReadyPromise = null;
        throw error;
      });
  }
  return state.searchReadyPromise;
}

function buildTypeOptions() {
  const available = sortTypes(state.catalog.menu_types);
  $("#menu-legend").innerHTML = available.map((type) => `<span><i class="menu-type-icon type-${escapeHtml(type)}" aria-hidden="true">${escapeHtml(TYPE_ICONS[type] || "M")}</i>${escapeHtml(TYPE_LABELS[type] || capitalize(type.replaceAll("_", " ")))}</span>`).join("");
}

function renderAvailableTypeOptions() {
  const available = availableTypesForDate(state.selectedDate);
  $("#menu-type-select").innerHTML = available.map((type) => `<option value="${type}">${escapeHtml(TYPE_LABELS[type] || capitalize(type.replaceAll("_", " ")))}</option>`).join("");
  $("#menu-type-list").innerHTML = available.map((type) => {
    const label = TYPE_LABELS[type] || capitalize(type.replaceAll("_", " "));
    return `<button class="menu-type-option" type="button" role="option" data-type="${escapeHtml(type)}" aria-selected="false"><i class="menu-type-icon type-${escapeHtml(type)}" aria-hidden="true">${escapeHtml(TYPE_ICONS[type] || "M")}</i><span>${escapeHtml(label)}</span><span class="option-check" aria-hidden="true">✓</span></button>`;
  }).join("");
}

function renderDataRange() {
  const first = state.catalog.range.first;
  const last = state.catalog.range.last;
  if (!first || !last) return;
  const formatter = new Intl.DateTimeFormat("es-ES", { month: "short", year: "numeric" });
  const label = `${capitalize(formatter.format(parseDate(first)).replace(".", ""))} – ${capitalize(formatter.format(parseDate(last)).replace(".", ""))}`;
  $("#footer-range").textContent = label;
}

async function changeMenuType(type) {
  if (!type || (state.selectedDate && !availableTypesForDate(state.selectedDate).includes(type))) return;
  state.selectedType = type;
  state.months = state.catalog.months.map((month) => month.key);
  $("#menu-type-select").value = type;
  renderTypeIndicator(type);
  updateMenuTypeList(type);
  $("#search-input").value = "";
  closeSearch(false);
  if (!state.selectedDate) {
    await selectInitialDate();
    return;
  }
  refreshLoadedData();
  renderSelected();
  renderCalendar();
}

function renderTypeIndicator(type) {
  const indicator = $("#menu-type-indicator");
  const label = TYPE_LABELS[type] || capitalize(type.replaceAll("_", " "));
  indicator.className = `menu-type-icon type-${type}`;
  indicator.textContent = TYPE_ICONS[type] || "M";
  indicator.setAttribute("aria-label", label);
  $("#menu-type-value").textContent = label;
  $("#menu-type-button").setAttribute("aria-label", `Tipo de menú: ${label}`);
}

function updateMenuTypeList(type) {
  document.querySelectorAll(".menu-type-option").forEach((option) => {
    const selected = option.dataset.type === type;
    option.setAttribute("aria-selected", String(selected));
    option.classList.toggle("selected", selected);
  });
}

function setMenuTypeList(open, focusButton = false) {
  const button = $("#menu-type-button");
  const list = $("#menu-type-list");
  button.setAttribute("aria-expanded", String(open));
  list.hidden = !open;
  if (open) {
    const selected = list.querySelector('[aria-selected="true"]') || list.querySelector(".menu-type-option");
    selected?.focus();
  } else if (focusButton) {
    button.focus();
  }
}

function moveMenuTypeFocus(direction) {
  const options = [...document.querySelectorAll(".menu-type-option")];
  const current = options.indexOf(document.activeElement);
  const next = current < 0 ? 0 : (current + direction + options.length) % options.length;
  options[next]?.focus();
}

function buildMonthOptions() {
  const years = [...new Set(state.months.map((month) => month.slice(0, 4)))];
  $("#year-select").innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join("");
  $("#year-value").textContent = state.visibleMonth?.slice(0, 4) || years.at(-1) || "—";
  updateMonthOptions(state.visibleMonth?.slice(0, 4) || years.at(-1));
}

function updateMonthOptions(year) {
  const monthsForYear = state.months.filter((month) => month.startsWith(`${year}-`));
  $("#month-select").innerHTML = monthsForYear.map((month) => `<option value="${month}">${capitalize(new Intl.DateTimeFormat("es-ES", { month: "long" }).format(parseDate(`${month}-01`)))}</option>`).join("");
  const visibleForYear = monthsForYear.includes(state.visibleMonth) ? state.visibleMonth : monthsForYear[0];
  $("#month-value").textContent = visibleForYear ? capitalize(new Intl.DateTimeFormat("es-ES", { month: "long" }).format(parseDate(`${visibleForYear}-01`))) : "—";
}

function syncDateControls() {
  const year = state.visibleMonth.slice(0, 4);
  $("#year-select").value = year;
  $("#year-value").textContent = year;
  updateMonthOptions(year);
  $("#month-select").value = state.visibleMonth;
  $("#month-value").textContent = capitalize(new Intl.DateTimeFormat("es-ES", { month: "long" }).format(parseDate(`${state.visibleMonth}-01`)));
}

async function selectInitialDate() {
  const today = dateKey(new Date());
  const dates = state.catalog.service_dates_by_type[state.selectedType] || [];
  let selected = dates.includes(today) ? today : dates.find((date) => date > today);
  if (!selected) selected = dates.at(-1);
  if (!selected) return;
  state.visibleMonth = selected.slice(0, 7);
  await ensureMonthLoaded(state.visibleMonth);
  refreshLoadedData();
  state.months = state.catalog.months.map((month) => month.key);
  buildMonthOptions();
  selectDate(selected, false);
  if (!state.byDate.has(today)) showStatus(`No hay ${TYPE_LABELS[state.selectedType]?.toLowerCase() || "menú"} publicado para hoy. Te mostramos el día disponible más cercano.`);
  else $("#status-message").hidden = true;
}

function selectDate(value, scroll = true, requestedType = null) {
  if (!value) return;
  const available = availableTypesForDate(value);
  const type = requestedType && available.includes(requestedType) ? requestedType : preferredTypeForDate(value);
  if (!type) return;
  state.selectedType = type;
  refreshLoadedData();
  if (!state.byDate.has(value)) return;
  state.selectedDate = value;
  state.visibleMonth = value.slice(0, 7);
  renderAvailableTypeOptions();
  syncDateControls();
  $("#menu-type-select").value = type;
  renderTypeIndicator(type);
  updateMenuTypeList(type);
  renderSelected();
  renderCalendar();
  if (scroll) $("#day-card").scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderSelected() {
  const menu = state.byDate.get(state.selectedDate);
  const date = parseDate(menu.date);
  $("#badge-day").textContent = date.getDate();
  $("#badge-month").textContent = new Intl.DateTimeFormat("es-ES", { month: "short" }).format(date).replace(".", "").toUpperCase();
  $("#selected-date").textContent = capitalize(formatLong(menu.date));
  const pill = $("#service-pill");
  pill.textContent = menu.is_holiday ? "Sin comedor" : "Comedor";
  pill.classList.toggle("holiday", menu.is_holiday);
  $("#selected-kicker").textContent = menu.is_holiday ? "DÍA NO LECTIVO" : "MENÚ DEL DÍA";
  if (menu.is_holiday) {
    $("#menu-content").innerHTML = `<div class="empty-menu"><div class="holiday-title">${escapeHtml(menu.holiday_description || "Festivo")}</div><p>No hay servicio de comedor este día.</p></div>`;
  } else {
    $("#menu-content").innerHTML = menu.items.map((item, index) => `<div class="dish"><span class="dish-number">${String(index + 1).padStart(2, "0")}</span><p>${escapeHtml(item)}</p></div>`).join("");
  }
  const dinner = (menu.dinner_recommendation || menu.recommended_dinner || "").trim();
  $("#dinner-card").hidden = !dinner;
  $("#dinner-unavailable").hidden = Boolean(dinner);
  $("#spotlight").classList.toggle("no-dinner", !dinner);
  if (dinner) $("#dinner-text").textContent = dinner;
  updateSelectedNavigation();
}

function updateSelectedNavigation() {
  const dates = state.catalog.dates_by_type[state.selectedType] || [];
  const index = dates.indexOf(state.selectedDate);
  const previous = dates[index - 1];
  const next = dates[index + 1];
  const previousButton = $("#previous-menu");
  const nextButton = $("#next-menu");
  previousButton.disabled = !previous;
  nextButton.disabled = !next;
  previousButton.setAttribute("aria-label", previous ? `Menú anterior: ${formatLong(previous)}` : "No hay un menú anterior");
  nextButton.setAttribute("aria-label", next ? `Menú siguiente: ${formatLong(next)}` : "No hay un menú siguiente");
  $("#menu-position").textContent = `${index + 1} de ${dates.length}`;
}

async function moveSelectedMenu(direction) {
  const dates = state.catalog.dates_by_type[state.selectedType] || [];
  const index = dates.indexOf(state.selectedDate);
  const target = dates[index + direction];
  if (!target) return;
  await ensureMonthLoaded(target.slice(0, 7));
  refreshLoadedData();
  selectDate(target, false);
}

function renderCalendar() {
  const [year, month] = state.visibleMonth.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const days = new Date(year, month, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < leading; i++) cells.push('<span class="calendar-day outside"></span>');
  for (let day = 1; day <= days; day++) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const availableTypes = availableTypesForDate(key);
    const selectedType = preferredTypeForDate(key);
    const menu = selectedType ? state.allMenus.find((item) => item.date === key && item.menu_type === selectedType) : null;
    const selected = key === state.selectedDate;
    const today = key === dateKey(new Date());
    const classes = ["calendar-day", menu?.is_holiday ? "holiday" : "", selected ? "selected" : "", today ? "today" : ""].filter(Boolean).join(" ");
    const label = menu ? (menu.is_holiday ? menu.holiday_description || "Festivo" : menu.items.slice(0, 1).join("")) : "Sin datos";
    const typesLabel = availableTypes.length ? `. Tipos disponibles: ${availableTypes.map((type) => TYPE_LABELS[type] || capitalize(type.replaceAll("_", " "))).join(", ")}` : "";
    const typeDots = availableTypes.map((type) => `<i class="calendar-type-dot type-${escapeHtml(type)}"></i>`).join("");
    cells.push(`<button class="${classes}" type="button" role="gridcell" data-date="${key}" ${menu ? "" : "disabled"} aria-label="${day} de ${escapeHtml(formatMonth(state.visibleMonth))}: ${escapeHtml(label + typesLabel)}" aria-selected="${selected}"><span class="day-number">${day}</span>${menu ? `<span class="availability-dots" aria-hidden="true">${menu.is_holiday ? '<i class="calendar-type-dot holiday-dot"></i>' : typeDots}</span><small>${escapeHtml(label)}</small>` : ""}</button>`);
  }
  $("#calendar").innerHTML = cells.join("");
  $("#prev-month").disabled = state.months.indexOf(state.visibleMonth) <= 0;
  $("#next-month").disabled = state.months.indexOf(state.visibleMonth) >= state.months.length - 1;
}

async function moveMonth(direction) {
  const index = state.months.indexOf(state.visibleMonth);
  const next = state.months[index + direction];
  if (!next) return;
  await ensureMonthLoaded(next);
  refreshLoadedData();
  state.visibleMonth = next;
  syncDateControls();
  renderCalendar();
}

async function searchMenus(query, resetPage = true) {
  const cleanQuery = query.trim();
  const term = normalize(cleanQuery);
  state.searchQuery = cleanQuery;
  if (term.length < 2) {
    state.searchResults = [];
    state.searchPage = 1;
    $("#search-results").hidden = true;
    $("#search-hint").hidden = false;
    return;
  }
  $("#search-hint").textContent = "Preparando la búsqueda en todo el histórico…";
  $("#search-hint").hidden = false;
  try {
    await prepareSearchData();
  } catch {
    $("#search-hint").textContent = "No hemos podido completar la búsqueda. Inténtalo de nuevo.";
    return;
  }
  if (normalize(state.searchQuery) !== term) return;
  state.searchResults = state.allMenus.map((menu) => ({ menu, matches: (menu.items || []).filter((item) => normalize(item).includes(term)) })).filter((result) => result.matches.length);
  if (resetPage) state.searchPage = 1;
  renderSearchResults();
  $("#search-results").hidden = false;
  $("#search-hint").hidden = true;
}

function renderSearchResults() {
  const total = state.searchResults.length;
  const totalPages = Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE));
  state.searchPage = Math.min(state.searchPage, totalPages);
  const start = (state.searchPage - 1) * SEARCH_PAGE_SIZE;
  const pageResults = state.searchResults.slice(start, start + SEARCH_PAGE_SIZE);
  $("#results-title").textContent = `${total} ${total === 1 ? "menú encontrado" : "menús encontrados"} para “${state.searchQuery}”`;
  $("#result-list").innerHTML = total ? pageResults.map(({ menu, matches }) => {
    const typeLabel = TYPE_LABELS[menu.menu_type] || capitalize(menu.menu_type.replaceAll("_", " "));
    return `<button class="result" type="button" data-date="${menu.date}" data-type="${escapeHtml(menu.menu_type)}" aria-label="${escapeHtml(typeLabel)}. ${escapeHtml(capitalize(formatLong(menu.date)))}. ${escapeHtml(matches.join(". "))}"><span class="result-meta"><span class="result-date">${capitalize(formatLong(menu.date))}</span><span class="result-type"><i class="menu-type-icon type-${escapeHtml(menu.menu_type)}" role="img" aria-label="${escapeHtml(typeLabel)}">${escapeHtml(TYPE_ICONS[menu.menu_type] || "M")}</i>${escapeHtml(typeLabel)}</span></span><strong>${escapeHtml(matches.join(" · "))}</strong><span class="result-action">Ver menú completo →</span></button>`;
  }).join("") : '<p class="no-results"><strong>No encontramos ese plato.</strong><span>Prueba con otro término, como “arroz” o “pescado”.</span></p>';
  const pagination = $("#search-pagination");
  pagination.hidden = totalPages <= 1;
  $("#search-prev").disabled = state.searchPage === 1;
  $("#search-next").disabled = state.searchPage === totalPages;
  $("#search-page-status").textContent = `Página ${state.searchPage} de ${totalPages}`;
}

function changeSearchPage(direction) {
  state.searchPage += direction;
  renderSearchResults();
  $("#search-results").scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeSearch(focus = true) {
  state.searchQuery = "";
  state.searchResults = [];
  state.searchPage = 1;
  $("#search-input").value = "";
  $("#search-results").hidden = true;
  $("#search-hint").hidden = false;
  $("#search-hint").textContent = SEARCH_HINT_TEXT;
  const dialog = $("#search-dialog");
  if (dialog.open) dialog.close();
  if (focus) $("#search-open").focus();
}

async function openSearch() {
  const dialog = $("#search-dialog");
  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(() => $("#search-input").focus());
  if (!state.searchReadyPromise) $("#search-hint").textContent = "Preparando la búsqueda en todo el histórico…";
  try {
    await prepareSearchData();
    if (!state.searchQuery) $("#search-hint").textContent = SEARCH_HINT_TEXT;
  } catch {
    $("#search-hint").textContent = "No hemos podido preparar la búsqueda. Prueba a cerrar y abrir de nuevo.";
  }
}

function showStatus(message) { const el = $("#status-message"); el.textContent = message; el.hidden = false; }
function escapeHtml(value = "") { return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }

function bindEvents() {
  $("#search-open").addEventListener("click", openSearch);
  $("#search-close").addEventListener("click", () => closeSearch());
  $("#search-dialog").addEventListener("click", (event) => { if (event.target === event.currentTarget) closeSearch(); });
  $("#search-dialog").addEventListener("close", () => {
    state.searchQuery = "";
    state.searchResults = [];
    state.searchPage = 1;
    $("#search-input").value = "";
    $("#search-results").hidden = true;
    $("#search-hint").hidden = false;
    $("#search-hint").textContent = SEARCH_HINT_TEXT;
  });
  $("#menu-type-select").addEventListener("change", async (event) => changeMenuType(event.target.value));
  $("#menu-type-button").addEventListener("click", () => setMenuTypeList($("#menu-type-list").hidden));
  $("#menu-type-button").addEventListener("keydown", (event) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      setMenuTypeList(true);
      if (event.key === "ArrowUp") moveMenuTypeFocus(-1);
    }
  });
  $("#menu-type-list").addEventListener("click", async (event) => {
    const option = event.target.closest("[data-type]");
    if (!option) return;
    await changeMenuType(option.dataset.type);
    setMenuTypeList(false, true);
  });
  $("#menu-type-list").addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveMenuTypeFocus(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const options = document.querySelectorAll(".menu-type-option");
      options[event.key === "Home" ? 0 : options.length - 1]?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      document.activeElement?.click();
    } else if (event.key === "Escape" || event.key === "Tab") {
      setMenuTypeList(false, event.key === "Escape");
    }
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".menu-type-control")) setMenuTypeList(false);
  });
  $("#calendar").addEventListener("click", (event) => { const button = event.target.closest("[data-date]"); if (button) selectDate(button.dataset.date); });
  $("#month-select").addEventListener("change", async (event) => { await ensureMonthLoaded(event.target.value); refreshLoadedData(); state.visibleMonth = event.target.value; syncDateControls(); renderCalendar(); });
  $("#year-select").addEventListener("change", async (event) => {
    const available = state.months.filter((month) => month.startsWith(`${event.target.value}-`));
    const preferredMonth = state.visibleMonth.slice(5);
    state.visibleMonth = available.find((month) => month.endsWith(`-${preferredMonth}`)) || available[0];
    await ensureMonthLoaded(state.visibleMonth);
    refreshLoadedData();
    syncDateControls();
    renderCalendar();
  });
  $("#prev-month").addEventListener("click", () => moveMonth(-1));
  $("#next-month").addEventListener("click", () => moveMonth(1));
  $("#previous-menu").addEventListener("click", () => moveSelectedMenu(-1));
  $("#next-menu").addEventListener("click", () => moveSelectedMenu(1));
  $("#today-button").addEventListener("click", async () => { $("#status-message").hidden = true; await selectInitialDate(); });
  let timer;
  $("#search-input").addEventListener("input", (event) => { clearTimeout(timer); timer = setTimeout(() => searchMenus(event.target.value), 180); });
  $("#clear-search").addEventListener("click", () => { $("#search-input").value = ""; searchMenus(""); $("#search-input").focus(); });
  $("#search-prev").addEventListener("click", () => changeSearchPage(-1));
  $("#search-next").addEventListener("click", () => changeSearchPage(1));
  $("#result-list").addEventListener("click", async (event) => { const button = event.target.closest("[data-date]"); if (button) { $("#search-input").value = ""; closeSearch(false); await ensureMonthLoaded(button.dataset.date.slice(0, 7)); refreshLoadedData(); selectDate(button.dataset.date, true, button.dataset.type); } });
}

init();
