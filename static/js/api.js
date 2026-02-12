export async function getState() {
  const response = await fetch("/api/state");
  return response.json();
}

export async function getSettings() {
  const response = await fetch("/api/settings");
  if (!response.ok) {
    return null;
  }
  return response.json();
}

export async function saveSettings(payload) {
  return fetch("/api/settings", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function createCard(payload) {
  return fetch("/api/card", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateCard(cardId, payload) {
  return fetch(`/api/card/${cardId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function removeCard(cardId) {
  return fetch(`/api/card/${cardId}`, { method: "DELETE" });
}

export async function createColumn(payload) {
  return fetch("/api/column", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateColumn(columnId, payload) {
  return fetch(`/api/column/${columnId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function removeColumn(columnId) {
  return fetch(`/api/column/${columnId}`, { method: "DELETE" });
}

export async function reorderColumnCards(columnId, order) {
  return fetch(`/api/column/${columnId}/reorder-cards`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ order }),
  });
}

export async function reorderColumns(order) {
  return fetch("/api/column/reorder", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ order }),
  });
}

export async function uploadBackground(file) {
  const formData = new FormData();
  formData.append("file", file);
  return fetch("/api/upload-bg", { method: "POST", body: formData });
}

export async function resetBackground() {
  return fetch("/api/settings/bg", { method: "DELETE" });
}

