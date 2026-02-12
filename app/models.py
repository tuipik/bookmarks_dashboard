from __future__ import annotations

from app.extensions import db


class Column(db.Model):
    __tablename__ = "columns"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    position = db.Column(db.Integer, nullable=False, default=0)
    cards = db.relationship(
        "Card",
        back_populates="column",
        cascade="all, delete-orphan",
        order_by="Card.position",
        passive_deletes=True,
    )

    def to_dict(self, include_cards: bool = True) -> dict:
        data = {"id": self.id, "name": self.name, "position": self.position}
        if include_cards:
            data["cards"] = [card.to_dict() for card in self.cards]
        return data


class Card(db.Model):
    __tablename__ = "cards"

    id = db.Column(db.Integer, primary_key=True)
    column_id = db.Column(
        db.Integer,
        db.ForeignKey("columns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = db.Column(db.String(200), nullable=False)
    link = db.Column(db.String(2048), nullable=False, default="")
    description = db.Column(db.String(2000), nullable=False, default="")
    icon = db.Column(db.String(2048), nullable=False, default="")
    position = db.Column(db.Integer, nullable=False, default=0, index=True)

    column = db.relationship("Column", back_populates="cards")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "column_id": self.column_id,
            "title": self.title,
            "link": self.link,
            "description": self.description,
            "icon": self.icon,
            "position": self.position,
        }


class Settings(db.Model):
    __tablename__ = "settings"
    __table_args__ = (db.CheckConstraint("id = 1", name="ck_settings_singleton"),)

    id = db.Column(db.Integer, primary_key=True, default=1)
    dashboard_title = db.Column(db.String(120), nullable=False, default="Start Dashboard")
    dashboard_bg_image = db.Column(db.String(2048), nullable=True)
    cols_per_row = db.Column(db.Integer, nullable=False, default=3)
    column_width = db.Column(db.Integer, nullable=False, default=320)
    card_height = db.Column(db.Integer, nullable=False, default=0)
    column_bg_color = db.Column(db.String(7), nullable=False, default="#ffffff")
    column_bg_opacity = db.Column(db.Float, nullable=False, default=1.0)
    card_bg_color = db.Column(db.String(7), nullable=False, default="#ffffff")
    card_bg_opacity = db.Column(db.Float, nullable=False, default=1.0)

    def to_dict(self) -> dict:
        return {
            "dashboard_title": self.dashboard_title,
            "dashboard_bg_image": self.dashboard_bg_image,
            "cols_per_row": self.cols_per_row,
            "column_width": self.column_width,
            "card_height": self.card_height,
            "column_bg_color": self.column_bg_color,
            "column_bg_opacity": self.column_bg_opacity,
            "card_bg_color": self.card_bg_color,
            "card_bg_opacity": self.card_bg_opacity,
        }
