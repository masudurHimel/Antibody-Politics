export type Color = "red" | "green" | "blue" | "yellow" | "multi";
export type CardType = "organ" | "virus" | "medicine" | "treatment";
export type TreatmentKind =
  | "transplant" | "organ_thief" | "contagion" | "latex_glove" | "medical_error";
export type OrganStatus = "free" | "vaccinated" | "infected" | "immunized";

export interface Card {
  id: string;
  type: CardType;
  color: Color;
  treatment_kind?: TreatmentKind | null;
}

export interface Organ {
  id: string;
  color: Color;
  attached: Card[];
  status: OrganStatus;
}

export interface PlayerView {
  idx: number;
  name: string;
  is_bot: boolean;
  hand: Card[] | null;
  hand_count: number;
  body: Organ[];
}

export interface Snapshot {
  game_id: string;
  viewer_idx: number;
  turn_idx: number;
  winner_idx: number | null;
  deck_count: number;
  discard_count: number;
  discard_top: Card | null;
  event_log: string[];
  players: PlayerView[];
}

export type RoomStatus = "lobby" | "playing" | "paused" | "ended";

export interface RoomPlayerView {
  seat: number;
  name: string;
  is_host: boolean;
  is_bot: boolean;
  ready: boolean;
  connected: boolean;
}

export interface RoomView {
  id: string;
  status: RoomStatus;
  game_id: string | null;
  players: RoomPlayerView[];
  paused_for: number[];
}

export type ServerEvent =
  | { type: "snapshot"; snapshot: Snapshot }
  | { type: "bot_thinking"; player: number; expected_ms: number }
  | { type: "human_thinking"; player: number; deadline_ms: number }
  | { type: "action"; player: number; kind: "play" | "discard" | "pass"; events: string[]; snapshot: Snapshot }
  | { type: "game_over"; winner_idx: number; snapshot: Snapshot }
  | { type: "room_state"; my_seat: number; room: RoomView }
  | { type: "paused"; waiting_for_seats: number[] }
  | { type: "resumed" }
  | { type: "terminated" }
  | { type: "error"; code: string; message: string };

export type ClientMessage =
  | { type: "play"; card_id: string; targets: Record<string, unknown> }
  | { type: "discard"; card_ids: string[] }
  | { type: "pass" }
  | { type: "pong" };
