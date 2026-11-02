import { describe, expect, it } from "vitest";
import { initials, isCompleteRoomCode, normalizeRoomCode, seatStatus, startBlockReason } from "./pregame";
import type { RoomPlayerView } from "../game/types";

const p = (seat: number, over: Partial<RoomPlayerView> = {}): RoomPlayerView => ({
  seat,
  name: `P${seat}`,
  is_host: seat === 0,
  is_bot: false,
  ready: false,
  connected: true,
  ...over,
});

describe("normalizeRoomCode", () => {
  it("uppercases, strips non-alphanumerics and caps at 4", () => {
    expect(normalizeRoomCode("ab-c d")).toBe("ABCD");
    expect(normalizeRoomCode(" x7k9q2 ")).toBe("X7K9");
    expect(normalizeRoomCode("")).toBe("");
  });
  it("isCompleteRoomCode needs exactly 4 normalised chars", () => {
    expect(isCompleteRoomCode("AB3D")).toBe(true);
    expect(isCompleteRoomCode("AB3")).toBe(false);
    expect(isCompleteRoomCode("ab3d")).toBe(false);
  });
});

describe("initials", () => {
  it("takes up to two word initials", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("ada b c")).toBe("AB");
    expect(initials("Zed")).toBe("Z");
  });
  it("falls back to ? when there are no letters", () => {
    expect(initials("123 !!")).toBe("?");
  });
});

describe("seatStatus", () => {
  it("covers empty, bot, ready, not ready and offline", () => {
    expect(seatStatus(undefined)).toBe("Bot joins at start");
    expect(seatStatus(p(1, { is_bot: true }))).toBe("Bot");
    expect(seatStatus(p(1, { ready: true }))).toBe("Ready");
    expect(seatStatus(p(1))).toBe("Not ready");
    expect(seatStatus(p(1, { connected: false }))).toBe("Not ready · offline");
  });
});

describe("startBlockReason", () => {
  it("is null when every human is ready (bots ignored)", () => {
    expect(startBlockReason([p(0, { ready: true }), p(1, { ready: true }), p(2, { is_bot: true })], 0)).toBeNull();
  });
  it("asks the host to get ready when only they are waiting", () => {
    expect(startBlockReason([p(0), p(1, { ready: true })], 0)).toBe("Tap “I'm ready” to start");
  });
  it("counts other players, singular and plural", () => {
    expect(startBlockReason([p(0, { ready: true }), p(1)], 0)).toBe("Waiting for 1 player to get ready");
    expect(startBlockReason([p(0, { ready: true }), p(1), p(2)], 0)).toBe("Waiting for 2 players to get ready");
  });
  it("mentions you and the others", () => {
    expect(startBlockReason([p(0), p(1)], 0)).toBe("Waiting for you and 1 player to get ready");
  });
});
