/**
 * Modal Manager - управління модальними вікнами та формами
 */

import {
  createCard,
  updateCard,
  removeCard,
  createColumn,
  updateColumn,
  removeColumn,
} from "./api.js";
import { askConfirm, notifyError, notifySuccess } from "./ui-feedback.js";

/**
 * Card Modal Manager
 */
export const cardModal = {
  element: null,
  form: null,
  titleElement: null,
  deleteBtn: null,

  /**
   * Ініціалізація модалі картки
   */
  init() {
    this.element = document.getElementById("modal");
    this.form = document.getElementById("modalForm");
    this.titleElement = document.getElementById("modalTitle");
    this.deleteBtn = document.getElementById("deleteBtn");

    document
      .getElementById("cancelBtn")
      .addEventListener("click", () => this.close());
    document
      .getElementById("modalClose")
      .addEventListener("click", () => this.close());

    this.form.addEventListener("input", (e) => {
      if (e.target.name === "icon") this.showIconPreview(e.target.value);
    });

    this.form.addEventListener("submit", (e) => this.handleSubmit(e));
    this.deleteBtn.addEventListener("click", () => this.handleDelete());
  },

  /**
   * Відкрити модаль для додавання/редагування картки
   */
  open(card = null) {
    this.element.classList.remove("hidden");

    if (card) {
      this.titleElement.textContent = "Edit card";
      this.form.id.value = card.id;
      this.form.title.value = card.title;
      this.form.link.value = card.link || "";
      this.form.description.value = card.description || "";
      this.form.column_id.value = card.column_id;
      this.form.icon.value = card.icon || "";
      this.showIconPreview(card.icon);
      this.deleteBtn.style.display = "inline-block";
    } else {
      this.titleElement.textContent = "Add card";
      this.form.reset();
      this.form.id.value = "";
      this.showIconPreview("");
      this.deleteBtn.style.display = "none";
    }
  },

  /**
   * Закрити модаль
   */
  close() {
    this.element.classList.add("hidden");
  },

  /**
   * Показати превью іконки
   */
  showIconPreview(url) {
    const preview = document.getElementById("iconPreview");
    preview.innerHTML = "";
    if (url) {
      const img = document.createElement("img");
      img.src = url;
      img.crossOrigin = "anonymous";
      preview.appendChild(img);
    }
  },

  /**
   * Обробити відправку форми
   */
  async handleSubmit(e) {
    e.preventDefault();

    const payload = {
      title: this.form.title.value,
      link: this.form.link.value,
      description: this.form.description.value,
      icon: this.form.icon.value,
      column_id: parseInt(this.form.column_id.value),
    };

    try {
      if (this.form.id.value) {
        // Редагування
        const res = await updateCard(this.form.id.value, payload);
        if (!res.ok) throw new Error("Update failed");
        notifySuccess("Card updated");
      } else {
        // Створення
        const res = await createCard(payload);
        if (!res.ok) throw new Error("Create failed");
        notifySuccess("Card created");
      }

      window.app?.refresh();
      this.close();
    } catch (err) {
      notifyError(err.message || "Failed to save card");
    }
  },

  /**
   * Обробити видалення картки
   */
  async handleDelete() {
    const id = this.form.id.value;
    if (!id) return;

    const ok = await askConfirm("Delete this card?", {
      confirmLabel: "Delete",
    });
    if (!ok) return;

    try {
      const res = await removeCard(id);
      if (res.status === 204) {
        notifySuccess("Card deleted");
        window.app?.refresh();
        this.close();
      } else {
        throw new Error("Delete failed");
      }
    } catch (err) {
      notifyError("Failed to delete card");
    }
  },

  /**
   * Заповнити селект колон
   */
  fillColumnSelect(state) {
    const select = this.form.querySelector("select[name=column_id]");
    select.innerHTML = "";
    state.columns.forEach((col) => {
      const opt = document.createElement("option");
      opt.value = col.id;
      opt.textContent = col.name;
      select.appendChild(opt);
    });
  },
};

/**
 * Settings Modal Manager
 */
