// =====================================================
// MasterList (Categories + Items) - Local Storage Edition
// Adds: Import MasterListDB.json + Export MasterListDB.json
//
// Data model:
//   MasterList = [ ["Category", "Item1", "Item2"], ... ]
//   Category name is always at index [i][0]
// =====================================================

const STORAGE_KEY = "MasterListDB_v1";

let MasterList = [];
let option = [];
let CategoryIndex = {}; // category name -> MasterList index

function $(id) { return document.getElementById(id); }

function setScreen(screenId) {
  const screens = ["Categories", "addItemstoCategories", "Categoryreport", "Report", "edit_Item"];
  screens.forEach(id => {
    const el = $(id);
    if (!el) return;
    el.classList.toggle("hidden", id !== screenId);
  });
}

function setText(id, value) {
  const el = $(id);
  if (!el) return;
  if ("value" in el) el.value = value;
  else el.textContent = value;
}

function getText(id) {
  const el = $(id);
  if (!el) return "";
  if ("value" in el) return el.value;
  return el.textContent || "";
}

function setProperty(id, prop, value) {
  const el = $(id);
  if (!el) return;

  if (prop === "options" && el.tagName === "SELECT") {
    el.innerHTML = "";
    (value || []).forEach(v => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      el.appendChild(opt);
    });
    return;
  }

  if (prop === "index" && el.tagName === "SELECT") {
    el.selectedIndex = Math.max(0, value ?? 0);
    return;
  }

  el[prop] = value;
}

function getProperty(id, prop) {
  const el = $(id);
  if (!el) return null;

  if (prop === "options" && el.tagName === "SELECT") {
    return Array.from(el.options).map(o => o.value);
  }

  if (prop === "index" && el.tagName === "SELECT") {
    return el.selectedIndex;
  }

  return el[prop];
}

function showElement(id) { const el = $(id); if (el) el.style.display = ""; }
function hideElement(id) { const el = $(id); if (el) el.style.display = "none"; }

function normalize(s) {
  if (s === undefined || s === null) return "";
  return ("" + s).trim();
}

function showNoList(msg) { setText("NoList", msg); showElement("NoList"); }
function hideNoList() { setText("NoList", ""); hideElement("NoList"); }

// ----------------------------
// INDEXING
// ----------------------------
function rebuildCategoryIndex() {
  CategoryIndex = {};
  for (let i = 0; i < MasterList.length; i++) {
    CategoryIndex[MasterList[i][0]] = i;
  }
}

function findCategoryIndex(name) {
  name = normalize(name);
  if (name === "") return -1;
  const idx = CategoryIndex[name];
  return (idx === undefined) ? -1 : idx;
}

// ----------------------------
// OPTIONS / DROPDOWNS
// ----------------------------
function rebuildOptionsFromMasterList() {
  option = [];
  for (let i = 0; i < MasterList.length; i++) option.push(MasterList[i][0]);
}

function syncCategoryOptions() {
  rebuildOptionsFromMasterList();
  setProperty("ListOptions", "options", option);
  setProperty("categories_item", "options", option);
  setProperty("editCatChoice", "options", option);
  setProperty("CatChoice", "options", option);
}

function ensureValidCategorySelection(dropdownId) {
  if (option.length === 0) return false;
  const idx = getProperty(dropdownId, "index");
  if (idx === undefined || idx === null || idx < 0) setProperty(dropdownId, "index", 0);
  return true;
}

// ----------------------------
// RENDERING
// ----------------------------
function itemsToBulletText(arr) {
  if (!arr || arr.length <= 1) return "No items yet.";
  let out = "";
  for (let i = 1; i < arr.length; i++) out += "- " + arr[i] + "\n";
  return out;
}

function display() {
  let text = "";
  for (let i = 0; i < MasterList.length; i++) {
    text += "[" + MasterList[i][0] + "]\n";
    text += itemsToBulletText(MasterList[i]) + "\n";
    text += "=============\n";
  }
  setText("text_area1", text);
}

function showItemsForSelectedCategory() {
  const selectedCategory = getText("categories_item");

  if (option.length === 0) {
    setText("text_area2", "");
    showNoList("No categories yet. Add a category first.");
    return;
  }

  if (!selectedCategory) {
    setText("text_area2", "");
    showNoList("Choose a category.");
    return;
  }

  const idx = findCategoryIndex(selectedCategory);
  if (idx === -1) {
    setText("text_area2", "");
    showNoList("Category not found.");
    return;
  }

  setText("text_area2", itemsToBulletText(MasterList[idx]));
}

