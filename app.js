"use strict";

/*
  MasterList SPA (with Autosave + Versioned Export)

  Key limitations (browser security):
  - Cannot overwrite a specific file in-place (e.g., MasterListDB.json) in iCloud/Files.
  - Can export (download) a versioned JSON file.
  - On desktop Chrome/Edge, can optionally save to a user-chosen folder via File System Access API.
*/

const MASTER_FILE_DEFAULT = "MasterListDB.json";
const el = (id) => document.getElementById(id);

// --- Auto-save (localStorage) ---
const LOCAL_STORAGE_KEY = "MasterListSPA.db.v1";
const LOCAL_STORAGE_META_KEY = "MasterListSPA.meta.v1";

const ui = {
  globalStatus: el("globalStatus"),
  btnImport: el("btnImport"),
  btnExport: el("btnExport"),
  btnNew: el("btnNew"),
  fileInput: el("fileInput"),

  // Categories
  category: el("category"),
  ListOptions: el("ListOptions"),
  AddListOutput: el("AddListOutput"),
  categoriesTableBody: el("categoriesTableBody"),

  // addItemstoCategories
  categories_item: el("categories_item"),
  itemtoadd: el("itemtoadd"),
  NoList: el("NoList"),
  text_area2: el("text_area2"),

  // Categoryreport
  CatChoice: el("CatChoice"),
  cat_report: el("cat_report"),

  // edit_Item
  editCatChoice: el("editCatChoice"),
  editItemChoice: el("editItemChoice"),
  editNewItemInput: el("editNewItemInput"),
  editStatus: el("editStatus"),

  // Report
  text_area1: el("text_area1"),
};

let db = null;
let loadedFileName = null;

function normalize(s) { return String(s || "").trim(); }

function nowISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const tzMin = d.getTimezoneOffset();
  const sign = tzMin <= 0 ? "+" : "-";
  const abs = Math.abs(tzMin);
  const tzh = pad(Math.floor(abs / 60));
  const tzm = pad(abs % 60);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${tzh}:${tzm}`;
}

function safeStampForFilename() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  // YYYY-MM-DD_HHMMSS
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function ensureDb() {
  if (!db) db = { schema: 1, version: 1, updatedAt: nowISO(), categories: [] };
}

function validateDb(candidate) {
  if (!candidate || typeof candidate !== "object") return "File is not a JSON object.";
  if (!Array.isArray(candidate.categories)) return "Missing or invalid 'categories' array.";
  for (const row of candidate.categories) {
    if (!Array.isArray(row) || row.length < 1) return "Each category row must be an array with at least a category name.";
    if (typeof row[0] !== "string") return "Category name (index 0) must be a string.";
  }
  return null;
}

// Normalize legacy rows like: ["1", "["PLC","date", ...]"] -> ["PLC","date",...]
function normalizeImportedDb(obj) {
  if (!obj || !Array.isArray(obj.categories)) return obj;
  const out = [];
  for (const row of obj.categories) {
    if (Array.isArray(row) && row.length >= 2 && typeof row[1] === "string") {
      const s = row[1].trim();
      if (s.startsWith("[") && s.includes(""")) {
        try {
          const inner = JSON.parse(s);
          if (Array.isArray(inner) && inner.length >= 1) {
            const cat = String(inner[0]);
            const items = inner.slice(1).map(x => String(x));
            out.push([cat, ...items]);
            continue;
          }
        } catch (e) { /* fall through */ }
      }
    }
    out.push(row);
  }
  obj.categories = out;
  return obj;
}

// -------- Autosave helpers --------
function saveToLocalStorage() {
  try {
    if (!db) return;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(db));
    localStorage.setItem(LOCAL_STORAGE_META_KEY, JSON.stringify({
      savedAt: nowISO(),
      loadedFileName: loadedFileName || null
    }));
  } catch (e) {
    // Storage might fail (private mode, quota, etc.)
    ui.globalStatus.textContent = (ui.globalStatus.textContent || "") + " | autosave failed";
  }
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const candidate = JSON.parse(raw);
    const err = validateDb(candidate);
    if (err) return null;
    const metaRaw = localStorage.getItem(LOCAL_STORAGE_META_KEY);
    const meta = metaRaw ? JSON.parse(metaRaw) : null;
    return { db: candidate, meta };
  } catch (e) {
    return null;
  }
}

// -------- Versioning --------
function bumpVersion() {
  ensureDb();
  db.version = (Number(db.version) || 0) + 1;
  db.updatedAt = nowISO();
  saveToLocalStorage();
}

function setGlobalStatus() {
  if (!db) {
    ui.globalStatus.textContent = "No file loaded.";
    ui.btnExport.disabled = true;
    return;
  }
  ui.btnExport.disabled = false;
  const filePart = loadedFileName ? `Loaded: ${loadedFileName}` : "Working set (not imported)";
  ui.globalStatus.textContent = `${filePart} | v${db.version} | updated ${db.updatedAt} | categories ${db.categories.length} | autosave on`;
}

function setText(id, value) { el(id).value = value; }
function getText(id) { return (el(id).value ?? ""); }
function setLabel(id, value) { el(id).textContent = value; }

// ----- SPA screens -----
function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(screenId);
  if (target) target.classList.add("active");
}
function setScreen(screenId) { showScreen(screenId); }

// ----- onEvent port -----
function onEvent(id, eventName, handler) {
  const node = el(id);
  if (node) node.addEventListener(eventName, handler);
}

// ----- Data helpers -----
function categoryNames() {
  ensureDb();
  return db.categories.map(row => row[0]);
}

function getCategoryIndexByName(name) {
  ensureDb();
  const n = normalize(name).toLowerCase();
  for (let i = 0; i < db.categories.length; i++) {
    if (normalize(db.categories[i][0]).toLowerCase() === n) return i;
  }
  return -1;
}

function refreshDropdown(selectEl) {
  const names = categoryNames();
  selectEl.innerHTML = "";
  names.forEach(n => {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n;
    selectEl.appendChild(opt);
  });
}

function refreshEditItemChoice() {
  ensureDb();
  const catName = normalize(ui.editCatChoice.value);
  const idx = getCategoryIndexByName(catName);
  ui.editItemChoice.innerHTML = "";
  if (idx < 0) return;
  db.categories[idx].slice(1).forEach(it => {
    const opt = document.createElement("option");
    opt.value = it;
    opt.textContent = it;
    ui.editItemChoice.appendChild(opt);
  });
}

function refreshAllDropdowns() {
  refreshDropdown(ui.ListOptions);
  refreshDropdown(ui.categories_item);
  refreshDropdown(ui.CatChoice);
  refreshDropdown(ui.editCatChoice);
  refreshEditItemChoice();
}

function renderCategoriesTable() {
  ensureDb();
  ui.categoriesTableBody.innerHTML = "";
  for (const row of db.categories) {
    const tr = document.createElement("tr");
    const tdCat = document.createElement("td");
    tdCat.textContent = row[0];
    const tdItems = document.createElement("td");
    tdItems.textContent = row.slice(1).join("\n");
    tr.appendChild(tdCat);
    tr.appendChild(tdItems);
    ui.categoriesTableBody.appendChild(tr);
  }
}

function updateNoListLabel() {
  ensureDb();
  setLabel("NoList", db.categories.length ? "" : "No categories yet.");
}

function showSelectedCategoryItems(selectEl, outputId) {
  ensureDb();
  const name = normalize(selectEl.value);
  const idx = getCategoryIndexByName(name);
  if (idx < 0) { setText(outputId, ""); return; }
  setText(outputId, db.categories[idx].slice(1).join("\n"));
}

// ----- Actions -----
function addCategory() {
  ensureDb();
  const name = normalize(getText("category"));
  setText("category", "");
  if (!name) { ui.AddListOutput.value = "Type a category name."; return; }
  if (getCategoryIndexByName(name) !== -1) { ui.AddListOutput.value = "Category already exists."; return; }
  db.categories.push([name]);
  bumpVersion();
  ui.AddListOutput.value = `Added category: ${name}`;
  refreshAllDropdowns();
  renderCategoriesTable();
  setGlobalStatus();
  updateNoListLabel();
}

function deleteSelectedCategory() {
  ensureDb();
  const name = normalize(ui.ListOptions.value);
  if (!name) { ui.AddListOutput.value = "No category selected."; return; }
  const idx = getCategoryIndexByName(name);
  if (idx < 0) { ui.AddListOutput.value = "Category not found."; return; }
  if (!confirm(`Delete category "${name}" and all its items?`)) return;
  db.categories.splice(idx, 1);
  bumpVersion();
  ui.AddListOutput.value = `Deleted category: ${name}`;
  refreshAllDropdowns();
  renderCategoriesTable();
  setGlobalStatus();
  updateNoListLabel();
}

function addItem() {
  ensureDb();
  const cat = normalize(ui.categories_item.value);
  const idx = getCategoryIndexByName(cat);
  const item = normalize(getText("itemtoadd"));
  setText("itemtoadd", "");
  if (idx < 0) { setLabel("NoList", "Select a category first."); return; }
  if (!item) { setLabel("NoList", "Type an item."); return; }
  db.categories[idx].push(item);
  bumpVersion();
  setLabel("NoList", `Added "${item}" to ${cat}.`);
  showSelectedCategoryItems(ui.categories_item, "text_area2");
  renderCategoriesTable();
  setGlobalStatus();
}

function removeItem() {
  ensureDb();
  const cat = normalize(ui.categories_item.value);
  const idx = getCategoryIndexByName(cat);
  const item = normalize(getText("itemtoadd"));
  setText("itemtoadd", "");
  if (idx < 0) { setLabel("NoList", "Select a category first."); return; }
  if (!item) { setLabel("NoList", "Type an item to remove."); return; }
  const row = db.categories[idx];
  let removed = false;
  for (let i = 1; i < row.length; i++) {
    if (normalize(row[i]).toLowerCase() === item.toLowerCase()) {
      row.splice(i, 1);
      removed = true;
      break;
    }
  }
  if (!removed) { setLabel("NoList", `Item not found: "${item}"`); return; }
  bumpVersion();
  setLabel("NoList", `Removed "${item}" from ${cat}.`);
  showSelectedCategoryItems(ui.categories_item, "text_area2");
  renderCategoriesTable();
  setGlobalStatus();
}

function deleteAllItems() {
  ensureDb();
  const cat = normalize(ui.categories_item.value);
  const idx = getCategoryIndexByName(cat);
  if (idx < 0) { setLabel("NoList", "Select a category first."); return; }
  if (!confirm(`Delete ALL items in "${cat}" (keep category)?`)) return;
  db.categories[idx] = [db.categories[idx][0]];
  bumpVersion();
  setLabel("NoList", `Cleared items in ${cat}.`);
  showSelectedCategoryItems(ui.categories_item, "text_area2");
  renderCategoriesTable();
  setGlobalStatus();
}

function applyItemEdit() {
  ensureDb();
  const cat = normalize(ui.editCatChoice.value);
  const idx = getCategoryIndexByName(cat);
  const oldItem = normalize(ui.editItemChoice.value);
  const newItem = normalize(getText("editNewItemInput"));
  setText("editNewItemInput", "");
  if (idx < 0) { ui.editStatus.value = "Select a category."; return; }
  if (!oldItem) { ui.editStatus.value = "Select an item."; return; }
  if (!newItem) { ui.editStatus.value = "Type a new item value."; return; }
  const row = db.categories[idx];
  let changed = false;
  for (let i = 1; i < row.length; i++) {
    if (row[i] === oldItem) {
      row[i] = newItem;
      changed = true;
      break;
    }
  }
  if (!changed) { ui.editStatus.value = "Item not found."; return; }
  bumpVersion();
  ui.editStatus.value = `Replaced "${oldItem}" with "${newItem}" in ${cat}.`;
  refreshEditItemChoice();
  renderCategoriesTable();
  setGlobalStatus();
}

function buildFullReport() {
  ensureDb();
  let out = "";
  for (const row of db.categories) {
    out += `[${row[0]}]\n`;
    out += row.slice(1).join("\n") + "\n";
    out += "=============\n";
  }
  setText("text_area1", out.trim());
}

// ----- File I/O -----
function importJsonFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const candidate = JSON.parse(String(reader.result || ""));
      const err = validateDb(candidate);
      if (err) { alert(err); return; }
      db = normalizeImportedDb(candidate);
      if (!db.schema) db.schema = 1;
      if (!db.version) db.version = 1;
      if (!db.updatedAt) db.updatedAt = nowISO();
      loadedFileName = file.name;

      saveToLocalStorage(); // autosave on import

      ui.AddListOutput.value = `Imported: ${file.name}`;
      refreshAllDropdowns();
      renderCategoriesTable();
      setGlobalStatus();
      updateNoListLabel();
      setScreen("Categories");
    } catch (e) {
      alert("Could not parse JSON: " + e.message);
    }
  };
  reader.readAsText(file);
}

// 1) Always available: download (works on iPhone/Mac)
function exportJsonDownload() {
  ensureDb();
  const stem = (loadedFileName || MASTER_FILE_DEFAULT).replace(/\.json$/i, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${stem}_v${String(db.version).padStart(4, "0")}_${safeStampForFilename()}.json`;

  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  ui.AddListOutput.value = `Exported (downloaded): ${fileName}`;
}

