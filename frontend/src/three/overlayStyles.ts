// Seat plates, callouts and the card tooltip over the 3D canvas (the mock's CSS, scoped under .ap3d-stage).
export const OVERLAY_CSS = `
.ap3d-stage{position:relative;width:100%;height:100%;overflow:hidden;background:#0B1719;user-select:none;-webkit-user-select:none;touch-action:manipulation;
  --ap-display:"Bowlby One","Arial Black",Impact,sans-serif;--ap-body:"Atkinson Hyperlegible",system-ui,-apple-system,"Segoe UI",sans-serif;
  --ap-mono:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;--ap-lamp:#F2C14E;--ap-muted:#93A9A7;--ap-fg:#EAF0EA;
  font-family:var(--ap-body);color:var(--ap-fg)}
.ap3d-stage canvas{display:block}
.ap3d-layer{position:absolute;inset:0;pointer-events:none}
.ap3d-seat{position:absolute;transform:translate(-50%,-100%);pointer-events:none;white-space:nowrap}
.ap3d-seat.side-l{transform:translate(-100%,-50%)}
.ap3d-seat.side-r{transform:translate(0,-50%)}
.ap3d-plate{background:#0E1B1Ee6;border:1px solid #2E4A4F;border-radius:12px;padding:5px 10px 6px 6px;display:flex;align-items:center;gap:8px;box-shadow:0 6px 18px #0008}
.ap3d-plate .who{display:flex;flex-direction:column;align-items:flex-start;min-width:0}
.ap3d-plate b{font-family:var(--ap-display);font-weight:400;font-size:14px;letter-spacing:.02em;line-height:1.1}
.ap3d-plate small{font-family:var(--ap-mono);font-size:10.5px;color:var(--ap-muted)}
.ap3d-seat.active .ap3d-plate{border-color:var(--ap-lamp);box-shadow:0 0 0 3px #F2C14E33,0 6px 18px #0008}
.ap3d-av{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:11px;color:#fff;flex:none;border:2px solid #0006;position:relative}
.ap3d-tbar{display:block;height:3px;width:100%;margin-top:4px;border-radius:2px;background:#ffffff1f;overflow:hidden}
.ap3d-tbar i{display:block;height:100%;width:0;background:var(--ap-lamp)}
.ap3d-bubble{position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);background:#FFF8E6;color:#2A1E05;border-radius:14px;padding:6px 12px;font-weight:700;font-size:13px;box-shadow:0 6px 16px #0007;opacity:0;transition:opacity .2s}
.ap3d-bubble::after{content:"";position:absolute;left:50%;top:100%;border:7px solid transparent;border-top-color:#FFF8E6;transform:translateX(-50%)}
.ap3d-bubble.on{opacity:1}
.ap3d-dots i{display:inline-block;width:5px;height:5px;border-radius:50%;background:currentColor;margin:0 2px;animation:ap3d-blip 1s infinite}
.ap3d-dots i:nth-child(2){animation-delay:.15s}.ap3d-dots i:nth-child(3){animation-delay:.3s}
@keyframes ap3d-blip{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
.ap3d-callout{position:absolute;transform:translate(-50%,-50%);font-family:var(--ap-display);font-size:20px;color:#fff;-webkit-text-stroke:1px #0008;text-shadow:0 3px 0 #0009;animation:ap3d-rise 1.3s ease-out forwards;white-space:nowrap}
/* hold full strength, then fade quickly: a long dim tail reads as stray grey lettering on the felt */
@keyframes ap3d-rise{0%{opacity:0;transform:translate(-50%,-30%) scale(.6)}15%{opacity:1;transform:translate(-50%,-60%) scale(1.1)}72%{opacity:1;transform:translate(-50%,-125%) scale(1)}88%,100%{opacity:0;transform:translate(-50%,-150%) scale(1)}}
.ap3d-tip{position:absolute;z-index:20;max-width:230px;background:#FFFDF6;color:#1E1A10;border-radius:10px;padding:7px 10px;font-size:12.5px;line-height:1.35;box-shadow:0 8px 20px #0009;pointer-events:none}
.ap3d-tip b{display:block;font-size:13.5px}
@media (max-width:640px){
  .ap3d-plate{padding:4px 8px 4px 4px;gap:6px}
  .ap3d-plate b{font-size:12px}
  .ap3d-plate small{font-size:9.5px}
  .ap3d-av{width:22px;height:22px;font-size:9px}
}
@media (prefers-reduced-motion:reduce){.ap3d-stage *{animation-duration:.01ms!important;transition-duration:.01ms!important}}
`;
