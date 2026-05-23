async function jsonOrThrow(r) {
    if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${r.status}`);
    }
    return r.json();
}
export async function createRoom(hostName) {
    const r = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host_name: hostName }),
    });
    return jsonOrThrow(r);
}
export async function joinRoom(roomId, name) {
    const r = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    return jsonOrThrow(r);
}
export async function getRoom(roomId) {
    const r = await fetch(`/api/rooms/${roomId}`);
    return jsonOrThrow(r);
}
export async function setReady(roomId, playerToken, ready) {
    await jsonOrThrow(await fetch(`/api/rooms/${roomId}/ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_token: playerToken, ready }),
    }));
}
export async function startRoom(roomId, playerToken) {
    return jsonOrThrow(await fetch(`/api/rooms/${roomId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_token: playerToken }),
    }));
}
export async function terminateRoom(roomId, playerToken) {
    await jsonOrThrow(await fetch(`/api/rooms/${roomId}/terminate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_token: playerToken }),
    }));
}
const TOKEN_KEY = (roomId) => `mp:${roomId}`;
export function storeToken(roomId, token) {
    localStorage.setItem(TOKEN_KEY(roomId), token);
}
export function loadToken(roomId) {
    return localStorage.getItem(TOKEN_KEY(roomId));
}
