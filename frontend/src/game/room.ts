import type { RoomView } from "./types";

export interface CreateRoomResult {
  room_id: string;
  player_token: string;
  seat: number;
  ws_url: string;
}

export interface JoinRoomResult {
  player_token: string;
  seat: number;
  ws_url: string;
}

async function jsonOrThrow<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.detail ?? `HTTP ${r.status}`);
  }
  return r.json();
}

export async function createRoom(hostName: string): Promise<CreateRoomResult> {
  const r = await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host_name: hostName }),
  });
  return jsonOrThrow<CreateRoomResult>(r);
}

export async function joinRoom(roomId: string, name: string): Promise<JoinRoomResult> {
  const r = await fetch(`/api/rooms/${roomId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return jsonOrThrow<JoinRoomResult>(r);
}

export async function getRoom(roomId: string): Promise<RoomView> {
  const r = await fetch(`/api/rooms/${roomId}`);
  return jsonOrThrow<RoomView>(r);
}

export async function setReady(
  roomId: string,
  playerToken: string,
  ready: boolean,
): Promise<void> {
  await jsonOrThrow(
    await fetch(`/api/rooms/${roomId}/ready`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_token: playerToken, ready }),
    }),
  );
}

export async function startRoom(
  roomId: string,
  playerToken: string,
): Promise<{ game_id: string }> {
  return jsonOrThrow(
    await fetch(`/api/rooms/${roomId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_token: playerToken }),
    }),
  );
}

export async function terminateRoom(roomId: string, playerToken: string): Promise<void> {
  await jsonOrThrow(
    await fetch(`/api/rooms/${roomId}/terminate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_token: playerToken }),
    }),
  );
}

const TOKEN_KEY = (roomId: string) => `mp:${roomId}`;

export function storeToken(roomId: string, token: string): void {
  localStorage.setItem(TOKEN_KEY(roomId), token);
}

export function loadToken(roomId: string): string | null {
  return localStorage.getItem(TOKEN_KEY(roomId));
}
