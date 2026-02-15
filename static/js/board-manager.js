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
    ev.dataTransfer.dropEffect = "move";
  },

  /**
   * Обробник dragleave для дошки
   */
  handleBoardDragLeave(ev) {
    // Нічого не робимо - swap відбувається при drop
  },

  /**
   * Обробник drop для дошки
   */
  async handleBoardDrop(ev) {
    if (dragManager.state.type !== "column") return;

    ev.preventDefault();
    const main = ev.currentTarget;

    const draggedId = dragManager.state.columnId;
    const draggedEl = document.querySelector(
      '.column[data-id="' + draggedId + '"]',
    );

    // Знайти найближчу колону за X координатою
    const cols = Array.from(document.querySelectorAll(".column")).filter(
      (c) => c.dataset.id !== draggedId,
    );
    if (cols.length === 0 || !draggedEl) {
      dragManager.reset();
      return;
    }

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

    if (closest && draggedEl !== closest) {
      // Поміняти колони місцями
      const parent = closest.parentNode;
      const draggedParent = draggedEl.parentNode;

      // Простий swap за допомогою тимчасового елемента
      const temp = document.createElement("div");
      draggedParent.insertBefore(temp, draggedEl);
      parent.insertBefore(draggedEl, closest);
      draggedParent.insertBefore(closest, temp);
      temp.remove();

      const order = Array.from(document.querySelectorAll(".column")).map(
        (x) => x.dataset.id,
      );
      await reorderColumns(order);
    }

    dragManager.reset();
  },



  /**
   * Видалити всі елементи з дошки
   */
  clear() {
    const main = this.getMainBoard();
    main.innerHTML = "";
  },
};
