/**
 * Card Renderer - рендеринг карт та обробня їхніх подій
 */

import { createElement } from "./dom-utils.js";
import { dragManager } from "./drag-manager.js";
import { reorderColumnCards } from "./api.js";

/**
 * Додати посилання до тексту в контейнер
 */
export function appendLinkedText(container, text) {
  const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    // Додати текст перед посиланням
    if (start > lastIndex) {
      container.appendChild(
        document.createTextNode(text.slice(lastIndex, start)),
      );
    }

    // Створити та додати посилання
    const anchor = document.createElement("a");
    anchor.href = match[0];
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.textContent = match[0];
    container.appendChild(anchor);

    lastIndex = end;
  }

  // Додати залишковий текст
  if (lastIndex < text.length) {
    container.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

/**
 * Створити елемент картки
 */
export function createCardElement(card, columnId, columnElement, onCardClick) {
  const cd = createElement("div", "card");
  cd.dataset.id = card.id;

  // === Drag Handle ===
  const dragHandle = createElement("button", "card-drag-handle");
  dragHandle.type = "button";
  dragHandle.draggable = true;
  dragHandle.title = "Drag card";
  dragHandle.setAttribute("aria-label", "Drag card");

  dragHandle.addEventListener("dragstart", (ev) => {
    ev.stopPropagation();
    dragManager.set("card", columnId, card.id);
    ev.dataTransfer.setData("text/plain", `card:${card.id}:${columnId}`);
    ev.dataTransfer.effectAllowed = "move";
  });

  dragHandle.addEventListener("dragend", () => {
    dragManager.reset();
  });

  // === Область картки для drop ===
  attachCardDropHandlers(cd, card, columnId, columnElement);

  // === Title ===
  const title = createElement("div", "title");
  if (card.icon) {
    const img = document.createElement("img");
    img.src = card.icon;
    img.className = "card-icon";
    img.crossOrigin = "anonymous";
    title.appendChild(img);
  }

  if (card.link) {
    const a = document.createElement("a");
    a.href = card.link;
    a.textContent = card.title;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    // Запобігти double-click edit при натисканню на посилання
    a.addEventListener(
      "dblclick",
      (ev) => {
        ev.stopPropagation();
      },
      true,
    );
    a.addEventListener("click", (ev) => {
      ev.stopPropagation();
    });
    title.appendChild(a);
  } else {
    // Якщо нема посилання - зробимо заголовок кліквим для двійного кліку
    const titleSpan = document.createElement("span");
    titleSpan.textContent = card.title;
    titleSpan.style.cursor = "pointer";
    titleSpan.addEventListener("click", (ev) => {
      ev.stopPropagation();
    });
    title.appendChild(titleSpan);
  }

  cd.appendChild(title);

  // === Description ===
  if (card.description) {
    const d = createElement("div", "desc");
    appendLinkedText(d, card.description);
    cd.appendChild(d);
  }

  // === Menu Button ===
  const menu = document.createElement("button");
  menu.className = "card-menu";
  menu.textContent = "⋯";
  menu.addEventListener("click", (ev) => {
    ev.stopPropagation();
    onCardClick(card);
  });

  // === Double-click to edit ===
  cd.addEventListener("dblclick", (ev) => {
    // Дозволити double-click на посиланні в заголовку без редагування
    if (ev.target.tagName === "A") return;
    onCardClick(card);
  });

  // === Append controls ===
  cd.appendChild(dragHandle);
  cd.appendChild(menu);

  return cd;
}

/**
 * Приєднати обробники drop для картки
 */
function attachCardDropHandlers(cardElement, card, columnId, columnElement) {
  cardElement.addEventListener("dragover", (ev) => {
    if (!dragManager.isCardDrag()) return;
    if (!dragManager.cardBelongsToColumn(columnId)) return;

    ev.preventDefault();
    ev.dataTransfer.dropEffect = "move";
    cardElement.classList.add("drag-over");
  });

  cardElement.addEventListener("dragleave", (ev) => {
    if (ev.target === cardElement) {
      cardElement.classList.remove("drag-over");
    }
  });

  cardElement.addEventListener("drop", async (ev) => {
    ev.stopPropagation();
    ev.preventDefault();
    cardElement.classList.remove("drag-over");

    if (!dragManager.isCardDrag()) return;
    if (!dragManager.cardBelongsToColumn(columnId)) return;

    const draggedCardId = dragManager.state.cardId;
    const draggedEl = document.querySelector(
      `.card[data-id="${draggedCardId}"]`,
    );

    if (!draggedEl || draggedEl === cardElement) return;

    // Поміняти картки місцями
    const parent = cardElement.parentNode;
    const draggedParent = draggedEl.parentNode;

    // Простий swap за допомогою тимчасового елемента
    const temp = document.createElement("div");
    draggedParent.insertBefore(temp, draggedEl);
    parent.insertBefore(draggedEl, cardElement);
    draggedParent.insertBefore(cardElement, temp);
    temp.remove();

    // Оновити порядок карт на сервері
    const order = Array.from(columnElement.querySelectorAll(".card")).map(
      (x) => x.dataset.id,
    );
    await reorderColumnCards(columnId, order);
  });
}

/**
 * Приєднати обробники drop для пустої зони колони
 */
export function attachColumnDropHandlers(columnElement, columnId) {
  columnElement.addEventListener("dragover", (ev) => {
    if (!dragManager.isCardDrag()) return;

    ev.preventDefault();
    ev.dataTransfer.dropEffect = "move";
  });

  columnElement.addEventListener("drop", async (ev) => {
    if (!dragManager.isCardDrag()) return;

    const draggedCardId = dragManager.state.cardId;
    const sourceColumnId = dragManager.state.columnId;
    ev.preventDefault();

    const draggedEl = document.querySelector(
      `.card[data-id="${draggedCardId}"]`,
    );
    if (!draggedEl) return;

    // Додати картку в кінець колони
    columnElement.appendChild(draggedEl);

    // Оновити порядок карт у дестинейшен колоні
    const order = Array.from(columnElement.querySelectorAll(".card")).map(
      (x) => x.dataset.id,
    );
    await reorderColumnCards(columnId, order);

    // Якщо картка була перенесена з іншої колони, оновити порядок там тобі
    if (sourceColumnId !== String(columnId)) {
      const sourceColumn = document.querySelector(
        `.column[data-id="${sourceColumnId}"]`,
      );
      if (sourceColumn) {
        const sourceOrder = Array.from(
          sourceColumn.querySelectorAll(".card"),
        ).map((x) => x.dataset.id);
        await reorderColumnCards(sourceColumnId, sourceOrder);
      }
    }
  });
}
