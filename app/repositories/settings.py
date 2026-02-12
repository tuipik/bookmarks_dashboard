from __future__ import annotations

from app.extensions import db
from app.models import Settings


class SettingsRepository:
    def get(self) -> Settings | None:
        return db.session.get(Settings, 1)

    def update(self, updates: dict) -> Settings | None:
        settings = self.get()
        if not settings:
            return None
        for key, value in updates.items():
            setattr(settings, key, value)
        db.session.commit()
        return settings

    def set_background(self, url: str) -> str | None:
        settings = self.get()
        if not settings:
            return None
        previous = settings.dashboard_bg_image
        settings.dashboard_bg_image = url
        db.session.commit()
        return previous

    def clear_background(self) -> str | None:
        settings = self.get()
        if not settings:
            return None
        previous = settings.dashboard_bg_image
        settings.dashboard_bg_image = None
        db.session.commit()
        return previous
