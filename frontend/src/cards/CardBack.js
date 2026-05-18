import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function CardBack({ h = "clamp(140px, 22vh, 200px)" }) {
    return (_jsx("div", { className: "relative overflow-hidden card-back-face backface-hidden", style: {
            height: h,
            aspectRatio: "2 / 3",
            borderRadius: `calc(${h} / 18)`,
        }, children: _jsxs("svg", { viewBox: "0 0 100 150", className: "absolute inset-0 w-full h-full", preserveAspectRatio: "xMidYMid meet", children: [_jsx("defs", { children: _jsxs("radialGradient", { id: "cb-glow", cx: "50%", cy: "38%", r: "60%", children: [_jsx("stop", { offset: "0%", stopColor: "rgba(255,255,255,0.35)" }), _jsx("stop", { offset: "100%", stopColor: "rgba(255,255,255,0)" })] }) }), _jsx("rect", { x: "6", y: "6", width: "88", height: "138", rx: "8", fill: "none", stroke: "rgba(255,255,255,0.45)", strokeWidth: "1.5" }), _jsx("rect", { x: "9", y: "9", width: "82", height: "132", rx: "6", fill: "none", stroke: "rgba(0,0,0,0.4)", strokeWidth: "1" }), _jsxs("g", { transform: "translate(50 62)", children: [Array.from({ length: 10 }).map((_, i) => {
                            const a = (i / 10) * Math.PI * 2;
                            const x1 = Math.cos(a) * 18, y1 = Math.sin(a) * 18;
                            const x2 = Math.cos(a) * 28, y2 = Math.sin(a) * 28;
                            return (_jsxs("g", { children: [_jsx("line", { x1: x1, y1: y1, x2: x2, y2: y2, stroke: "#fbf6ec", strokeWidth: "2.4", strokeLinecap: "round" }), _jsx("circle", { cx: x2, cy: y2, r: "2.6", fill: "#fbf6ec" })] }, i));
                        }), _jsx("circle", { r: "18", fill: "#fbf6ec" }), _jsx("circle", { cx: "-6", cy: "-3", r: "2.6", fill: "#7a0e15" }), _jsx("circle", { cx: "6", cy: "-3", r: "2.6", fill: "#7a0e15" }), _jsx("path", { d: "M-6 6 Q 0 10 6 6", fill: "none", stroke: "#7a0e15", strokeWidth: "2.2", strokeLinecap: "round" })] }), _jsx("text", { x: "50", y: "118", textAnchor: "middle", fill: "#fbf6ec", fontSize: "14", fontWeight: "900", letterSpacing: "3", fontFamily: "'Bungee', sans-serif", children: "VIRUS!" }), _jsx("text", { x: "50", y: "132", textAnchor: "middle", fill: "rgba(255,255,255,0.65)", fontSize: "6.5", fontWeight: "700", letterSpacing: "2", children: "ANTIBODY POLITICS" }), _jsx("rect", { x: "0", y: "0", width: "100", height: "150", fill: "url(#cb-glow)" })] }) }));
}