export const settingsModal = {
  element: null,
  openBtn: null,
  closeBtn: null,
  form: null,
  columnsList: null,
  addColumnForm: null,

  /**
   * Ініціалізація модалі налаштувань
   */
  init() {
    this.element = document.getElementById("settingsModal");
    this.openBtn = document.getElementById("openSettings");
    this.closeBtn = document.getElementById("settingsCloseBtn");
    this.form = document.getElementById("settingsLayout");
    this.columnsList = document.getElementById("columnsList");
    this.addColumnForm = document.getElementById("settingsAddCol");
    this.tabCardForm = document.getElementById("tabCardForm");
    this.resetTabCardFormBtn = document.getElementById("resetTabCardForm");

    document
      .getElementById("settingsClose")
      .addEventListener("click", () => this.close());
    this.closeBtn.addEventListener("click", () => this.close());
    this.openBtn.addEventListener("click", () => this.open());
    this.form.addEventListener("submit", (e) => this.handleSettingsSubmit(e));
    this.addColumnForm.addEventListener("submit", (e) =>
      this.handleAddColumn(e),
    );
    this.tabCardForm.addEventListener("submit", (e) =>
      this.handleTabCardSubmit(e),
    );
    this.resetTabCardFormBtn.addEventListener("click", () => {
      this.tabCardForm.reset();
      this.tabCardForm.id.value = "";
      this.resetTabCardFormBtn.classList.add("is-hidden");
    });

    this.initColorControls();
    this.initBackgroundUpload();
    this.initTabSwitching();
  },

  /**
   * Відкрити модаль
   */
  async open() {
    this.element.classList.remove("hidden");
    await window.app?.openSettings?.();
  },

  /**
   * Закрити модаль
   */
  close() {
    this.element.classList.add("hidden");
  },

  /**
   * Ініціалізація контролів кольору
   */
  initColorControls() {
    const controls = [
      {
        inputId: "column_bg_color",
        valId: "column_bg_opacity_val",
        opacityId: "column_bg_opacity",
      },
      {
        inputId: "card_bg_color",
        valId: "card_bg_opacity_val",
        opacityId: "card_bg_opacity",
      },
    ];

    controls.forEach(({ inputId, opacityId, valId }) => {
      const input = document.getElementById(inputId);
      const opInput = document.getElementById(opacityId);
      const valDisplay = document.getElementById(valId);

      if (input) {
        input.addEventListener("input", () => {
          window.app?.updateSettings?.();
        });
      }

      if (opInput) {
        opInput.addEventListener("input", (e) => {
          const v = parseInt(e.target.value || 100);
          if (valDisplay) valDisplay.textContent = v + "%";
          window.app?.updateSettings?.();
        });
      }
    });
  },

  /**
   * Ініціалізація завантаження фону
   */
  initBackgroundUpload() {
    const bgFileInput = document.getElementById("dashboard_bg_file");
    const resetBgBtn = document.getElementById("resetBgBtn");

    if (bgFileInput) {
      bgFileInput.addEventListener("change", (e) =>
        window.app?.handleBgUpload?.(e),
      );
    }

    if (resetBgBtn) {
      resetBgBtn.addEventListener("click", () => window.app?.resetBg?.());
    }
  },

  /**
   * Ініціалізація перемикання табів
   */
  initTabSwitching() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tabName = btn.dataset.tab;

        // Сховати все, деактивувати все
        document
          .querySelectorAll(".tab-content")
          .forEach((t) => t.classList.remove("active"));
        document
          .querySelectorAll(".tab-btn")
          .forEach((b) => b.classList.remove("active"));

        // Показати вибраний, активувати кнопку
        document.getElementById(tabName + "-tab").classList.add("active");
        btn.classList.add("active");
      });
    });
  },

  /**
   * Обробити відправку налаштувань
   */
  async handleSettingsSubmit(e) {
    e.preventDefault();
    await window.app?.saveSettings?.();
  },

  /**
   * Обробити додавання колони
   */
  async handleAddColumn(e) {
    e.preventDefault();
    const nameInput = this.addColumnForm.querySelector("input[name=name]");
    const name = nameInput.value.trim();

    if (!name) return;

    try {
      const res = await createColumn({ name });
      if (!res.ok) throw new Error("Create failed");

      nameInput.value = "";
      notifySuccess("Column added");
      window.app?.refresh();
      await window.app?.openSettings?.();
    } catch (err) {
      notifyError("Failed to add column");
    }
  },

  /**
   * Обробити відправку форми картки з табу
   */
  async handleTabCardSubmit(e) {
    e.preventDefault();
    const form = this.tabCardForm;

    const payload = {
      title: form.title.value,
      link: form.link.value,
      description: form.description.value,
      icon: form.icon.value,
      column_id: parseInt(form.column_id.value),
    };

    try {
      if (form.id.value) {
        const res = await updateCard(form.id.value, payload);
        if (!res.ok) throw new Error("Update failed");
        notifySuccess("Card updated");
      } else {
        const res = await createCard(payload);
        if (!res.ok) throw new Error("Create failed");
        notifySuccess("Card added");
      }

      form.reset();
      form.id.value = "";
      this.resetTabCardFormBtn.classList.add("is-hidden");
      window.app?.refresh();
    } catch (err) {
      notifyError("Failed to save card");
    }
  },
};