function showCatReport() {
  const selectedCategory = getText("CatChoice");
  if (!selectedCategory) { setText("cat_report", ""); return; }

  const idx = findCategoryIndex(selectedCategory);
  if (idx === -1) { setText("cat_report", "Not found."); return; }

  setText("cat_report", itemsToBulletText(MasterList[idx]));
}

// ----------------------------
// SCREEN REFRESHERS
// ----------------------------
function refreshCategoriesUI() {
  if (option.length > 0) {
    setProperty("ListOptions", "index", 0);
    // do not overwrite status if it has an import/export message
  } else {
    setText("AddListOutput", "No categories yet.");
  }
}

function refreshAddItemsUI() {
  if (!ensureValidCategorySelection("categories_item")) {
    showNoList("No categories yet. Add a category first.");
    setText("text_area2", "");
    return;
  }
  hideNoList();
  showItemsForSelectedCategory();
}

function fillEditItemsDropdown() {
  const categoryName = getText("editCatChoice");

  if (!categoryName) {
    setProperty("editItemChoice", "options", []);
    setText("editStatus", "Choose a category.");
    return;
  }

  const idx = findCategoryIndex(categoryName);
  if (idx === -1) {
    setProperty("editItemChoice", "options", []);
    setText("editStatus", "Category not found.");
    return;
  }

  let items = [];
  for (let i = 1; i < MasterList[idx].length; i++) items.push(MasterList[idx][i]);
  if (items.length === 0) items = ["No items"];

  setProperty("editItemChoice", "options", items);
  setProperty("editItemChoice", "index", 0);

  const first = getText("editItemChoice");
  setText("editNewItemInput", (first !== "No items") ? first : "");
}

function selectDropdownValueIfPresent(dropdownId, value) {
  const el = $(dropdownId);
  if (!el || el.tagName !== "SELECT") return;
  const idx = Array.from(el.options).findIndex(o => o.value === value);
  if (idx >= 0) el.selectedIndex = idx;
}

function refreshEditScreenUI() {
  if (!ensureValidCategorySelection("editCatChoice")) {
    setProperty("editItemChoice", "options", []);
  } else {
    fillEditItemsDropdown();
  }
  setText("editNewItemInput", "");
  setText("editStatus", "");
}

function refreshCategoryReportUI() {
  if (!ensureValidCategorySelection("CatChoice")) {
    setText("cat_report", "");
    return;
  }
  showCatReport();
}

// ----------------------------
// LOCAL STORAGE PERSISTENCE
// ----------------------------
function makePayload() {
  return {
    schema: 1,
    version: 1,
    updatedAt: new Date().toISOString(),
    categories: MasterList
  };
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(makePayload()));
}

function loadFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    MasterList = [];
    rebuildCategoryIndex();
    syncCategoryOptions();
    return;
  }

  try {
    const obj = JSON.parse(raw);
    const cats = Array.isArray(obj) ? obj : (obj.categories || []);
    MasterList = Array.isArray(cats) ? cats : [];
  } catch (e) {
    MasterList = [];
  }

  rebuildCategoryIndex();
  syncCategoryOptions();
}

// ----------------------------
// IMPORT / EXPORT
// ----------------------------
function validateCategoriesShape(cats) {
  if (!Array.isArray(cats)) return { ok: false, message: "JSON is missing a categories array." };

  for (let i = 0; i < cats.length; i++) {
    const row = cats[i];
    if (!Array.isArray(row) || row.length < 1) {
      return { ok: false, message: "Category entry #" + (i + 1) + " is not a valid array." };
    }
    const name = normalize(row[0]);
    if (name === "") {
      return { ok: false, message: "Category entry #" + (i + 1) + " has an empty name at [0]." };
    }
  }
  return { ok: true, message: "OK" };
}

function setAllFromImported(categories) {
  // Normalize category names and items; preserve ordering
  MasterList = categories.map(arr => arr.map(v => normalize(v)));
  rebuildCategoryIndex();
  syncCategoryOptions();
  saveToStorage();

  // Refresh screens in case user is not on Categories
  refreshCategoriesUI();
  refreshAddItemsUI();
  refreshEditScreenUI();
  refreshCategoryReportUI();
  display();
}

async function importFromSelectedFile() {
  const input = $("importFile");
  const file = input?.files?.[0];
  if (!file) {
    setText("AddListOutput", "Select MasterListDB.json first.");
    return;
  }

  try {
    const text = await file.text();
    const obj = JSON.parse(text);
    const cats = Array.isArray(obj) ? obj : (obj.categories || []);
    const v = validateCategoriesShape(cats);
    if (!v.ok) {
      setText("AddListOutput", "Import failed: " + v.message);
      return;
    }

    setAllFromImported(cats);
    setText("AddListOutput", "Imported " + cats.length + " categories from " + file.name + ".");
  } catch (e) {
    setText("AddListOutput", "Import failed: invalid JSON file.");
  } finally {
    // allow re-importing same file without reselecting in some browsers
    if (input) input.value = "";
  }
}