// 2) Desktop Chrome/Edge only: attempt save into user-chosen folder (not iPhone Safari)
async function exportJsonToPickedFolder() {
  ensureDb();

  // Feature detection
  if (!window.showDirectoryPicker) {
    exportJsonDownload();
    return;
  }

  try {
    // User picks a folder (they can pick your app folder if they want)
    const dir = await window.showDirectoryPicker();
    const stem = (loadedFileName || MASTER_FILE_DEFAULT).replace(/\.json$/i, "").replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${stem}_v${String(db.version).padStart(4, "0")}_${safeStampForFilename()}.json`;

    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(db, null, 2));
    await writable.close();

    ui.AddListOutput.value = `Saved to folder: ${fileName}`;
  } catch (e) {
    // If user cancels or permission fails, fallback to download
    exportJsonDownload();
  }
}

// Export button behavior:
// - If browser supports directory picker, try that first.
// - Otherwise download.
async function exportJson() {
  await exportJsonToPickedFolder();
}

// ----- Wire buttons to your IDs -----
onEvent("btnImport", "click", () => el("fileInput").click());
el("fileInput").addEventListener("change", () => {
  const file = el("fileInput").files && el("fileInput").files[0];
  el("fileInput").value = "";
  if (file) importJsonFile(file);
});

onEvent("btnExport", "click", exportJson);

onEvent("btnNew", "click", () => {
  db = { schema: 1, version: 1, updatedAt: nowISO(), categories: [] };
  loadedFileName = null;
  saveToLocalStorage();
  ui.AddListOutput.value = "New empty database. Autosave is ON (this device/browser).";
  refreshAllDropdowns();
  renderCategoriesTable();
  setGlobalStatus();
  updateNoListLabel();
  setScreen("Categories");
});

onEvent("AddCategory_btn", "click", addCategory);
onEvent("GoList", "click", () => { renderCategoriesTable(); ui.AddListOutput.value = "List refreshed."; });
onEvent("deleteCat_btn", "click", deleteSelectedCategory);

onEvent("GoAddItem_btn", "click", () => {
  ensureDb();
  refreshAllDropdowns();
  updateNoListLabel();
  showSelectedCategoryItems(ui.categories_item, "text_area2");
  setScreen("addItemstoCategories");
});

onEvent("ReturnAddCategories", "click", () => setScreen("Categories"));
onEvent("seeList_btn", "click", () => showSelectedCategoryItems(ui.categories_item, "text_area2"));
onEvent("addItem_btn", "click", addItem);
onEvent("removeItem_btn", "click", removeItem);
onEvent("delete_all_items", "click", deleteAllItems);

onEvent("report_btn", "click", () => {
  ensureDb();
  refreshAllDropdowns();
  showSelectedCategoryItems(ui.CatChoice, "cat_report");
  setScreen("Categoryreport");
});

onEvent("go-to-Categories", "click", () => setScreen("Categories"));
ui.CatChoice.addEventListener("change", () => showSelectedCategoryItems(ui.CatChoice, "cat_report"));

onEvent("EditItem_btn", "click", () => {
  ensureDb();
  refreshAllDropdowns();
  refreshEditItemChoice();
  ui.editStatus.value = "";
  setScreen("edit_Item");
});

ui.editCatChoice.addEventListener("change", () => refreshEditItemChoice());
onEvent("applyEdit_btn", "click", applyItemEdit);
onEvent("editBack_btn", "click", () => setScreen("Categories"));

onEvent("returnToitem_btn", "click", () => setScreen("addItemstoCategories"));
onEvent("returnTo_Category", "click", () => setScreen("Categories"));

// Init (restore from localStorage if present)
(function init() {
  const restored = loadFromLocalStorage();
  if (restored && restored.db) {
    db = restored.db;
    loadedFileName = (restored.meta && restored.meta.loadedFileName) ? restored.meta.loadedFileName : null;
  } else {
    db = { schema: 1, version: 1, updatedAt: nowISO(), categories: [] };
    loadedFileName = null;
    saveToLocalStorage();
  }
  refreshAllDropdowns();
  renderCategoriesTable();
  setGlobalStatus();
  updateNoListLabel();

  if (ui.AddListOutput) {
    ui.AddListOutput.value = "Ready. Import JSON to load your data. Autosave is ON (this device/browser).";
  }
})();
