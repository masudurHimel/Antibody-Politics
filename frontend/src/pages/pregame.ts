// Pure helpers for the pre-game screens (Home, Join, Lobby).
import type { RoomPlayerView } from "../game/types";

export const ROOM_CODE_LEN = 4;
export const NAME_MAX = 20;

/** Seat tints, matching the in-game multiplayer seat plates. */
export const SEAT_TINTS = ["#2FB67C", "#E8475F", "#3E86D6", "#8E5BC9"];

/** Whatever was typed or pasted → uppercase letters/digits, at most 4. */
export function normalizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, ROOM_CODE_LEN);
}

export function isCompleteRoomCode(code: string): boolean {
  return normalizeRoomCode(code) === code && code.length === ROOM_CODE_LEN;
}

/** "Ada Lovelace" → "AL"; falls back to "?" when the name has no letters. */
export function initials(name: string): string {
  const s = name
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return s || "?";
}

/** Status line under a lobby seat plate. `undefined` = empty seat. */
export function seatStatus(p: RoomPlayerView | undefined): string {
  if (!p) return "Bot joins at start";
  if (p.is_bot) return "Bot";
  const s = p.ready ? "Ready" : "Not ready";
  return p.connected ? s : `${s} · offline`;
}

const players = (n: number) => `${n} player${n === 1 ? "" : "s"}`;

/**
 * Why the host's Start button is disabled, or null when it can start.
 * Mirrors the server rule: every human, host included, must be ready.
 */
export function startBlockReason(list: RoomPlayerView[], mySeat: number | null): string | null {
  const notReady = list.filter((p) => !p.is_bot && !p.ready);
  if (notReady.length === 0) return null;
  const meWaiting = notReady.some((p) => p.seat === mySeat);
  const others = notReady.length - (meWaiting ? 1 : 0);
  if (meWaiting && others === 0) return "Tap “I'm ready” to start";
  if (meWaiting) return `Waiting for you and ${players(others)} to get ready`;
  return `Waiting for ${players(others)} to get ready`;
}
