/**
 * Drag Manager - централізоване управління станом перетягування
 */

export const dragManager = {
  state: {
    type: null, // 'column' | 'card' | null
    columnId: null,
    cardId: null,
  },

  /**
   * Встановити стан перетягування
   */
  set(type, columnId, cardId = null) {
    this.state = {
      type,
      columnId: String(columnId),
      cardId: cardId ? String(cardId) : null,
    };
  },

  /**
   * Скинути стан перетягування
   */
  reset() {
    this.state = { type: null, columnId: null, cardId: null };
  },

  /**
   * Перевірити, чи це перетягування карти
   */
  isCardDrag() {
    return this.state.type === "card";
  },

  /**
   * Перевірити, чи це перетягування колони
   */
  isColumnDrag() {
    return this.state.type === "column";
  },

  /**
   * Перевірити, чи карта належить до колони
   */
  cardBelongsToColumn(columnId) {
    return this.state.columnId === String(columnId);
  },
};
