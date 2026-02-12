from __future__ import annotations

from sqlalchemy import func, select

from app.extensions import db
from app.models import Card, Column


class BoardRepository:
    def get_state(self) -> dict:
        columns = db.session.scalars(select(Column).order_by(Column.position)).all()
        return {"columns": [column.to_dict(include_cards=True) for column in columns]}

    def add_card(
        self,
        *,
        title: str,
        column_id: int,
        link: str,
        description: str,
        icon: str,
    ) -> Card | None:
        column = db.session.get(Column, column_id)
        if not column:
            return None
        next_pos = self._next_card_position(column_id)
        card = Card(
            column_id=column_id,
            title=title,
            link=link,
            description=description,
            icon=icon,
            position=next_pos,
        )
        db.session.add(card)
        db.session.commit()
        return card

    def update_card(
        self,
        card_id: int,
        *,
        title: str | None,
        column_id: int | None,
        link: str | None,
        description: str | None,
        icon: str | None,
    ) -> tuple[Card | None, str | None]:
        card = db.session.get(Card, card_id)
        if not card:
            return None, "card_not_found"

        if column_id is not None and column_id != card.column_id:
            target_column = db.session.get(Column, column_id)
            if not target_column:
                return None, "column_not_found"
            card.position = self._next_card_position(column_id)
            card.column_id = column_id

        if title is not None:
            card.title = title
        if link is not None:
            card.link = link
        if description is not None:
            card.description = description
        if icon is not None:
            card.icon = icon

        db.session.commit()
        return card, None

    def delete_card(self, card_id: int) -> None:
        card = db.session.get(Card, card_id)
        if card:
            db.session.delete(card)
            db.session.commit()

    def add_column(self, name: str) -> Column:
        next_pos = self._next_column_position()
        column = Column(name=name, position=next_pos)
        db.session.add(column)
        db.session.commit()
        return column

    def update_column(self, col_id: int, name: str) -> Column | None:
        column = db.session.get(Column, col_id)
        if not column:
            return None
        column.name = name
        db.session.commit()
        return column

    def delete_column(self, col_id: int) -> None:
        column = db.session.get(Column, col_id)
        if column:
            db.session.delete(column)
            db.session.commit()

    def reorder_cards(self, col_id: int, order: list[int]) -> tuple[bool, str | None]:
        column = db.session.get(Column, col_id)
        if not column:
            return False, "column_not_found"

        cards = db.session.scalars(select(Card).where(Card.column_id == col_id)).all()
        cards_by_id = {card.id: card for card in cards}
        existing_ids = set(cards_by_id.keys())
        incoming_ids = set(order)

        if len(order) != len(incoming_ids):
            return False, "duplicate_ids"
        if incoming_ids != existing_ids:
            return False, "incomplete_or_invalid_order"

        for pos, card_id in enumerate(order):
            cards_by_id[card_id].position = pos
        db.session.commit()
        return True, None

    def reorder_columns(self, order: list[int]) -> tuple[bool, str | None]:
        columns = db.session.scalars(select(Column).where(Column.id.in_(order))).all()
        columns_by_id = {column.id: column for column in columns}
        existing_ids = set(db.session.scalars(select(Column.id)).all())
        incoming_ids = set(order)

        if len(order) != len(incoming_ids):
            return False, "duplicate_ids"
        if incoming_ids != existing_ids:
            return False, "incomplete_or_invalid_order"

        for pos, column_id in enumerate(order):
            columns_by_id[column_id].position = pos
        db.session.commit()
        return True, None

    def _next_column_position(self) -> int:
        value = db.session.scalar(select(func.max(Column.position)))
        return (value or -1) + 1

    def _next_card_position(self, column_id: int) -> int:
        value = db.session.scalar(
            select(func.max(Card.position)).where(Card.column_id == column_id)
        )
        return (value or -1) + 1
