// Contract between the 3D table (src/three/**) and the page shell (pages/Game.tsx).
// The scene is a pure view: it renders the server snapshot and reports clicks. All rules, legality and
// selection state live outside it; the shell decides what glows and what a click means.
import type { Snapshot } from "../game/types";

export type Mode = "solo" | "mp";

export interface OrganRef {
  player: number;
  organ_id: string;
}

export interface LastAction {
  player: number;
  kind: "play" | "discard" | "pass";
  /** increments on every server `action` event so the scene can tell repeats apart */
  seq: number;
}

export interface TableSceneProps {
  snapshot: Snapshot;
  mode: Mode;

  /** selected hand card ids (lifted + glowing), max 3 */
  selection: string[];
  /** organ ids that glow as legal targets for the single selected card */
  targetOrgans: Set<string>;
  /** Transplant: first organ already picked (stays highlighted while the second is chosen) */
  pendingOrgan: string | null;
  /** Medical Error: player indices whose whole body glows as a target */
  targetPlayers: Set<number>;
  /** show the glowing empty slot in the viewer's organ row (organ card selected) */
  showGhostSlot: boolean;

  /** last server action; the scene diffs consecutive snapshots to animate it (only the played/discarded cards arc) */
  lastAction: LastAction | null;
  /** seat currently thinking (bot) — solo shows a thinking bubble on that seat tag */
  thinkingPlayer: number | null;
  /** multiplayer turn deadline (epoch ms) for the timer bar on the active seat tag; null = no timer */
  turnDeadline: number | null;
  /** pace multiplier for every animation duration: 1 normal, 1.7 relaxed, 0.45 fast */
  animSpeed: number;
  /** viewer's turn and the game is not over — hover lift and clicks are live */
  interactive: boolean;

  onHandCardClick(cardId: string): void;
  onOrganClick(ref: OrganRef): void;
  onPlayerClick(player: number): void;
  onGhostClick(): void;
  /** click on empty table: the shell clears the selection */
  onBackgroundClick(): void;
  /** where the viewer's hand band starts, as a fraction of canvas height from the bottom, so HTML hints sit above it */
  onLayout?(info: { handTopFrac: number }): void;
}
