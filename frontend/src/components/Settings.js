import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useStore } from "../game/store";
export function Settings() {
    const animSpeed = useStore((s) => s.animSpeed);
    const soundOn = useStore((s) => s.soundOn);
    return (_jsxs("div", { className: "space-y-2 text-sm", children: [_jsxs("label", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { children: "Animation speed" }), _jsx("input", { type: "range", min: 0.5, max: 1.5, step: 0.1, value: animSpeed, onChange: (e) => {
                            const v = Number(e.target.value);
                            localStorage.setItem("animSpeed", String(v));
                            useStore.setState({ animSpeed: v });
                        } })] }), _jsxs("label", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { children: "Sound" }), _jsx("input", { type: "checkbox", checked: soundOn, onChange: (e) => {
                            localStorage.setItem("soundOn", e.target.checked ? "1" : "0");
                            useStore.setState({ soundOn: e.target.checked });
                        } })] })] }));
}
