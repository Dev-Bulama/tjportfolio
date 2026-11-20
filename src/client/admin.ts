// Admin panel entry. Heavy modules (Tiptap, Chart.js) are split into lazy chunks.
import { initCore } from "./admin/core.js";
import { initPalette } from "./admin/palette.js";
import { initLists } from "./admin/lists.js";
import { initMediaFields, initUploader } from "./admin/media.js";
import { initEditor } from "./admin/editor.js";

initCore();
initPalette();
initLists();
initMediaFields();
initUploader();
void initEditor();

if (document.querySelector("[data-chart]")) {
  void import("./admin/charts.js").then((m) => m.initCharts());
}
if (document.querySelector("[data-kanban]")) {
  void import("./admin/kanban.js").then((m) => m.initKanban());
}
if (document.querySelector("[data-menu-builder]")) {
  void import("./admin/menus.js").then((m) => m.initMenus());
}
