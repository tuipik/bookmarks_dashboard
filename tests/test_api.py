from io import BytesIO


def test_index_page_available(client):
    res = client.get("/")
    assert res.status_code == 200
    assert "Start Dashboard" in res.get_data(as_text=True)


def test_default_state_has_columns(client):
    res = client.get("/api/state")
    assert res.status_code == 200
    payload = res.get_json()
    assert "columns" in payload
    assert len(payload["columns"]) >= 3


def test_add_update_delete_card_flow(client):
    state = client.get("/api/state").get_json()
    col_id = state["columns"][0]["id"]

    created = client.post(
        "/api/card",
        json={
            "title": "Docs",
            "column_id": col_id,
            "link": "https://example.com",
            "description": "Example card",
            "icon": "https://example.com/icon.png",
        },
    )
    assert created.status_code == 201
    card = created.get_json()
    assert card["title"] == "Docs"

    updated = client.put(
        f"/api/card/{card['id']}",
        json={"title": "Docs Updated", "column_id": col_id},
    )
    assert updated.status_code == 200
    assert updated.get_json()["title"] == "Docs Updated"

    deleted = client.delete(f"/api/card/{card['id']}")
    assert deleted.status_code == 204


def test_column_reorder_validates_payload(client):
    bad = client.post("/api/column/reorder", json={"order": "not-list"})
    assert bad.status_code == 400
    payload = bad.get_json()
    assert payload["error"]["message"] == "'order' must be a list"


def test_settings_validation_rejects_invalid_color(client):
    res = client.put("/api/settings", json={"column_bg_color": "red"})
    assert res.status_code == 400
    payload = res.get_json()
    assert "hex color" in payload["error"]["message"]


def test_reorder_cards_rejects_partial_payload(client):
    state = client.get("/api/state").get_json()
    col = state["columns"][0]
    col_id = col["id"]
    first = client.post("/api/card", json={"title": "One", "column_id": col_id}).get_json()
    second = client.post("/api/card", json={"title": "Two", "column_id": col_id}).get_json()

    res = client.post(f"/api/column/{col_id}/reorder-cards", json={"order": [first["id"]]})
    assert res.status_code == 400
    assert "exactly once" in res.get_json()["error"]["message"]

    # keep variables used to avoid lint complaints about setup artifacts
    assert second["id"] != first["id"]


def test_upload_bg_rejects_non_image_content(client):
    fake_file = (BytesIO(b"not-an-image"), "bg.png")
    res = client.post(
        "/api/upload-bg",
        data={"file": fake_file},
        content_type="multipart/form-data",
    )
    assert res.status_code == 400
    assert "invalid image content" in res.get_json()["error"]["message"]
