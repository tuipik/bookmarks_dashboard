/**
 * Board Manager - управління дошкою та рендеруванням
 */

import { createElement } from "./dom-utils.js";
import { reorderColumnCards, reorderColumns } from "./api.js";
import { dragManager } from "./drag-manager.js";

export const boardManager = {
  /**
   * Отримати головний елемент дошки
   */
  getMainBoard() {
    return document.getElementById("board");
  },

  /**
   * Ініціалізація обробників перетягування на рівні дошки
   */
  initializeBoardDragHandlers(main) {
    if (main._dndInitialized) return;

    main._placeholder = null;
    main.addEventListener("dragover", (e) => this.handleBoardDragOver(e));
    main.addEventListener("dragleave", (e) => this.handleBoardDragLeave(e));
    main.addEventListener("drop", (e) => this.handleBoardDrop(e));
    main._dndInitialized = true;
  },

  /**
   * Обробник dragover для дошки (переміщення колон)
   */
  handleBoardDragOver(ev) {
    if (dragManager.state.type !== "column") return;

    ev.preventDefault();
    const main = ev.currentTarget;

    // Автоскролл при наведенні до меж
    const margin = 60;
    if (ev.clientY < margin) window.scrollBy(0, -20);
    else if (window.innerHeight - ev.clientY < margin) window.scrollBy(0, 20);

    // Знайти найближчу колону за X координатою
    const cols = Array.from(document.querySelectorAll(".column"));
    if (cols.length === 0) return;

    let closest = null;
    let minDist = Infinity;

    cols.forEach((c) => {
      const r = c.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const dx = Math.abs(ev.clientX - cx);
      if (dx < minDist) {
        minDist = dx;
        closest = c;
      }
    });

    if (!closest) return;

    // Показати індикатор
    document
      .querySelectorAll(".column")
      .forEach((c) => c.classList.remove("drop-target"));
    closest.classList.add("drop-target");

    // Показати позицію før/після на основі горизонтальної позиції
    this.clearPlaceholder();
    const ph = this.createPlaceholder();
    const rect = closest.getBoundingClientRect();

    if (ev.clientX - rect.left < rect.width / 2) {
      closest.parentNode.insertBefore(ph, closest);
    } else {
      closest.parentNode.insertBefore(ph, closest.nextSibling);
    }

    main._placeholder = ph;
  },

  /**
   * Обробник dragleave для дошки
   */
  handleBoardDragLeave(ev) {
    if (ev.currentTarget.contains(ev.relatedTarget)) return;
    this.clearPlaceholder();
    document
      .querySelectorAll(".column")
      .forEach((c) => c.classList.remove("drop-target"));
  },

  /**
   * Обробник drop для дошки
   */
  async handleBoardDrop(ev) {
    if (dragManager.state.type !== "column") return;

    ev.preventDefault();
    const main = ev.currentTarget;
    const ph = main._placeholder;

    if (!ph) {
      document
        .querySelectorAll(".column")
        .forEach((c) => c.classList.remove("drop-target"));
      return;
    }

    const draggedId = dragManager.state.columnId;
    const draggedEl = document.querySelector(
      '.column[data-id="' + draggedId + '"]',
    );

    if (draggedEl) {
      ph.parentNode.insertBefore(draggedEl, ph);
      const order = Array.from(document.querySelectorAll(".column")).map(
        (x) => x.dataset.id,
      );
      await reorderColumns(order);
    }

    this.clearPlaceholder();
    document
      .querySelectorAll(".column")
      .forEach((c) => c.classList.remove("drop-target"));
    dragManager.reset();
  },

  /**
   * Створити елемент для індикатора позиції
   */
  createPlaceholder() {
    const ph = document.createElement("div");
    ph.className = "drop-placeholder";
    return ph;
  },

  /**
   * Очистити індикатор позиції
   */
  clearPlaceholder() {
    const main = this.getMainBoard();
    if (main && main._placeholder) {
      try {
        main._placeholder.remove();
      } catch (e) {
        // ignore
      }
      main._placeholder = null;
    }
  },

  /**
   * Видалити всі елементи з дошки
   */
  clear() {
    const main = this.getMainBoard();
    main.innerHTML = "";
  },
};