function exportToJsonFile() {
  // Browser-safe export: triggers a normal download so the browser can present a Save dialog.
  // Note: Whether you see a “Save As…” prompt depends on your browser settings.
  const payload = makePayload();
  const jsonText = JSON.stringify(payload, null, 2);

  const blob = new Blob([jsonText], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "MasterListDB.json";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Give the browser a moment to start the download before revoking (Safari is happier with this).
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1000);

  setText("AddListOutput", "Export started: MasterListDB.json (" + MasterList.length + " categories).");
}


// ----------------------------
// OPERATIONS
// ----------------------------
function addCategory(categoryName) {
  categoryName = normalize(categoryName);
  if (categoryName === "") {
    setText("AddListOutput", "Type a category name.");
    return;
  }
  if (findCategoryIndex(categoryName) !== -1) {
    setText("AddListOutput", "Category already exists: " + categoryName);
    return;
  }

  MasterList.push([categoryName]);
  CategoryIndex[categoryName] = MasterList.length - 1;

  syncCategoryOptions();
  saveToStorage();

  setText("category", "");
  refreshCategoriesUI();
  setText("AddListOutput", "Added: " + categoryName);
}

function deleteSelectedCategory() {
  const catIndex = getProperty("ListOptions", "index");
  if (catIndex === undefined || catIndex === null || catIndex < 0) {
    setText("AddListOutput", "Choose a category to delete.");
    return;
  }
  if (catIndex >= MasterList.length) return;

  const name = MasterList[catIndex][0];

  // Delete all entries matching the name (keeps compatibility with old duplicates)
  MasterList = MasterList.filter(arr => arr[0] !== name);

  rebuildCategoryIndex();
  syncCategoryOptions();
  saveToStorage();

  refreshCategoriesUI();
  setText("AddListOutput", "Deleted: " + name);
}

function addItemToSelectedCategory() {
  const categoryName = normalize(getText("categories_item"));
  const newItem = normalize(getText("itemtoadd"));

  if (newItem === "") {
    showNoList("Type an item to add.");
    return;
  }

  setText("itemtoadd", "");
  hideNoList();

  const idx = findCategoryIndex(categoryName);
  if (idx === -1) { showNoList("Category not found."); return; }

  MasterList[idx].push(newItem);
  saveToStorage();

  showItemsForSelectedCategory();
  showNoList("Added: " + newItem);
}

function removeItemFromSelectedCategory() {
  const categoryName = normalize(getText("categories_item"));
  const itemName = normalize(getText("itemtoadd"));

  if (itemName === "") { showNoList("Type an item to remove."); return; }

  const idx = findCategoryIndex(categoryName);
  if (idx === -1) { showNoList("Category not found."); return; }

  const target = normalize(itemName);
  const oldArray = MasterList[idx];

  const newArray = [oldArray[0]];
  let removedCount = 0;

  for (let i = 1; i < oldArray.length; i++) {
    if (normalize(oldArray[i]) === target) removedCount++;
    else newArray.push(oldArray[i]);
  }

  setText("itemtoadd", "");

  if (removedCount === 0) { showNoList("Item not found: " + itemName); return; }

  MasterList[idx] = newArray;
  saveToStorage();

  showItemsForSelectedCategory();
  showNoList("Removed " + removedCount + " time(s): " + itemName);
}

function deleteAllItemsKeepCategories() {
  for (let i = 0; i < MasterList.length; i++) {
    MasterList[i] = [MasterList[i][0]];
  }
  rebuildCategoryIndex();
  saveToStorage();

  syncCategoryOptions();
  showItemsForSelectedCategory();
  refreshEditScreenUI();
  refreshCategoryReportUI();
  showNoList("All items deleted (categories kept).");
}

function applyEdit() {
  const categoryName = normalize(getText("editCatChoice"));
  const oldItem = getText("editItemChoice");
  const newItem = normalize(getText("editNewItemInput"));

  if (categoryName === "") { setText("editStatus", "Choose a category."); return; }
  if (oldItem === "" || oldItem === "No items") { setText("editStatus", "Choose an item to edit."); return; }
  if (newItem === "") { setText("editStatus", "Type the new item text."); return; }

  const idx = findCategoryIndex(categoryName);
  if (idx === -1) { setText("editStatus", "Category not found."); return; }

  let pos = -1;
  for (let i = 1; i < MasterList[idx].length; i++) {
    if (MasterList[idx][i] === oldItem) { pos = i; break; }
  }
  if (pos === -1) { setText("editStatus", "Item not found in that category."); return; }

  MasterList[idx][pos] = newItem;
  saveToStorage();

  fillEditItemsDropdown();
  selectDropdownValueIfPresent("editItemChoice", newItem);
  setText("editStatus", "Updated '" + oldItem + "' to '" + newItem + "'.");
}

