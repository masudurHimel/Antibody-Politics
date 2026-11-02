// Tween easings from the mock: heroes overshoot with a back-ease, everything else glides with a cubic.
export type EaseName = "back" | "cubic";

export const EASE: Record<EaseName, (t: number) => number> = {
  back: (t) => {
    const c1 = 1.25,
      c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  cubic: (t) => 1 - Math.pow(1 - t, 3),
};
