/**
 * Bookmarks Dashboard - Main Application
 * Очищена та рефакторена структура з логічним розділенням обов'язків
 */

import {
  getSettings,
  getState,
  saveSettings,
  uploadBackground,
  resetBackground,
  updateColumn,
  removeColumn,
} from "./js/api.js";
import {
  DEFAULT_SETTINGS,
  applySettingsToDom,
  mergeSettings,
} from "./js/settings-store.js";
import { notifyError, notifySuccess, askConfirm } from "./js/ui-feedback.js";
import { boardManager } from "./js/board-manager.js";
import { createColumnElement } from "./js/column-renderer.js";
import { cardModal, settingsModal } from "./js/modal-manager.js";

/**
 * Application State
 */
const app = {
  settings: { ...DEFAULT_SETTINGS },
  state: null,

  /**
   * === INITIALIZATION ===
   */

  async init() {
    console.log("🚀 Initializing Dashboard...");

    // Ініціалізувати модалі
    cardModal.init();
    settingsModal.init();

    // Завантажити налаштування та стан
    await this.loadSettings();
    await this.refresh();

    console.log("✅ Dashboard Ready");
  },

  /**
   * === SETTINGS MANAGEMENT ===
   */

  async loadSettings() {
    try {
      const incoming = await getSettings();
      if (incoming) {
        this.settings = mergeSettings(this.settings, incoming);
        this.applySettings();
      }
    } catch (e) {
      console.warn("⚠️  Failed loading settings", e);
    }
  },

  applySettings() {
    applySettingsToDom(this.settings);
  },

  updateSettings() {
    // Оновити налаштування з UI контролів
    const colColor = document.getElementById("column_bg_color");
    const colOp = document.getElementById("column_bg_opacity");
    const cardColor = document.getElementById("card_bg_color");
    const cardOp = document.getElementById("card_bg_opacity");

    if (colColor) this.settings.column_bg_color = colColor.value;
    if (colOp)
      this.settings.column_bg_opacity = parseInt(colOp.value || 100) / 100;
    if (cardColor) this.settings.card_bg_color = cardColor.value;
    if (cardOp)
      this.settings.card_bg_opacity = parseInt(cardOp.value || 100) / 100;

    this.applySettings();
  },

  async saveSettings() {
    try {
      const payload = {
        dashboard_title:
          document.getElementById("settingsLayout").dashboard_title.value ||
          "Start Dashboard",
        cols_per_row:
          parseInt(
            document.getElementById("settingsLayout").cols_per_row.value,
          ) || 3,
        column_width:
          parseInt(
            document.getElementById("settingsLayout").column_width.value,
          ) || 320,
        card_height:
          parseInt(
            document.getElementById("settingsLayout").card_height.value,
          ) || 0,
        column_bg_color: this.settings.column_bg_color || "#ffffff",
        column_bg_opacity: this.settings.column_bg_opacity || 1.0,
        card_bg_color: this.settings.card_bg_color || "#ffffff",
        card_bg_opacity: this.settings.card_bg_opacity || 1.0,
      };

      const res = await saveSettings(payload);
      if (!res.ok) throw new Error("Save failed");

      await this.loadSettings();
      notifySuccess("Settings saved");
    } catch (err) {
      notifyError("Failed to save settings");
    }
  },

  /**
   * === BACKGROUND MANAGEMENT ===
   */

  async handleBgUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const res = await uploadBackground(file);
      if (!res.ok) {
        let message = "Failed to upload background image";
        try {
          const data = await res.json();
          if (data?.error?.message)
            message = `Failed to upload background image: ${data.error.message}`;
        } catch (_) {
          // use default message
        }
        throw new Error(message);
      }

      await this.loadSettings();
      notifySuccess("Background uploaded and applied");
    } catch (err) {
      notifyError(err?.message || "Failed to upload background image");
    }
  },

  async resetBg() {
    const ok = await askConfirm("Delete background image?", {
      confirmLabel: "Delete",
    });
    if (!ok) return;

    try {
      const res = await resetBackground();
      if (res.status === 204) {
        await this.loadSettings();
        notifySuccess("Background reset");
      } else {
        throw new Error("Reset failed");
      }
    } catch (e) {
      notifyError("Failed to reset background");
    }
  },

  /**
   * === SETTINGS MODAL ===
   */

  async openSettings() {
    try {
      this.state = await getState();
      this.fillSettingsForm();
      await this.refreshColumnsList();
      this.fillColumnSelects();
    } catch (err) {
      notifyError("Failed to load settings");
    }
  },

  fillSettingsForm() {
    const form = document.getElementById("settingsLayout");
    form.dashboard_title.value = this.settings.dashboard_title;
    form.cols_per_row.value = this.settings.cols_per_row;
    form.column_width.value = this.settings.column_width;
    form.card_height.value = this.settings.card_height;

    // Color controls
    const elements = [
      {
        colorId: "column_bg_color",
        opacityId: "column_bg_opacity",
        valId: "column_bg_opacity_val",
        colorKey: "column_bg_color",
        opacityKey: "column_bg_opacity",
      },
      {
        colorId: "card_bg_color",
        opacityId: "card_bg_opacity",
        valId: "card_bg_opacity_val",
        colorKey: "card_bg_color",
        opacityKey: "card_bg_opacity",
      },
    ];

    elements.forEach(({ colorId, opacityId, valId, colorKey, opacityKey }) => {
      const colorEl = document.getElementById(colorId);
      const opEl = document.getElementById(opacityId);
      const valEl = document.getElementById(valId);

      if (colorEl) colorEl.value = this.settings[colorKey] || "#ffffff";
      if (opEl) {
        opEl.value = Math.round((this.settings[opacityKey] || 1.0) * 100);
        if (valEl)
          valEl.textContent =
            Math.round((this.settings[opacityKey] || 1.0) * 100) + "%";
      }
    });
  },

  async refreshColumnsList() {
    const columnsList = document.getElementById("columnsList");
    columnsList.innerHTML = "";

    this.state.columns.forEach((col) => {
      const row = document.createElement("div");
      row.className = "col-item";

      const nameEl = document.createElement("div");
      nameEl.className = "col-name";
      nameEl.textContent = col.name;

      const actions = document.createElement("div");
      actions.className = "col-actions";

      // Edit button
      const editBtn = document.createElement("button");
      editBtn.className = "edit-col";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", async () => {
        const newName = prompt("New column name:", col.name);
        if (newName && newName.trim()) {
          try {
            const res = await updateColumn(col.id, {
              name: newName.trim(),
            });
            if (!res.ok) throw new Error("Update failed");
            await this.refresh();
            await this.openSettings();
            notifySuccess("Column updated");
          } catch (err) {
            notifyError("Failed to update column");
          }
        }
      });

      // Delete button
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", async () => {
        const ok = await askConfirm("Delete this column and all its cards?", {
          confirmLabel: "Delete",
        });
        if (!ok) return;

        try {
          const res = await removeColumn(col.id);
          if (res.status === 204) {
            await this.refresh();
            await this.openSettings();
            notifySuccess("Column deleted");
          } else {
            throw new Error("Delete failed");
          }
        } catch (err) {
          notifyError("Failed to delete column");
        }
      });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      row.appendChild(nameEl);
      row.appendChild(actions);
      columnsList.appendChild(row);
    });
  },

  fillColumnSelects() {
    const selects = [
      document.querySelector("#modalForm select[name=column_id]"),
      document.querySelector("#tabCardForm select[name=column_id]"),
    ];

    selects.forEach((select) => {
      if (!select) return;
      select.innerHTML = "";
      this.state.columns.forEach((col) => {
        const opt = document.createElement("option");
        opt.value = col.id;
        opt.textContent = col.name;
        select.appendChild(opt);
      });
    });
  },

  /**
   * === BOARD MANAGEMENT ===
   */

  async refresh() {
    try {
      this.state = await getState();
      this.renderBoard();
    } catch (err) {
      console.error("❌ Failed to refresh board:", err);
      notifyError("Failed to load dashboard");
    }
  },

  renderBoard() {
    boardManager.clear();
    const main = boardManager.getMainBoard();
    boardManager.initializeBoardDragHandlers(main);

    this.state.columns.forEach((col) => {
      const columnElement = createColumnElement(col, (card) =>
        cardModal.open(card),
      );
      main.appendChild(columnElement);
    });

    cardModal.fillColumnSelect(this.state);
  },
};

// === GLOBAL EXPORTS ===
window.app = {
  refresh: () => app.refresh(),
  openSettings: () => app.openSettings(),
  updateSettings: () => app.updateSettings(),
  saveSettings: () => app.saveSettings(),
  handleBgUpload: (e) => app.handleBgUpload(e),
  resetBg: () => app.resetBg(),
};

// === BOOTSTRAP ===
app.init();
