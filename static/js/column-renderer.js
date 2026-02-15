/**
 * Column Renderer - рендеринг колон та обробка їхніх подій
 */

import { createElement } from "./dom-utils.js";
import { dragManager } from "./drag-manager.js";
import {
  createCardElement,
  attachColumnDropHandlers,
} from "./card-renderer.js";

/**
 * Створити елемент колони з картами
 */
export function createColumnElement(column, onCardClick) {
  const colElement = createElement("div", "column");
  colElement.dataset.id = column.id;

  // === Column Title (Draggable) ===
  const colTitle = createElement("div", "col-title", column.name);
  colTitle.draggable = true;

  colTitle.addEventListener("dragstart", (ev) => {
    dragManager.set("column", column.id);
    ev.dataTransfer.setData("text/plain", `column:${column.id}`);
    ev.dataTransfer.effectAllowed = "move";
  });

  colTitle.addEventListener("dragend", () => {
    dragManager.reset();
  });

  colElement.appendChild(colTitle);

  // === Cards in Column ===
  column.cards.forEach((card) => {
    const cardElement = createCardElement(
      card,
      column.id,
      colElement,
      onCardClick,
    );
    colElement.appendChild(cardElement);
  });

  // === Column-level drop handlers ===
  attachColumnDropHandlers(colElement, column.id);

  return colElement;
}
