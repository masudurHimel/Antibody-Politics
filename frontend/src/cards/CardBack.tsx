export function CardBack({ h = "clamp(140px, 22vh, 200px)" }: { h?: string }) {
  return (
    <div
      className="relative overflow-hidden card-back-face backface-hidden"
      style={{
        height: h,
        aspectRatio: "2 / 3",
        borderRadius: `calc(${h} / 18)`,
      }}
    >
      <svg viewBox="0 0 100 150" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="cb-glow" cx="50%" cy="38%" r="60%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        <rect x="6" y="6" width="88" height="138" rx="8" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
        <rect x="9" y="9" width="82" height="132" rx="6" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="1" />

        <g transform="translate(50 62)">
          {Array.from({ length: 10 }).map((_, i) => {
            const a = (i / 10) * Math.PI * 2;
            const x1 = Math.cos(a) * 18, y1 = Math.sin(a) * 18;
            const x2 = Math.cos(a) * 28, y2 = Math.sin(a) * 28;
            return (
              <g key={i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fbf6ec" strokeWidth="2.4" strokeLinecap="round" />
                <circle cx={x2} cy={y2} r="2.6" fill="#fbf6ec" />
              </g>
            );
          })}
          <circle r="18" fill="#fbf6ec" />
          <circle cx="-6" cy="-3" r="2.6" fill="#7a0e15" />
          <circle cx="6" cy="-3" r="2.6" fill="#7a0e15" />
          <path d="M-6 6 Q 0 10 6 6" fill="none" stroke="#7a0e15" strokeWidth="2.2" strokeLinecap="round" />
        </g>

        <text x="50" y="118" textAnchor="middle" fill="#fbf6ec" fontSize="14" fontWeight="900" letterSpacing="3" fontFamily="'Bungee', sans-serif">
          VIRUS!
        </text>
        <text x="50" y="132" textAnchor="middle" fill="rgba(255,255,255,0.65)" fontSize="6.5" fontWeight="700" letterSpacing="2">
          ANTIBODY POLITICS
        </text>

        <rect x="0" y="0" width="100" height="150" fill="url(#cb-glow)" />
      </svg>
    </div>
  );
}
