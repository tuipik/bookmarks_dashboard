def test_app_starts_with_migrated_database(client):
    response = client.get("/api/state")
    assert response.status_code == 200