// ----------------------------
// NAVIGATION
// ----------------------------
function goAddItems() { setScreen("addItemstoCategories"); refreshAddItemsUI(); }
function goCategories() { setScreen("Categories"); refreshCategoriesUI(); }

// ----------------------------
// EVENT WIRING
// ----------------------------
function wireEvents() {
  // Categories screen
  $("AddCategory_btn").addEventListener("click", () => addCategory(getText("category")));
  $("deleteCat_btn").addEventListener("click", deleteSelectedCategory);

  $("GoAddItem_btn").addEventListener("click", goAddItems);

  $("GoList").addEventListener("click", () => { setScreen("Report"); display(); });
  $("EditItem_btn").addEventListener("click", () => { setScreen("edit_Item"); refreshEditScreenUI(); });
  $("report_btn").addEventListener("click", () => { setScreen("Categoryreport"); refreshCategoryReportUI(); });

  // Import / Export
  $("import_btn").addEventListener("click", importFromSelectedFile);
  $("export_btn").addEventListener("click", exportToJsonFile);

  // Add items screen
  $("categories_item").addEventListener("change", () => { hideNoList(); showItemsForSelectedCategory(); });
  $("additem_btn").addEventListener("click", addItemToSelectedCategory);
  $("removeItem_btn").addEventListener("click", removeItemFromSelectedCategory);
  $("seeList_btn").addEventListener("click", () => { setScreen("Report"); display(); });
  $("delete_all_items").addEventListener("click", deleteAllItemsKeepCategories);
  $("ReturnAddCategories").addEventListener("click", goCategories);

  // Category report screen
  $("CatChoice").addEventListener("change", showCatReport);
  $("go-to-Categories").addEventListener("click", goCategories);
  $("returnToitem_btn").addEventListener("click", goAddItems);

  // Report screen
  $("returnTo_Category").addEventListener("click", goCategories);
  $("returnToitem_btn_report").addEventListener("click", goAddItems);

  // Edit screen
  $("editCatChoice").addEventListener("change", () => {
    fillEditItemsDropdown();
    setText("editNewItemInput", "");
    setText("editStatus", "");
  });
  $("editItemChoice").addEventListener("change", () => {
    const oldItem = getText("editItemChoice");
    setText("editNewItemInput", oldItem);
    setText("editStatus", "");
  });
  $("applyEdit_btn").addEventListener("click", applyEdit);
  $("editBack_btn").addEventListener("click", goCategories);
}

// ----------------------------
// AUTO-IMPORT (optional)
// ----------------------------
// Attempts to fetch ./MasterListDB.json from the same directory as index.html.
//
// Safety rules:
//  - If localStorage already has data, it will NOT overwrite unless you launch with ?overwrite=1
//  - If localStorage is empty, it will auto-load if the JSON file is reachable
//
// Notes:
//  - Many browsers block fetch() from file:// URLs. For auto-import to work reliably,
//    run a local web server (examples):
//      - Python:  python3 -m http.server 8000
//      - Node:    npx serve .
//    Then open: http://localhost:8000
async function tryAutoImportFromJsonFile() {
  const hasExisting = !!localStorage.getItem(STORAGE_KEY);
  const params = new URLSearchParams(window.location.search);
  const allowOverwrite = params.get("overwrite") === "1";

  if (hasExisting && !allowOverwrite) return;

  try {
    const res = await fetch("./MasterListDB.json", { cache: "no-store" });
    if (!res.ok) return;

    const obj = await res.json();
    const cats = Array.isArray(obj) ? obj : (obj.categories || []);
    const v = validateCategoriesShape(cats);
    if (!v.ok) return;

    MasterList = cats.map(arr => arr.map(v => normalize(v)));
    rebuildCategoryIndex();
    syncCategoryOptions();
    saveToStorage();

    setText("AddListOutput", "Auto-imported MasterListDB.json (" + cats.length + " categories).");
  } catch (e) {
    // Fail silently; manual import remains available.
    return;
  }
}

// ----------------------------
// STARTUP
// ----------------------------
async function init() {
  hideElement("NoList");
  setProperty("ListOptions", "options", []);

  // Attempt auto-import first (may populate localStorage)
  await tryAutoImportFromJsonFile();

  // Then load whatever is in localStorage

  loadFromStorage();
  wireEvents();

  setScreen("Categories");
  refreshCategoriesUI();
}

document.addEventListener("DOMContentLoaded", init);
