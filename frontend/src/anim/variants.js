export const cardSpring = { type: "spring", damping: 16, stiffness: 240, mass: 0.7 };
export const dealVariants = {
    hidden: { y: -160, x: 0, opacity: 0, rotateZ: -20, rotateX: 30, scale: 0.7 },
    visible: (i) => ({
        y: 0,
        x: 0,
        opacity: 1,
        rotateZ: 0,
        rotateX: 0,
        scale: 1,
        transition: { delay: i * 0.08, type: "spring", damping: 16, stiffness: 220 },
    }),
};
export const handCardRest = (i, total) => {
    const offset = i - (total - 1) / 2;
    const spread = 9; // degrees per card
    const arc = 6; // vertical arc px
    return {
        rotateZ: offset * spread,
        y: Math.abs(offset) * arc,
    };
};
export const playFlightVariants = {
    rest: { scale: 1, y: 0, rotateZ: 0, rotateX: 0 },
    selected: {
        scale: 1.08,
        y: -22,
        rotateX: -12,
        rotateZ: 0,
        transition: cardSpring,
    },
    hover: { scale: 1.05, y: -14, rotateX: -8, transition: cardSpring },
    played: {
        scale: 0.4,
        opacity: 0,
        rotateZ: 360,
        transition: { duration: 0.6, ease: "easeIn" },
    },
};
export const winBurst = {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: [0, 1.2, 1], opacity: 1, transition: { duration: 0.8 } },
};
export const seatPulse = {
    idle: { scale: 1, opacity: 0.95 },
    active: {
        scale: [1, 1.025, 1],
        opacity: 1,
        transition: { repeat: Infinity, duration: 1.8, ease: "easeInOut" },
    },
};
export const fadeUp = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};
