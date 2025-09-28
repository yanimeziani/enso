from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest


@pytest.fixture()
def sample_thought(client):
    response = client.post(
        "/thoughts/",
        json={"title": "First", "content": "Brain dump", "tags": ["Work", "Focus"]},
    )
    assert response.status_code == 201
    return response.json()


def test_thought_crud_and_linking(client, sample_thought):
    created = sample_thought
    thought_id = created["id"]

    response = client.get("/thoughts/")
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 1
    assert items[0]["id"] == thought_id
    assert sorted(items[0]["tags"]) == ["focus", "work"]

    response = client.patch(
        f"/thoughts/{thought_id}",
        json={"title": "Updated", "links": []},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Updated"

    response = client.post(
        "/thoughts/",
        json={"title": "Second", "content": "Another note"},
    )
    assert response.status_code == 201
    other_id = response.json()["id"]

    response = client.post(f"/thoughts/{thought_id}/links/{other_id}")
    assert response.status_code == 200
    assert response.json()["links"] == [other_id]

    response = client.delete(f"/thoughts/{thought_id}/links/{other_id}")
    assert response.status_code == 200
    assert response.json()["links"] == []

    response = client.delete(f"/thoughts/{thought_id}")
    assert response.status_code == 204

    response = client.get("/thoughts/")
    assert response.status_code == 200
    remaining_ids = [item["id"] for item in response.json()]
    assert remaining_ids == [other_id]


def test_sync_flow(client, sample_thought):
    first_cursor_resp = client.post(
        "/sync/thoughts",
        json={"client_id": "device-a", "changes": []},
    )
    assert first_cursor_resp.status_code == 200
    initial_payload = first_cursor_resp.json()
    assert len(initial_payload["changes"]) == 1

    first_thought = initial_payload["changes"][0]
    new_timestamp = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    updated_change = {**first_thought, "content": "Updated offline", "updated_at": new_timestamp}

    second_resp = client.post(
        "/sync/thoughts",
        json={
            "client_id": "device-a",
            "since": initial_payload["cursor"],
            "changes": [updated_change],
        },
    )
    assert second_resp.status_code == 200
    sync_payload = second_resp.json()
    assert any(item["content"] == "Updated offline" for item in sync_payload["changes"])

    stale_change = {
        **updated_change,
        "content": "Stale overwrite",
        "updated_at": (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat(),
    }

    third_resp = client.post(
        "/sync/thoughts",
        json={
            "client_id": "device-a",
            "since": sync_payload["cursor"],
            "changes": [stale_change],
        },
    )
    assert third_resp.status_code == 200
    latest = third_resp.json()["changes"][0]
    assert latest["content"] == "Updated offline"

    delete_change = {
        **updated_change,
        "deleted_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
        "updated_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
    }

    final_resp = client.post(
        "/sync/thoughts",
        json={
            "client_id": "device-a",
            "since": third_resp.json()["cursor"],
            "changes": [delete_change],
        },
    )
    assert final_resp.status_code == 200
    final_changes = final_resp.json()["changes"]
    assert final_changes[0]["deleted_at"] is not None

    list_resp = client.get("/thoughts/")
    assert list_resp.status_code == 200
    assert list_resp.json() == []
