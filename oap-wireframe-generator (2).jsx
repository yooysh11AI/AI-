import { useState, useCallback, useEffect, useRef } from "react";

// ════════════════════════════════════════════════════════════════
// §1  DESIGN TOKENS  (Proxy — 전역 테마 실시간 반영)
// ════════════════════════════════════════════════════════════════
let _T = {
  // ── Colors ───────────────────────────────────────────────────
  bg:"#0A0B0F", bgAlt:"#12141A", surface:"#1A1D26",
  line:"#2A2E3B", lineSoft:"#1F222C",
  text:"#E8EAF0", textDim:"#8A8F9E", textMute:"#545A6B",
  accent:"#D4FF00", accent2:"#00E5FF", accent3:"#FF3366",
  ok:"#34D399", warn:"#FFB020",
  // ── Typography metrics ───────────────────────────────────────
  displayScale: 1.0,          // H1 크기 배수 (0.5~1.5)
  displayTracking: "-0.005em",// H1 자간
  eyebrowSize: 14,             // // 레이블 폰트 크기
  eyebrowTracking: "0.3em",   // // 레이블 자간
  // ── Component style ──────────────────────────────────────────
  markShape: "pentagon",       // pentagon|square|diamond|circle|hexagon
  bgGradient: true,            // 배경 ambient 그라디언트 on/off
  titleAlign: "left",          // "left" | "center"
  eyebrowSlash: true,          // eyebrow 앞 "// " 표시 여부
};
let _F = {
  display:"'Bebas Neue','Archivo Narrow',sans-serif",
  narrow: "'Archivo Narrow',sans-serif",
  mono:   "'JetBrains Mono',monospace",
};
// Proxy → 모든 컴포넌트의 T.xxx / F.xxx 가 항상 현재 테마를 읽음
const T = new Proxy({}, { get:(_,k)=>_T[k] });

// ── UI 고정 컬러/폰트 (인터페이스 전용, 테마에 영향 받지 않음) ────
// 사용자가 Design System에서 토큰을 바꿔도 설정 UI 크롬은 항상 고정
const UI = Object.freeze({
  bg:"#0A0B0F", bgAlt:"#12141A", surface:"#1A1D26",
  line:"#2A2E3B", lineSoft:"#1F222C",
  text:"#E8EAF0", textDim:"#8A8F9E", textMute:"#545A6B",
  accent:"#D4FF00", accent2:"#00E5FF", accent3:"#FF3366",
  ok:"#34D399", warn:"#FFB020",
});
const UI_F = Object.freeze({
  display: "'Bebas Neue','Archivo Narrow',sans-serif",
  narrow:  "'Archivo Narrow',sans-serif",
  mono:    "'JetBrains Mono',monospace",
});
const F = new Proxy({}, { get:(_,k)=>_F[k] });

// Google Fonts 초기 로드
if (typeof document !== "undefined" && !document.getElementById("oap-gf")) {
  const l = document.createElement("link");
  l.id = "oap-gf"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;700&family=Archivo+Narrow:wght@400;700&display=swap";
  document.head.appendChild(l);
}

// ════════════════════════════════════════════════════════════════
// §2  UTILITIES
// ════════════════════════════════════════════════════════════════
function darken(hex, amt = 80) {
  const h = hex.replace("#","").padEnd(6,"0");
  const r = Math.max(0, parseInt(h.slice(0,2),16)-amt);
  const g = Math.max(0, parseInt(h.slice(2,4),16)-amt);
  const b = Math.max(0, parseInt(h.slice(4,6),16)-amt);
  return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
}
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

// ════════════════════════════════════════════════════════════════
// §3  SCALE WRAPPER  (올바른 스케일링 — transform + overflow 조합)
// ════════════════════════════════════════════════════════════════
// Canvas는 항상 1920×1080으로 렌더. ScaleWrapper가 외부에서 축소.
function ScaleWrapper({ scale, children }) {
  const pw = Math.round(1920 * scale);
  const ph = Math.round(1080 * scale);
  return (
    <div style={{ width:pw, height:ph, overflow:"hidden", position:"relative", flexShrink:0 }}>
      <div style={{ width:1920, height:1080, transformOrigin:"top left",
                    transform:`scale(${scale})`, position:"absolute", top:0, left:0 }}>
        {children}
      </div>
    </div>
  );
}

// ResizeObserver로 컨테이너에 꽉 맞는 scale 자동 계산
function AutoScaleCanvas({ Comp, data, layout, padX=32, padY=32 }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.4);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width === 0 || height === 0) return; // 0×0 리포트 무시 (마운트 초기/숨김 상태)
      setScale(Math.max(0.05, Math.min((width-padX*2)/1920, (height-padY*2)/1080)));
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [padX, padY]);
  return (
    <div ref={ref} style={{ width:"100%", height:"100%", display:"flex",
                             justifyContent:"center", alignItems:"center" }}>
      <ScaleWrapper scale={scale}>
        <Comp data={data} layout={layout}/>
      </ScaleWrapper>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// §4  CANVAS + CHROME  (1920×1080 고정 렌더)
// ════════════════════════════════════════════════════════════════
function Canvas({ children, layout }) {
  const { showSafeArea, showGrid, gridCols } = layout;
  return (
    <div style={{ width:1920, height:1080, background:T.bg, color:T.text,
                  fontFamily:F.narrow, position:"relative", overflow:"hidden" }}>
      {/* grain */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none",
                    backgroundImage:"radial-gradient(rgba(255,255,255,0.018) 1px,transparent 1px)",
                    backgroundSize:"4px 4px" }}/>
      {/* ambient */}
      {_T.bgGradient !== false && <div style={{ position:"absolute", inset:0, pointerEvents:"none",
                    background:`radial-gradient(ellipse at 15% 110%,${T.accent}12,transparent 55%)` }}/>}
      {/* safe area guide */}
      {showSafeArea && (
        <div style={{ position:"absolute", top:"10%", bottom:"10%", left:"6%", right:"6%",
                      border:"1px dashed rgba(0,229,255,0.5)", pointerEvents:"none", zIndex:80 }}>
          <span style={{ fontFamily:F.mono, fontSize:14, color:"rgba(0,229,255,0.7)",
                         position:"absolute", top:6, left:10, letterSpacing:"0.15em" }}>
            SAFE AREA 88%×80%
          </span>
        </div>
      )}
      {/* grid guide */}
      {showGrid && (
        <>
          {/* 세로 컬럼 */}
          {Array.from({length:gridCols}).map((_,i) => (
            <div key={`c${i}`} style={{
              position:"absolute", top:0, bottom:0, pointerEvents:"none", zIndex:79,
              left:`${(i/gridCols)*100}%`, width:`${(1/gridCols)*100}%`,
              background:"rgba(212,255,0,0.03)",
              borderRight:"1px solid rgba(212,255,0,0.14)",
            }}/>
          ))}
          {/* 가로 행 */}
          {Array.from({length:layout.gridRows||6}).map((_,i) => (
            <div key={`r${i}`} style={{
              position:"absolute", left:0, right:0, pointerEvents:"none", zIndex:79,
              top:`${(i/(layout.gridRows||6))*100}%`, height:`${(1/(layout.gridRows||6))*100}%`,
              background:"rgba(212,255,0,0.015)",
              borderBottom:"1px solid rgba(212,255,0,0.10)",
            }}/>
          ))}
          {/* 교차점 강조 (원점 마커) */}
          <div style={{
            position:"absolute", inset:0, pointerEvents:"none", zIndex:79,
            backgroundImage:`radial-gradient(circle, rgba(212,255,0,0.25) 1px, transparent 1px)`,
            backgroundSize:`${(1920/(gridCols))}px ${(1080/(layout.gridRows||6))}px`,
          }}/>
        </>
      )}
      {children}
    </div>
  );
}

function Chrome({ league, right, bottom, layout }) {
  const { marginH, marginV, showHeader=true, showFooter=true } = layout;
  return (
    <>
      {showHeader && (
        <>
          <div style={{ position:"absolute", top:marginV, left:marginH,
                        display:"flex", alignItems:"center", gap:18 }}>
            <div style={{ width:38, height:38, background:T.accent, flexShrink:0,
                          clipPath:"polygon(0 0,100% 0,100% 70%,70% 100%,0 100%)" }}/>
            <div>
              <div style={{ fontFamily:F.display, fontSize:26, color:T.text,
                            lineHeight:1, letterSpacing:"0.02em" }}>{league}</div>
              <div style={{ fontFamily:F.mono, fontSize:11, color:T.textMute,
                            letterSpacing:"0.22em", marginTop:5 }}>OAP · BROADCAST GRAPHICS</div>
            </div>
          </div>
          <div style={{ position:"absolute", top:marginV, right:marginH, textAlign:"right",
                        fontFamily:F.mono, fontSize:12, color:T.textMute,
                        letterSpacing:"0.2em", lineHeight:1.8 }}>
            {right?.split("\n").map((l,i) => <div key={i}>{l}</div>)}
          </div>
        </>
      )}
      {showFooter && (
        <>
          <div style={{ position:"absolute", bottom:marginV+48, left:marginH, right:marginH,
                        height:2, background:T.accent, opacity:0.7 }}/>
          <div style={{ position:"absolute", bottom:marginV, left:marginH, right:marginH,
                        display:"flex", justifyContent:"space-between",
                        fontFamily:F.mono, fontSize:11, color:T.textMute, letterSpacing:"0.2em" }}>
            <span>{bottom}</span>
            <span>1920×1080 · SAFE 88%×80%</span>
          </div>
        </>
      )}
    </>
  );
}

const MARK_SHAPES = {
  pentagon: "polygon(0 0,100% 0,100% 70%,70% 100%,0 100%)",
  square:   null,
  diamond:  "polygon(50% 0%,100% 50%,50% 100%,0% 50%)",
  hexagon:  "polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)",
  circle:   "circle(50% at 50% 50%)",
};
function TeamMark({ color, initial, size=80, fs=44 }) {
  const cp = MARK_SHAPES[_T.markShape] ?? MARK_SHAPES.pentagon;
  return (
    <div style={{ width:size, height:size, flexShrink:0,
                  background:`linear-gradient(135deg,${color},${darken(color)})`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontFamily:F.display, fontSize:fs, color:"#fff", lineHeight:1,
                  ...(cp ? {clipPath:cp} : {}) }}>
      {initial}
    </div>
  );
}
const Eyebrow = ({ t }) => {
  // t에서 "// " 접두사를 제거하고, _T.eyebrowSlash 토큰으로 제어
  const clean = t.replace(/^\/\/ ?/, "");
  const prefix = _T.eyebrowSlash !== false ? "// " : "";
  return (
    <div style={{ fontFamily:F.mono, fontSize:_T.eyebrowSize, color:T.accent,
                  letterSpacing:_T.eyebrowTracking, marginBottom:14,
                  textAlign:_T.titleAlign||"left" }}>
      {prefix}{clean}
    </div>
  );
};
const H1 = ({ children, size=108 }) => (
  <div style={{ fontFamily:F.display,
                fontSize: Math.round(size * (_T.displayScale ?? 1)),
                color:T.text, lineHeight:0.9,
                letterSpacing:_T.displayTracking,
                textAlign:_T.titleAlign||"left" }}>{children}</div>
);

// ── TitleBlock: 타이틀 정렬 토큰 반영 helper ────────────────
function TitleBlock({ eyebrow, title, size=108, layout }) {
  const { titleTop, marginH } = layout;
  const center = _T.titleAlign === "center";
  return (
    <div style={{
      position:"absolute", top:titleTop,
      ...(center
        ? { left:"50%", transform:"translateX(-50%)", textAlign:"center" }
        : { left:marginH }
      ),
    }}>
      {eyebrow && <Eyebrow t={eyebrow}/>}
      <H1 size={size}>{title}</H1>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// §5  DEFAULT DATA
// ════════════════════════════════════════════════════════════════
const DEFAULT_DATA = {
  scoreboard:{
    league:"K-LEAGUE CHAMPIONSHIP", day:2, match:5, format:"BO5",
    status:"FINAL", timecode:"00:29:30",
    teams:[
      { name:"KWANGDONG", short:"KDF", color:"#E53935", initial:"K", score:3 },
      { name:"SUWON",     short:"SBW", color:"#1E40AF", initial:"S", score:2 },
    ],
    sets:[[2,1],[3,2],[1,2],[2,0],[0,2]],
  },
  nextMatch:{
    league:"K-LEAGUE CHAMPIONSHIP", dayLabel:"DAY 03 · 2026.12.03",
    matches:[
      {home:{name:"ABLE",           color:"#7C3AED",initial:"A"},away:{name:"WHGAMING",   color:"#CA8A04",initial:"W"},time:"17:00"},
      {home:{name:"ULSAN HYUNDAI",  color:"#0891B2",initial:"U"},away:{name:"GANGWON FC",  color:"#EA580C",initial:"G"},time:"18:30"},
      {home:{name:"SUWON BLUEWINGS",color:"#1E40AF",initial:"S"},away:{name:"INCHEON UTD", color:"#15803D",initial:"I"},time:"20:00"},
      {home:{name:"MIRAE SE",       color:"#059669",initial:"M"},away:{name:"GWANGJU FC",  color:"#B91C1C",initial:"G"},time:"21:30"},
    ],
  },
  overview:{
    league:"K-LEAGUE CHAMPIONSHIP", subtitle:"PARTICIPATING TEAMS · SEASON 2",
    teams:[
      {name:"ELITE",            short:"ELT",color:"#CA8A04",initial:"E"},
      {name:"KWANGDONG FREECS", short:"KDF",color:"#E53935",initial:"K"},
      {name:"KT ROLSTER",       short:"KT", color:"#B91C1C",initial:"R"},
      {name:"MIRAE SE",         short:"MSE",color:"#059669",initial:"M"},
      {name:"ABLE",             short:"ABL",color:"#7C3AED",initial:"A"},
      {name:"SUWON BLUEWINGS",  short:"SBW",color:"#1E40AF",initial:"S"},
      {name:"POSCO STEELERS",   short:"PSL",color:"#4B5563",initial:"P"},
      {name:"ULSAN HYUNDAI",    short:"UHD",color:"#0891B2",initial:"U"},
    ],
  },
  roster:{
    league:"K-LEAGUE CHAMPIONSHIP",
    team:{ name:"SUWON BLUEWINGS", short:"SBW", color:"#1E40AF", initial:"S" },
    players:[
      {name:"KIM GYEONWOO", handle:"GYEON", position:"MID",number:7, captain:true},
      {name:"LEE JUNHO",    handle:"JUNHO", position:"FW", number:11},
      {name:"PARK MINHO",   handle:"MINHO", position:"DF", number:4},
      {name:"CHOI SEJIN",   handle:"SEJIN", position:"GK", number:1},
      {name:"JUNG HYUNSU",  handle:"HYUNSU",position:"MID",number:8},
      {name:"HAN TAEYOUNG", handle:"TAEY",  position:"FW", number:9},
      {name:"OH DONGHYUN",  handle:"DONG",  position:"DF", number:3},
      {name:"SEO MINJUN",   handle:"MINJ",  position:"MID",number:6},
    ],
  },
  prediction:{
    league:"K-LEAGUE CHAMPIONSHIP",
    matchup:{
      home:{ name:"KWANGDONG", color:"#E53935", initial:"K" },
      away:{ name:"SUWON",     color:"#1E40AF", initial:"S" },
      format:"BO5",
    },
    casters:[
      {name:"ANA", pick:"home",score:"3:1"},{name:"KIM",  pick:"home",score:"3:1"},
      {name:"LEE", pick:"home",score:"3:2"},{name:"PARK", pick:"away",score:"2:3"},
      {name:"JUN", pick:"home",score:"3:0"},{name:"SEO",  pick:"away",score:"1:3"},
      {name:"YOON",pick:"home",score:"3:2"},
    ],
  },
  lowerThird:{
    league:"K-LEAGUE CHAMPIONSHIP",
    variant:"player",
    player:{ name:"KIM GYEONWOO", handle:"GYEON", position:"MID", number:7,
             team:"KWANGDONG FREECS", teamShort:"KDF", teamColor:"#E53935", teamInitial:"K" },
    caster:{ name:"PARK JUNHO", role:"MAIN CASTER", org:"NEXON" },
    teamCallout:{ name:"KWANGDONG FREECS", short:"KDF", color:"#E53935", initial:"K", tagline:"GROUP A · SEED 1" },
    event:{ headline:"ROUND 03 COMPLETE", sub:"MOVING TO ROUND 04 · 15 TEAMS REMAIN", accent:"#D4FF00" },
  },
  schedule:{
    league:"PUBG GLOBAL CHAMPIONSHIP",
    title:"SCHEDULE",
    subtitle:"PGC 2025",
    yearMonth:"2025.11",  // YYYY.MM — 이 연월 기준으로 자동 생성
    startDay:24,          // 이 날짜가 포함된 주(월요일)부터 시작
    numWeeks:3,           // 보여줄 주 수 (2~5)
    stages:[
      { name:"GROUP STAGE",  start:"2025.11.28", end:"2025.12.03", color:"#FFFFFF", textColor:"#0A0B0F" },
      { name:"LAST STAGE",   start:"2025.12.05", end:"2025.12.07", color:"#CA8A04", textColor:"#0A0B0F" },
      { name:"GRAND FINALS", start:"2025.12.12", end:"2025.12.14", color:"#E53935", textColor:"#FFFFFF" },
    ],
  },
  tournamentFormat:{
    league:"PUBG GLOBAL CHAMPIONSHIP",
    title:"FORMAT",
    subtitle:"PGC 2025",
    phases:[
      {
        name:"GROUP STAGE", date:"11.28 — 12.03", color:"#2A2E3B",
        groups:[
          { name:"GROUP A", totalSlots:16, advanceSlots:5 },
          { name:"GROUP B", totalSlots:16, advanceSlots:5 },
        ],
      },
      {
        name:"LAST STAGE",    date:"12.05 — 12.07", color:"#CA8A04",
        totalSlots:16, advanceSlots:5,
      },
      {
        name:"GRAND FINALS",  date:"12.12 — 12.14", color:"#E53935",
        totalSlots:16,
      },
    ],
  },
  brLeaderboard:{
    league:"K-LEAGUE CHAMPIONSHIP", round:3, totalRounds:6,
    pointSystem:"PLACEMENT + KILLS",
    advanceZone:3, safeZone:10, dangerZone:14,
    teams:[
      {rank:1, name:"FULL SENSE",     short:"FLS",region:"AS",color:"#E53935",initial:"F",kills:14,placement:15,total:29,trend:"up"},
      {rank:2, name:"GEN.G",          short:"GNG",region:"AS",color:"#CA8A04",initial:"G",kills:9, placement:13,total:22,trend:"up"},
      {rank:3, name:"T1",             short:"T1", region:"AS",color:"#1E40AF",initial:"T",kills:11,placement:10,total:21,trend:"same"},
      {rank:4, name:"TEAM FALCONS",   short:"FAL",region:"ME",color:"#059669",initial:"F",kills:7, placement:13,total:20,trend:"down"},
      {rank:5, name:"FAZE CLAN",      short:"FAZ",region:"EU",color:"#7C3AED",initial:"F",kills:10,placement:9, total:19,trend:"up"},
      {rank:6, name:"TEAM LIQUID",    short:"LIQ",region:"AM",color:"#0891B2",initial:"L",kills:6, placement:12,total:18,trend:"same"},
      {rank:7, name:"VIRTUS.PRO",     short:"VP", region:"EU",color:"#DB2777",initial:"V",kills:8, placement:9, total:17,trend:"down"},
      {rank:8, name:"NATUS VINCERE",  short:"NaV",region:"EU",color:"#CA8A04",initial:"N",kills:5, placement:11,total:16,trend:"same"},
      {rank:9, name:"17 GAMING",      short:"17G",region:"AS",color:"#15803D",initial:"G",kills:9, placement:7, total:16,trend:"up"},
      {rank:10,name:"JD GAMING",      short:"JDG",region:"AS",color:"#B91C1C",initial:"J",kills:7, placement:8, total:15,trend:"down"},
      {rank:11,name:"FURIA ESPORTS",  short:"FUR",region:"AM",color:"#EA580C",initial:"F",kills:6, placement:9, total:15,trend:"same"},
      {rank:12,name:"PENTAGRAM",      short:"PTG",region:"AP",color:"#4B5563",initial:"P",kills:4, placement:10,total:14,trend:"down"},
      {rank:13,name:"BB TEAM",        short:"BB", region:"ME",color:"#7C3AED",initial:"B",kills:5, placement:8, total:13,trend:"same"},
      {rank:14,name:"FOUR ANGRY MEN", short:"4AM",region:"AM",color:"#0891B2",initial:"4",kills:3, placement:9, total:12,trend:"up"},
      {rank:15,name:"ANYONE'S LEGEND",short:"AL", region:"AP",color:"#374151",initial:"A",kills:4, placement:7, total:11,trend:"down"},
      {rank:16,name:"ERARENA",        short:"ERA",region:"SEA",color:"#6B7280",initial:"E",kills:2,placement:6, total:8, trend:"down"},
    ],
  },
};

// ════════════════════════════════════════════════════════════════
// §6  DEFAULT LAYOUT
// ════════════════════════════════════════════════════════════════
const DEFAULT_LAYOUT = {
  marginH:110, marginV:58, gap:20,
  titleTop:216, contentTop:468,
  accentBarW:4,
  showSafeArea:false, showGrid:false, gridCols:12, gridRows:6,
  showHeader:true, showFooter:true,
};

// ════════════════════════════════════════════════════════════════
// §7  UI PRIMITIVES
// ════════════════════════════════════════════════════════════════
function PanelSection({ label, children, defaultOpen=true }) {
  const [open, setOpen] = useState(defaultOpen);
  // UI 섹션 레이블에서 "// " 접두사 제거
  const clean = label.replace(/^\/\/ ?/, "");
  return (
    <div style={{ borderBottom:`1px solid ${UI.line}22` }}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        width:"100%", padding:"8px 18px 7px", background:"transparent",
        border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:8,
      }}>
        <div style={{ flex:1, fontFamily:UI_F.mono, fontSize:11, letterSpacing:"0.18em",
                      color: open ? UI.textDim : UI.textMute,
                      textAlign:"left", textTransform:"uppercase" }}>
          {clean}
        </div>
        <div style={{ fontFamily:UI_F.mono, fontSize:10, color:UI.textMute,
                      opacity:0.6 }}>{open?"▴":"▾"}</div>
      </button>
      {open && <div style={{ paddingBottom:10 }}>{children}</div>}
    </div>
  );
}

function FieldRow({ label, value, onChange, type="text", mono=false }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"88px 1fr", gap:8,
                  alignItems:"center", padding:"4px 18px" }}>
      <div style={{ fontFamily:UI_F.mono, fontSize:10, color:UI.textMute,
                    letterSpacing:"0.1em", textTransform:"uppercase" }}>{label}</div>
      <input type={type} value={value}
        onChange={e=>onChange(type==="number"?Number(e.target.value):e.target.value)}
        style={{ background:UI.bgAlt, border:`1px solid ${UI.line}44`,
                 color:UI.text, borderRadius:3,
                 fontFamily:mono?UI_F.mono:UI_F.narrow, fontSize:mono?11:12,
                 fontWeight:mono?400:600, padding:"6px 10px", outline:"none",
                 letterSpacing:mono?"0.05em":"0.01em",
                 transition:"border-color 0.12s" }}/>
    </div>
  );
}

function SelectRow({ label, value, onChange, options }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"88px 1fr", gap:8,
                  alignItems:"center", padding:"4px 18px" }}>
      <div style={{ fontFamily:UI_F.mono, fontSize:10, color:UI.textMute,
                    letterSpacing:"0.1em", textTransform:"uppercase" }}>{label}</div>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{
        background:UI.bgAlt, border:`1px solid ${UI.line}44`, color:UI.text,
        fontFamily:UI_F.narrow, fontSize:12, fontWeight:600, borderRadius:3,
        padding:"6px 10px", outline:"none", cursor:"pointer",
      }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function ColorRow({ label, value, onChange }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"88px 32px 1fr 68px", gap:8,
                  alignItems:"center", padding:"4px 18px" }}>
      <div style={{ fontFamily:UI_F.mono, fontSize:10, color:UI.textMute,
                    letterSpacing:"0.1em", textTransform:"uppercase" }}>{label}</div>
      <label style={{ position:"relative", width:32, height:28, cursor:"pointer",
                      borderRadius:3, overflow:"hidden" }}>
        <div style={{ width:32, height:28, background:value }}/>
        <input type="color" value={value} onChange={e=>onChange(e.target.value)}
          style={{ position:"absolute", inset:0, opacity:0, cursor:"pointer",
                   width:"100%", height:"100%" }}/>
      </label>
      <div style={{ height:28, borderRadius:3,
                    background:`linear-gradient(90deg,${value},${darken(value,60)})` }}/>
      <input type="text" value={value.toUpperCase()} maxLength={7}
        onChange={e=>{ if(HEX_RE.test(e.target.value)) onChange(e.target.value); }}
        style={{ background:UI.bgAlt, border:`1px solid ${UI.line}44`, color:UI.text,
                 fontFamily:UI_F.mono, fontSize:10, padding:"5px 6px", borderRadius:3,
                 outline:"none", textAlign:"center", letterSpacing:"0.04em", width:"100%" }}/>
    </div>
  );
}

function SliderRow({ label, value, onChange, min=0, max=200, step=8, unit="px", color }) {
  const col = color || UI.accent;
  const uid = useRef(`sr-${Math.random().toString(36).slice(2,8)}`).current;
  const [inputVal, setInputVal] = useState(String(value));
  const [focused,  setFocused]  = useState(false);
  useEffect(() => { if (!focused) setInputVal(String(value)); }, [value, focused]);

  const snap  = n => Math.round(n / step) * step;
  const clamp = n => Math.max(min, Math.min(max, n));
  const commit = () => {
    const v = clamp(snap(parseInt(inputVal, 10) || value));
    onChange(v); setInputVal(String(v)); setFocused(false);
  };
  const handleKey = e => {
    if (e.key === "Enter")  commit();
    if (e.key === "Escape") { setInputVal(String(value)); setFocused(false); }
    if (e.key === "ArrowUp")   { e.preventDefault(); const v = clamp(value + step); onChange(v); setInputVal(String(v)); }
    if (e.key === "ArrowDown") { e.preventDefault(); const v = clamp(value - step); onChange(v); setInputVal(String(v)); }
  };
  const pct   = ((value - min) / (max - min)) * 100;
  const ticks = Math.min(20, Math.floor((max - min) / step) + 1);

  return (
    <div style={{ padding:"6px 18px 8px" }}>
      <style>{`.${uid}::-webkit-slider-thumb{appearance:none;width:12px;height:12px;background:${col};border:2px solid ${UI.bg};border-radius:2px;cursor:pointer;}.${uid}::-moz-range-thumb{width:12px;height:12px;background:${col};border:2px solid ${UI.bg};border-radius:2px;cursor:pointer;}`}</style>

      {/* 레이블 + 값 입력 */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
        <div style={{ flex:1, fontFamily:UI_F.mono, fontSize:10, color:UI.textMute,
                      letterSpacing:"0.1em", textTransform:"uppercase" }}>{label}</div>
        <div style={{ display:"flex", alignItems:"center" }}>
          {/* ▲▼ 버튼 */}
          <div style={{ display:"flex", flexDirection:"column" }}>
            {[{dv:step,s:"▲"},{dv:-step,s:"▼"}].map(({dv,s}) => (
              <button key={s} onClick={() => onChange(clamp(value + dv))} style={{
                width:18, height:14, background:UI.bgAlt, border:`1px solid ${UI.line}44`,
                ...(dv > 0 ? {borderBottom:"none"} : {}),
                color:UI.textMute, fontFamily:UI_F.mono, fontSize:8,
                cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
              }}>{s}</button>
            ))}
          </div>
          {/* 숫자 입력 */}
          <input
            type="text"
            value={focused ? inputVal : `${value}${unit}`}
            maxLength={8}
            onChange={e => setInputVal(e.target.value.replace(/[^0-9-]/g, ""))}
            onFocus={() => { setFocused(true); setInputVal(String(value)); }}
            onBlur={commit}
            onKeyDown={handleKey}
            style={{
              width: unit === " col" || unit === " row" ? 52 : 62,
              height:28,
              background: focused ? UI.bg : UI.bgAlt,
              border:`1px solid ${focused ? col : `${UI.line}44`}`,
              borderLeft:"none", borderRadius:"0 3px 3px 0",
              color: focused ? col : UI.text,
              fontFamily:UI_F.mono, fontSize:11, padding:"0 8px",
              outline:"none", textAlign:"right", letterSpacing:"0.04em", cursor:"text",
              transition:"border-color 0.12s, color 0.12s",
            }}
          />
        </div>
      </div>

      {/* 슬라이더 트랙 */}
      <div style={{ position:"relative", height:16, display:"flex", alignItems:"center" }}>
        <div style={{ position:"absolute", left:0, right:0, height:3,
                      background:`${UI.line}44`, borderRadius:2 }}/>
        <div style={{ position:"absolute", left:0, width:`${pct}%`, height:3,
                      background:col, borderRadius:2, transition:"width 0.06s" }}/>
        {/* 눈금 */}
        {Array.from({length:ticks}).map((_,i) => {
          const sv = min + i * step;
          const sp = ((sv - min) / (max - min)) * 100;
          return (
            <div key={i} style={{
              position:"absolute", left:`${sp}%`,
              width:1, height: sv === value ? 8 : 4,
              background: sv === value ? col : `${UI.line}66`,
              transform:"translateX(-50%)",
            }}/>
          );
        })}
        <input type="range" min={min} max={max} step={step} value={value}
          className={uid}
          onChange={e => onChange(clamp(snap(Number(e.target.value))))}
          style={{ position:"absolute", left:0, right:0, width:"100%",
                   appearance:"none", background:"transparent", cursor:"pointer",
                   height:16, zIndex:2 }}/>
      </div>

      {/* min / step / max 힌트 */}
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:3,
                    fontFamily:UI_F.mono, fontSize:9, color:UI.textMute, opacity:0.45 }}>
        <span>{min}{unit}</span>
        <span>step {step}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange, desc }) {
  return (
    <div onClick={()=>onChange(!value)} style={{
      display:"flex", alignItems:"center", gap:10,
      padding:"6px 18px", cursor:"pointer",
    }}>
      <div style={{ width:32, height:18, position:"relative", flexShrink:0, borderRadius:9,
                    background:value?`${UI.accent}CC`:UI.surface,
                    border:`1px solid ${value?UI.accent:UI.line}44`,
                    transition:"background 0.15s" }}>
        <div style={{ position:"absolute", top:2, left:value?15:2, width:12, height:12,
                      borderRadius:"50%", background:value?UI.bg:UI.textMute,
                      transition:"left 0.15s" }}/>
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontFamily:UI_F.narrow, fontSize:12, fontWeight:600,
                      color:value?UI.text:UI.textDim,
                      letterSpacing:"0.03em" }}>{label}</div>
        {desc && <div style={{ fontFamily:UI_F.mono, fontSize:10, color:UI.textMute,
                               marginTop:1, letterSpacing:"0.06em" }}>{desc}</div>}
      </div>
    </div>
  );
}

function ScoreSpinner({ label, value, onChange }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"88px 1fr", gap:8,
                  alignItems:"center", padding:"4px 18px" }}>
      <div style={{ fontFamily:UI_F.mono, fontSize:10, color:UI.textMute,
                    letterSpacing:"0.1em", textTransform:"uppercase" }}>{label}</div>
      <div style={{ display:"flex", borderRadius:3, overflow:"hidden",
                    border:`1px solid ${UI.line}44` }}>
        <button onClick={()=>onChange(Math.max(0,value-1))} style={{
          width:32, background:UI.surface, border:"none", borderRight:`1px solid ${UI.line}44`,
          color:UI.textDim, fontFamily:UI_F.mono, fontSize:14, cursor:"pointer",
        }}>−</button>
        <div style={{ flex:1, background:UI.bgAlt, padding:"6px 0",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontFamily:UI_F.display, fontSize:22, color:UI.accent, lineHeight:1 }}>
          {value}
        </div>
        <button onClick={()=>onChange(Math.min(7,value+1))} style={{
          width:32, background:UI.surface, border:"none", borderLeft:`1px solid ${UI.line}44`,
          color:UI.textDim, fontFamily:UI_F.mono, fontSize:14, cursor:"pointer",
        }}>+</button>
      </div>
    </div>
  );
}

function TeamRowCard({ team, index, onChange, onRemove }) {
  return (
    <div style={{ margin:"3px 14px", background:UI.bgAlt,
                  borderRadius:4, borderLeft:`2px solid ${team.color}`,
                  padding:"8px 10px" }}>
      <div style={{ display:"flex", gap:7, marginBottom:7, alignItems:"center" }}>
        <div style={{ fontFamily:UI_F.mono, fontSize:10, color:UI.accent,
                      letterSpacing:"0.15em", minWidth:20, opacity:0.7 }}>
          {String(index+1).padStart(2,"0")}
        </div>
        <input value={team.name} onChange={e=>onChange({...team,name:e.target.value})}
          style={{ flex:1, background:UI.bg, border:`1px solid ${UI.line}44`,
                   borderRadius:3, color:UI.text, fontFamily:UI_F.narrow, fontSize:12,
                   fontWeight:600, padding:"5px 8px", outline:"none" }}/>
        <input value={team.short} onChange={e=>onChange({...team,short:e.target.value})}
          maxLength={4}
          style={{ width:46, background:UI.bg, border:`1px solid ${UI.line}44`,
                   borderRadius:3, color:UI.textDim, fontFamily:UI_F.mono, fontSize:10,
                   padding:"5px 5px", outline:"none", textAlign:"center" }}/>
        <button onClick={onRemove} style={{ background:"transparent", border:"none",
                                            color:UI.textMute, fontFamily:UI_F.mono, fontSize:12,
                                            padding:"3px 6px", cursor:"pointer", borderRadius:3 }}>✕</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"32px 1fr 46px", gap:7, alignItems:"center" }}>
        <label style={{ position:"relative", width:32, height:26, cursor:"pointer", borderRadius:3, overflow:"hidden" }}>
          <div style={{ width:32, height:26, background:team.color }}/>
          <input type="color" value={team.color} onChange={e=>onChange({...team,color:e.target.value})}
            style={{ position:"absolute", inset:0, opacity:0, cursor:"pointer",
                     width:"100%", height:"100%" }}/>
        </label>
        <div style={{ height:26, borderRadius:3,
                      background:`linear-gradient(90deg,${team.color},${darken(team.color)})` }}/>
        <input value={team.initial} maxLength={2}
          onChange={e=>onChange({...team,initial:e.target.value.toUpperCase().slice(0,2)})}
          style={{ background:UI.bg, border:`1px solid ${UI.line}44`, borderRadius:3,
                   color:UI.text, fontFamily:UI_F.display, fontSize:16, padding:"3px 6px",
                   outline:"none", textAlign:"center" }}/>
      </div>
    </div>
  );
}

function AddButton({ onClick, label="+ ADD" }) {
  return (
    <button onClick={onClick} style={{
      margin:"6px 14px 4px", width:"calc(100% - 28px)", padding:"8px",
      background:"transparent", borderRadius:4,
      border:`1px dashed ${UI.line}55`,
      color:UI.textMute, fontFamily:UI_F.mono, fontSize:11,
      letterSpacing:"0.15em", cursor:"pointer",
    }}>{label}</button>
  );
}

// ════════════════════════════════════════════════════════════════
// §8  TEMPLATE COMPONENTS
// ════════════════════════════════════════════════════════════════

// ── Scoreboard ───────────────────────────────────────────────
function Scoreboard({ data:d, layout }) {
  const { marginH, titleTop, contentTop, gap } = layout;
  const hw = d.teams[0].score > d.teams[1].score;
  const aw = d.teams[1].score > d.teams[0].score;
  return (
    <Canvas layout={layout}>
      <Chrome league={d.league}
        right={`DAY ${String(d.day).padStart(2,"0")} · MATCH ${String(d.match).padStart(2,"0")}\n${d.format} · ${d.status}`}
        bottom={`SCOREBOARD · ${d.timecode}`} layout={layout}/>
      <TitleBlock eyebrow="SCOREBOARD" title={d.status==="FINAL"?"FINAL SCORE":"LIVE SCORE"} layout={layout}/>
      <div style={{ position:"absolute", top:contentTop, left:marginH, right:marginH,
                    display:"grid", gridTemplateColumns:"1fr auto 1fr",
                    gap:gap*2, alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap }}>
          <TeamMark color={d.teams[0].color} initial={d.teams[0].initial} size={124} fs={68}/>
          <div>
            <div style={{ fontFamily:F.display, fontSize:64, color:T.text, lineHeight:1 }}>
              {d.teams[0].name}
            </div>
            <div style={{ fontFamily:F.mono, fontSize:13, color:T.textMute,
                          letterSpacing:"0.3em", marginTop:8 }}>{d.teams[0].short}</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"baseline", gap:24,
                      fontFamily:F.display, lineHeight:1 }}>
          <span style={{ fontSize:220, color:hw?d.teams[0].color:T.textMute }}>{d.teams[0].score}</span>
          <span style={{ fontSize:110, color:T.textMute }}>—</span>
          <span style={{ fontSize:220, color:aw?d.teams[1].color:T.textMute }}>{d.teams[1].score}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap, flexDirection:"row-reverse" }}>
          <TeamMark color={d.teams[1].color} initial={d.teams[1].initial} size={124} fs={68}/>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontFamily:F.display, fontSize:64, color:T.text, lineHeight:1 }}>
              {d.teams[1].name}
            </div>
            <div style={{ fontFamily:F.mono, fontSize:13, color:T.textMute,
                          letterSpacing:"0.3em", marginTop:8 }}>{d.teams[1].short}</div>
          </div>
        </div>
      </div>
      {d.sets?.length > 0 && (
        <div style={{ position:"absolute", bottom:170, left:"50%",
                      transform:"translateX(-50%)", display:"flex", gap:44 }}>
          {d.sets.map(([h,a],i) => {
            const hw2 = h>a;
            return (
              <div key={i} style={{ textAlign:"center" }}>
                <div style={{ fontFamily:F.mono, fontSize:11, color:T.textMute,
                              letterSpacing:"0.25em", marginBottom:8 }}>SET {i+1}</div>
                <div style={{ fontFamily:F.display, fontSize:32, lineHeight:1 }}>
                  <span style={{ color:hw2?d.teams[0].color:T.textMute }}>{h}</span>
                  <span style={{ color:T.textMute, margin:"0 8px" }}>-</span>
                  <span style={{ color:!hw2?d.teams[1].color:T.textMute }}>{a}</span>
                </div>
                <div style={{ fontFamily:F.mono, fontSize:11, letterSpacing:"0.25em", marginTop:6,
                              color:hw2?d.teams[0].color:d.teams[1].color }}>
                  {hw2?d.teams[0].short:d.teams[1].short}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Canvas>
  );
}

// ── Next Match Up ─────────────────────────────────────────────
function NextMatch({ data:d, layout }) {
  const { marginH, titleTop, contentTop, gap, accentBarW } = layout;
  return (
    <Canvas layout={layout}>
      <Chrome league={d.league} right={d.dayLabel}
        bottom="NEXT MATCH UP · UPCOMING SCHEDULE" layout={layout}/>
      <TitleBlock eyebrow="NEXT MATCH UP" title="UPCOMING." layout={layout}/>
      <div style={{ position:"absolute", top:contentTop, left:marginH, right:marginH,
                    display:"flex", flexDirection:"column", gap }}>
        {d.matches.map((m,i) => (
          <div key={i} style={{ display:"grid",
            gridTemplateColumns:"112px 1fr auto 70px auto 1fr",
            gap:24, alignItems:"center", padding:`${gap}px 28px`,
            background:"rgba(26,29,38,0.7)",
            borderLeft:`${accentBarW}px solid ${T.accent}` }}>
            <div style={{ fontFamily:F.mono, fontSize:13, color:T.textMute,
                          letterSpacing:"0.2em" }}>MATCH {String(i+1).padStart(2,"0")}</div>
            <div style={{ display:"flex", alignItems:"center", gap:18, justifyContent:"flex-end" }}>
              <div style={{ fontFamily:F.display, fontSize:40, color:T.text, lineHeight:1 }}>
                {m.home.name}
              </div>
              <TeamMark color={m.home.color} initial={m.home.initial} size={56} fs={28}/>
            </div>
            <div style={{ fontFamily:F.display, fontSize:38, color:T.accent,
                          lineHeight:1, letterSpacing:"0.1em" }}>VS</div>
            <div style={{ fontFamily:F.mono, fontSize:15, color:T.text,
                          letterSpacing:"0.2em", textAlign:"center" }}>{m.time}</div>
            <TeamMark color={m.away.color} initial={m.away.initial} size={56} fs={28}/>
            <div style={{ fontFamily:F.display, fontSize:40, color:T.text, lineHeight:1 }}>
              {m.away.name}
            </div>
          </div>
        ))}
      </div>
    </Canvas>
  );
}

// ── Overview ──────────────────────────────────────────────────
function Overview({ data:d, layout }) {
  const { marginH, marginV, titleTop, contentTop, gap } = layout;
  const n = d.teams.length;
  const cols = n<=3?n:n<=4?2:n<=6?3:n<=8?4:n<=9?3:n<=12?4:n<=15?5:n<=20?5:6;
  const rows = Math.ceil(n/cols);
  const bottomReserve = marginV+48+marginV;
  const availH = 1080-contentTop-bottomReserve;
  const cardH  = Math.floor((availH-gap*(rows-1))/rows);
  const markSz = Math.min(90,  Math.floor(cardH*0.42));
  const markFs = Math.min(48,  Math.floor(markSz*0.54));
  const nameFz = Math.min(28,  Math.floor(cardH*0.165));
  const shortFz= Math.min(11,  Math.floor(cardH*0.075));
  const numFz  = Math.min(11,  Math.floor(cardH*0.072));
  const topBarH= Math.max(2,   Math.floor(cardH*0.025));
  const innerG = Math.min(12,  Math.floor(cardH*0.08));
  const cardPad= Math.min(gap, Math.floor(cardH*0.09));

  return (
    <Canvas layout={layout}>
      <Chrome league={d.league}
        right={`${d.subtitle}\n${n} TEAMS · ${cols}×${rows}`}
        bottom={`OVERVIEW · ${n} TEAMS`} layout={layout}/>
      <TitleBlock eyebrow="OVERVIEW / PARTICIPATED" title="ALL TEAMS." layout={layout}/>
      {cardH < 80 && (
        <div style={{ position:"absolute", top:contentTop-36, left:marginH,
                      fontFamily:F.mono, fontSize:13, color:T.warn, letterSpacing:"0.2em" }}>
          ⚠ COMPACT MODE — Content Top을 낮춰주세요
        </div>
      )}
      <div style={{ position:"absolute", top:contentTop, left:marginH, right:marginH,
                    display:"grid", gridTemplateColumns:`repeat(${cols},1fr)`,
                    gridTemplateRows:`repeat(${rows},${cardH}px)`, gap }}>
        {d.teams.map((t,i) => (
          <div key={i} style={{ background:T.bgAlt, border:`1px solid ${T.line}`,
                                padding:cardPad, display:"flex", flexDirection:"column",
                                alignItems:"center", justifyContent:"center",
                                textAlign:"center", gap:innerG, position:"relative",
                                overflow:"hidden", height:cardH, boxSizing:"border-box" }}>
            <div style={{ position:"absolute", top:0, left:0, right:0,
                          height:topBarH, background:t.color }}/>
            <div style={{ position:"absolute", top:topBarH+6, left:10,
                          fontFamily:F.mono, fontSize:numFz,
                          color:T.accent, letterSpacing:"0.25em" }}>
              {String(i+1).padStart(2,"0")}
            </div>
            <TeamMark color={t.color} initial={t.initial} size={markSz} fs={markFs}/>
            <div>
              <div style={{ fontFamily:F.display, fontSize:nameFz, color:T.text,
                            lineHeight:1, overflow:"hidden", textOverflow:"ellipsis",
                            whiteSpace:"nowrap", maxWidth:"100%" }}>{t.name}</div>
              <div style={{ fontFamily:F.mono, fontSize:shortFz, color:T.textMute,
                            letterSpacing:"0.25em", marginTop:4 }}>{t.short}</div>
            </div>
          </div>
        ))}
      </div>
    </Canvas>
  );
}

// ── Roster ────────────────────────────────────────────────────
function Roster({ data:d, layout }) {
  const { marginH, marginV, titleTop, contentTop, gap } = layout;
  const n = d.players.length;
  const cols = n<=4?n:n<=5?5:n<=8?4:n<=10?5:n<=12?6:n<=15?5:6;
  const rows = Math.ceil(n/cols);
  const bottomReserve = marginV+48+marginV;
  const availH = 1080-contentTop-bottomReserve;
  const cardH  = Math.floor((availH-gap*(rows-1))/rows);
  const metaH  = Math.max(72, Math.floor(cardH*0.30));
  const portH  = cardH-metaH;
  const numFz  = Math.min(110, Math.floor(portH*0.72));
  const posFz  = Math.min(11,  Math.floor(metaH*0.16));
  const handleFz = Math.min(26,Math.floor(metaH*0.36));
  const nameFz = Math.min(10,  Math.floor(metaH*0.14));
  const metaPad= Math.min(16,  Math.floor(metaH*0.12));
  const innerGV= Math.min(5,   Math.floor(metaH*0.07));

  return (
    <Canvas layout={layout}>
      <Chrome league={d.league}
        right={`${d.team.short} · FULL SQUAD\n${n} PLAYERS · ${cols}×${rows}`}
        bottom="TEAM ROSTER" layout={layout}/>
      <div style={{ position:"absolute", top:titleTop,
                    ..._T.titleAlign==="center" ? {left:"50%",transform:"translateX(-50%)"} : {left:marginH,right:marginH},
                    display:"flex", alignItems:"center", gap:36,
                    whiteSpace:"nowrap" }}>
        <TeamMark color={d.team.color} initial={d.team.initial} size={134} fs={76}/>
        <div>
          <Eyebrow t={`ROSTER / ${d.team.short}`}/>
          <H1 size={88}>{d.team.name}</H1>
        </div>
      </div>
      {cardH < 100 && (
        <div style={{ position:"absolute", top:contentTop-34, left:marginH,
                      fontFamily:F.mono, fontSize:13, color:T.warn, letterSpacing:"0.2em" }}>
          ⚠ COMPACT — Content Top을 낮춰주세요
        </div>
      )}
      <div style={{ position:"absolute", top:contentTop, left:marginH, right:marginH,
                    display:"grid", gridTemplateColumns:`repeat(${cols},1fr)`,
                    gridTemplateRows:`repeat(${rows},${cardH}px)`, gap }}>
        {d.players.map((p,i) => (
          <div key={i} style={{ background:T.bgAlt, border:`1px solid ${T.line}`,
                                overflow:"hidden", display:"flex", flexDirection:"column",
                                height:cardH, boxSizing:"border-box" }}>
            <div style={{ height:portH, flexShrink:0, position:"relative", overflow:"hidden",
                          background:`linear-gradient(135deg,${d.team.color} 0%,${darken(d.team.color)} 60%,#0F172A 100%)` }}>
              <div style={{ position:"absolute", inset:0,
                            background:"radial-gradient(ellipse at center top,rgba(255,255,255,0.18),transparent 60%)" }}/>
              <div style={{ position:"absolute", bottom:-Math.floor(numFz*0.1), right:12,
                            fontFamily:F.display, fontSize:numFz,
                            color:"rgba(255,255,255,0.16)", lineHeight:0.9, userSelect:"none" }}>
                {String(p.number).padStart(2,"0")}
              </div>
              {p.captain && portH > 50 && (
                <div style={{ position:"absolute", top:8, right:8,
                              fontFamily:F.mono, fontSize:Math.min(10,Math.floor(portH*0.07)),
                              color:T.accent, letterSpacing:"0.3em",
                              background:"rgba(0,0,0,0.55)", padding:"3px 7px" }}>
                  CAPTAIN
                </div>
              )}
            </div>
            <div style={{ flex:1, padding:metaPad, display:"flex", flexDirection:"column",
                          justifyContent:"center", overflow:"hidden", minHeight:0 }}>
              <div style={{ fontFamily:F.mono, fontSize:posFz, color:T.accent,
                            letterSpacing:"0.3em", whiteSpace:"nowrap" }}>{p.position}</div>
              <div style={{ fontFamily:F.display, fontSize:handleFz, color:T.text,
                            lineHeight:1.05, marginTop:innerGV,
                            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {p.handle}
              </div>
              <div style={{ fontFamily:F.mono, fontSize:nameFz, color:T.textMute,
                            letterSpacing:"0.15em", marginTop:innerGV,
                            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                #{p.number} · {p.name}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Canvas>
  );
}

// ── Caster Prediction ─────────────────────────────────────────
function Prediction({ data:d, layout }) {
  const { marginH, titleTop, contentTop } = layout;
  const home = d.matchup.home, away = d.matchup.away;
  const hc = d.casters.filter(c=>c.pick==="home").length;
  const hp = Math.round(hc/d.casters.length*100), ap = 100-hp;
  return (
    <Canvas layout={layout}>
      <Chrome league={d.league} right={`${home.name} VS ${away.name}\n${d.matchup.format}`}
        bottom="CASTER WIN PREDICTION" layout={layout}/>
      <TitleBlock eyebrow="WIN PREDICTION" title="WHO WINS?" layout={layout}/>
      <div style={{ position:"absolute", top:contentTop, left:marginH, right:marginH,
                    display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:36, alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:22, justifyContent:"flex-end" }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontFamily:F.display, fontSize:50, color:T.text, lineHeight:1 }}>
              {home.name}
            </div>
            <div style={{ fontFamily:F.display, fontSize:66, color:home.color,
                          lineHeight:1, marginTop:10 }}>{hp}%</div>
          </div>
          <TeamMark color={home.color} initial={home.initial} size={106} fs={56}/>
        </div>
        <div style={{ fontFamily:F.display, fontSize:42, color:T.textMute,
                      lineHeight:1, letterSpacing:"0.1em" }}>VS</div>
        <div style={{ display:"flex", alignItems:"center", gap:22 }}>
          <TeamMark color={away.color} initial={away.initial} size={106} fs={56}/>
          <div>
            <div style={{ fontFamily:F.display, fontSize:50, color:T.text, lineHeight:1 }}>
              {away.name}
            </div>
            <div style={{ fontFamily:F.display, fontSize:66, color:away.color,
                          lineHeight:1, marginTop:10 }}>{ap}%</div>
          </div>
        </div>
      </div>
      <div style={{ position:"absolute", top:contentTop+200, left:marginH, right:marginH,
                    height:10, display:"flex", overflow:"hidden" }}>
        <div style={{ width:`${hp}%`, background:home.color, transition:"width 0.3s" }}/>
        <div style={{ flex:1, background:away.color }}/>
      </div>
      <div style={{ position:"absolute", top:contentTop+240, left:marginH, right:marginH,
                    display:"grid", gridTemplateColumns:`repeat(${d.casters.length},1fr)`, gap:12 }}>
        {d.casters.map((c,i) => {
          const pt = c.pick==="home"?home:away;
          return (
            <div key={i} style={{ background:T.bgAlt, border:`1px solid ${T.line}`,
                                  borderTop:`3px solid ${pt.color}`, padding:"16px 14px",
                                  textAlign:"center" }}>
              <div style={{ fontFamily:F.mono, fontSize:10, color:T.textMute,
                            letterSpacing:"0.3em" }}>CASTER</div>
              <div style={{ fontFamily:F.display, fontSize:34, color:T.text,
                            lineHeight:1, marginTop:7 }}>{c.name}</div>
              <div style={{ fontFamily:F.mono, fontSize:10, color:pt.color,
                            letterSpacing:"0.2em", marginTop:11 }}>PICK · {pt.initial}</div>
              <div style={{ fontFamily:F.display, fontSize:26, color:T.accent,
                            lineHeight:1, marginTop:4 }}>{c.score}</div>
            </div>
          );
        })}
      </div>
    </Canvas>
  );
}

// ── Lower Third ───────────────────────────────────────────────
function LowerThird({ data:d, layout }) {
  const { marginH, marginV } = layout;
  const BAR_H = 180;
  const BAR_Y = 1080-(marginV+48+marginV)-BAR_H;

  const Bar = ({ children }) => (
    <Canvas layout={layout}>
      <Chrome league={d.league} right="" bottom="LOWER THIRD" layout={layout}/>
      <div style={{ position:"absolute", inset:0,
                    background:"rgba(0,0,0,0.45)", pointerEvents:"none" }}/>
      <div style={{ position:"absolute", top:BAR_Y, left:0, right:0, height:BAR_H,
                    background:"rgba(10,11,15,0.96)", borderTop:`1px solid ${T.line}`,
                    display:"flex", alignItems:"center", padding:`0 ${marginH}px` }}>
        {children}
      </div>
    </Canvas>
  );

  if (d.variant === "player") {
    const p = d.player;
    return (
      <Bar>
        <div style={{ width:120, height:120, flexShrink:0, marginRight:32,
                      background:`linear-gradient(135deg,${p.teamColor},${darken(p.teamColor)})`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontFamily:F.display, fontSize:58, color:"#fff", position:"relative" }}>
          {p.teamInitial}
          <div style={{ position:"absolute", bottom:0, right:0, background:T.bg,
                        padding:"3px 8px", fontFamily:F.mono, fontSize:12,
                        color:T.accent, letterSpacing:"0.2em" }}>#{p.number}</div>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:20, marginBottom:8 }}>
            <div style={{ fontFamily:F.display, fontSize:72, color:T.text, lineHeight:0.9 }}>
              {p.handle}
            </div>
            <div style={{ fontFamily:F.mono, fontSize:14, color:p.teamColor,
                          letterSpacing:"0.25em", border:`1px solid ${p.teamColor}`,
                          padding:"3px 10px" }}>{p.position}</div>
          </div>
          <div style={{ fontFamily:F.mono, fontSize:13, color:T.textMute, letterSpacing:"0.2em" }}>
            {p.name} · {p.teamShort}
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontFamily:F.display, fontSize:28, color:T.text, lineHeight:1 }}>
            {p.team}
          </div>
          <div style={{ fontFamily:F.mono, fontSize:11, color:T.textMute,
                        letterSpacing:"0.25em", marginTop:8 }}>
            {d.league}
          </div>
        </div>
      </Bar>
    );
  }
  if (d.variant === "caster") {
    const c = d.caster;
    return (
      <Bar>
        <div style={{ width:4, height:100, background:T.accent, marginRight:32, flexShrink:0 }}/>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:F.mono, fontSize:13, color:T.accent,
                        letterSpacing:"0.3em", marginBottom:10 }}>{c.role}</div>
          <div style={{ fontFamily:F.display, fontSize:68, color:T.text, lineHeight:0.95 }}>
            {c.name}
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontFamily:F.mono, fontSize:12, color:T.textMute, letterSpacing:"0.2em" }}>
            {c.org}
          </div>
          <div style={{ fontFamily:F.mono, fontSize:11, color:T.textMute,
                        letterSpacing:"0.15em", marginTop:6 }}>{d.league}</div>
        </div>
      </Bar>
    );
  }
  if (d.variant === "team") {
    const t = d.teamCallout;
    return (
      <Bar>
        <div style={{ width:120, height:120, flexShrink:0, marginRight:32,
                      background:`linear-gradient(135deg,${t.color},${darken(t.color)})`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontFamily:F.display, fontSize:58, color:"#fff" }}>{t.initial}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:F.mono, fontSize:13, color:t.color,
                        letterSpacing:"0.3em", marginBottom:10 }}>{t.tagline}</div>
          <div style={{ fontFamily:F.display, fontSize:68, color:T.text, lineHeight:0.95 }}>
            {t.name}
          </div>
        </div>
        <div style={{ fontFamily:F.display, fontSize:40, color:T.textMute,
                      letterSpacing:"0.05em" }}>{t.short}</div>
      </Bar>
    );
  }
  const e = d.event;
  return (
    <Bar>
      <div style={{ width:8, height:110, background:e.accent||T.accent,
                    marginRight:36, flexShrink:0 }}/>
      <div>
        <div style={{ fontFamily:F.display, fontSize:72, color:T.text,
                      lineHeight:0.9, marginBottom:10 }}>{e.headline}</div>
        <div style={{ fontFamily:F.mono, fontSize:14, color:T.textMute,
                      letterSpacing:"0.2em" }}>{e.sub}</div>
      </div>
    </Bar>
  );
}

// ── BR Leaderboard ────────────────────────────────────────────
const REGION_COLOR = {
  AS:"#E53935",AP:"#0891B2",EU:"#7C3AED",
  AM:"#CA8A04",ME:"#059669",SEA:"#EA580C",KR:"#1E40AF",
};
const TREND = { up:"▲", down:"▼", same:"—" };

function BRLeaderboard({ data:d, layout }) {
  const { marginH, marginV } = layout;
  const n = d.teams.length;
  const dualCol = n > 12;
  const colSize = dualCol ? Math.ceil(n/2) : n;
  const colA = d.teams.slice(0, colSize);
  const colB = dualCol ? d.teams.slice(colSize) : [];

  const bottomReserve = marginV+48+marginV;
  const titleH = layout.titleTop;  // 타이틀 top 기준 → layout 변경에 반응
  const TITLE_BLOCK = 200;         // 타이틀 "LEADERBOARD." + legend 영역 높이
  const availH = 1080 - titleH - TITLE_BLOCK - bottomReserve - 20;
  const rowH = Math.max(38, Math.min(52, Math.floor((availH-4*(colSize-1))/colSize)));

  const zoneColor = rank => {
    if (rank <= d.advanceZone) return T.ok;
    if (rank <= d.safeZone)    return T.textMute;
    if (rank <= d.dangerZone)  return T.warn;
    return T.accent3;
  };
  const trendColor = t => t==="up"?T.ok:t==="down"?T.accent3:T.textMute;

  const Row = ({ t }) => {
    const isFirst = t.rank === 1;
    const zc = zoneColor(t.rank);
    return (
      <div style={{ height:rowH, display:"grid",
                    gridTemplateColumns:"48px 4px 56px 1fr 52px 64px 64px 72px",
                    alignItems:"center", marginBottom:4, paddingRight:16,
                    background:isFirst?"rgba(212,255,0,0.06)":t.rank%2===0?"rgba(255,255,255,0.02)":"transparent",
                    borderLeft:`3px solid ${zc}` }}>
        <div style={{ fontFamily:F.display, fontSize:Math.floor(rowH*0.48),
                      color:isFirst?T.accent:T.textDim, textAlign:"center", lineHeight:1 }}>
          {String(t.rank).padStart(2,"0")}
        </div>
        <div style={{ width:4, height:"80%", background:t.color }}/>
        <div style={{ width:rowH-8, height:rowH-8, margin:"0 8px",
                      background:`linear-gradient(135deg,${t.color},${darken(t.color)})`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontFamily:F.display, fontSize:Math.floor((rowH-8)*0.55),
                      color:"#fff", lineHeight:1, flexShrink:0 }}>
          {t.initial}
        </div>
        <div style={{ minWidth:0, paddingLeft:4 }}>
          <div style={{ fontFamily:F.display, fontSize:Math.min(28,rowH*0.52),
                        color:isFirst?T.text:T.textDim, lineHeight:1,
                        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
            {t.name}
          </div>
          <div style={{ display:"flex", gap:8, marginTop:3, alignItems:"center" }}>
            <span style={{ fontFamily:F.mono, fontSize:Math.min(9,rowH*0.2),
                           color:REGION_COLOR[t.region]||T.textMute, letterSpacing:"0.2em",
                           border:`1px solid ${REGION_COLOR[t.region]||T.line}`,
                           padding:"1px 5px" }}>{t.region}</span>
            <span style={{ fontFamily:F.mono, fontSize:Math.min(9,rowH*0.2),
                           color:T.textMute, letterSpacing:"0.1em" }}>{t.short}</span>
          </div>
        </div>
        <div style={{ fontFamily:F.mono, fontSize:Math.min(13,rowH*0.3),
                      color:trendColor(t.trend), textAlign:"center" }}>
          {TREND[t.trend]||"—"}
        </div>
        {["kills","placement","total"].map((k,ki) => (
          <div key={k} style={{ textAlign:"right", paddingRight:ki===2?8:10 }}>
            <div style={{ fontFamily:F.mono, fontSize:8, color:T.textMute,
                          letterSpacing:"0.15em" }}>
              {k==="kills"?"KILLS":k==="placement"?"PLCMNT":"PTS"}
            </div>
            <div style={{ fontFamily:F.display,
                          fontSize:Math.min(ki===2?28:24,rowH*(ki===2?0.54:0.46)),
                          color:ki===2?(t.rank===1?T.accent:zc):T.text, lineHeight:1 }}>
              {t[k]}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const ColHeader = () => (
    <div style={{ display:"grid",
                  gridTemplateColumns:"48px 4px 56px 1fr 52px 64px 64px 72px",
                  marginBottom:6, paddingRight:16, paddingBottom:6,
                  borderBottom:`1px solid ${T.line}` }}>
      {["RNK","","","TEAM","TRD","KILLS","PLCMNT","PTS"].map((h,i) => (
        <div key={i} style={{ fontFamily:F.mono, fontSize:9, color:T.textMute,
                               letterSpacing:"0.2em",
                               textAlign:i>=5?"right":i===0||i===4?"center":"left",
                               paddingLeft:i===3?12:0,
                               paddingRight:i===5||i===6?10:i===7?8:0 }}>{h}</div>
      ))}
    </div>
  );

  return (
    <Canvas layout={layout}>
      <Chrome league={d.league}
        right={`ROUND ${d.round} / ${d.totalRounds}\n${d.pointSystem}`}
        bottom="BR LEADERBOARD · LIVE STANDINGS" layout={layout}/>
      <div style={{ position:"absolute", top:layout.titleTop, left:marginH, right:marginH,
                    display:"flex", alignItems:"flex-end", justifyContent:"space-between" }}>
        <div>
          <Eyebrow t="LIVE STANDINGS"/>
          <div style={{ fontFamily:F.display, fontSize:80, color:T.text, lineHeight:0.9 }}>
            LEADERBOARD.
          </div>
        </div>
        <div style={{ display:"flex", gap:20, paddingBottom:8 }}>
          {[
            {label:`TOP ${d.advanceZone} ADVANCE`,color:T.ok},
            {label:`TOP ${d.safeZone} SAFE`,      color:T.textMute},
            {label:`TOP ${d.dangerZone} RISK`,     color:T.warn},
            {label:"DANGER",                       color:T.accent3},
          ].map((z,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:10, height:10, background:z.color }}/>
              <div style={{ fontFamily:F.mono, fontSize:9, color:T.textMute,
                            letterSpacing:"0.15em" }}>{z.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position:"absolute", top:titleH+200, left:marginH, right:marginH,
                    display:dualCol?"grid":"block",
                    gridTemplateColumns:dualCol?"1fr 1fr":undefined, gap:20 }}>
        {[colA, ...(dualCol?[colB]:[])].map((col,ci) => (
          <div key={ci}>
            <ColHeader/>
            {col.map((t,i) => <Row key={i} t={t}/>)}
          </div>
        ))}
      </div>
    </Canvas>
  );
}


// ════════════════════════════════════════════════════════════════
// §8b  SCHEDULE + TOURNAMENT FORMAT TEMPLATES
// ════════════════════════════════════════════════════════════════

// ── Schedule (캘린더 그리드) ──────────────────────────────────
// ── 캘린더 자동 생성 헬퍼 ────────────────────────────────────
function buildCalendar(yearMonth, startDay, numWeeks, stages) {
  // "YYYY.MM" 파싱
  const parts = yearMonth.split(".");
  const year  = parseInt(parts[0], 10) || 2025;
  const month = parseInt(parts[1], 10) || 1;

  // startDay가 속한 주의 월요일 찾기
  const ref = new Date(year, month - 1, startDay);
  const dow = ref.getDay(); // 0=일, 1=월
  const toMon = dow === 0 ? -6 : 1 - dow;
  const firstMon = new Date(ref);
  firstMon.setDate(firstMon.getDate() + toMon);

  // "YYYY.MM.DD" → Date
  const parseDate = s => {
    const p = (s||"").split(".");
    if (p.length < 3) return null;
    return new Date(parseInt(p[0],10), parseInt(p[1],10)-1, parseInt(p[2],10));
  };

  const weeks = [];
  for (let w = 0; w < (numWeeks || 3); w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(firstMon);
      dt.setDate(dt.getDate() + w * 7 + d);
      days.push({
        dt,
        label: `${dt.getMonth()+1}.${String(dt.getDate()).padStart(2,"0")}`,
        // 기준 연월에 속하는지 (다른 달은 흐리게)
        inMonth: dt.getMonth() === month - 1 || dt.getMonth() === month % 12,
      });
    }

    // 이 주에 걸치는 스테이지 계산
    const weekStart = days[0].dt;
    const weekEnd   = days[6].dt;
    weekEnd.setHours(23, 59, 59);

    const spans = stages.map(s => {
      const ss = parseDate(s.start);
      const se = parseDate(s.end);
      if (!ss || !se) return null;
      if (se < weekStart || ss > weekEnd) return null;
      const colStart = Math.max(0, Math.round((ss - weekStart) / 86400000));
      const colEnd   = Math.min(6, Math.round((se - weekStart) / 86400000));
      return { ...s, colStart: colStart + 1, colEnd: colEnd + 1 };
    }).filter(Boolean);

    weeks.push({ days, spans });
  }
  return weeks;
}

function Schedule({ data:d, layout }) {
  const { marginH, marginV, contentTop } = layout;
  const DOW     = ["MON","TUE","WED","THU","FRI","SAT","SUN"];
  const headerH = 46;
  const gapV    = 6;
  const bottomRes = marginV + 48 + marginV;
  const availH  = 1080 - contentTop - bottomRes;
  const nWeeks  = d.numWeeks || 3;
  const cellH   = Math.floor((availH - headerH - gapV - gapV * (nWeeks - 1)) / nWeeks);
  const nameFz  = Math.min(46, Math.floor(cellH * 0.30));
  const dateFz  = Math.min(22, Math.floor(cellH * 0.15));
  const subFz   = Math.min(14, Math.floor(cellH * 0.10));

  // 자동 캘린더 생성
  const weeks = buildCalendar(
    d.yearMonth || "2025.11",
    d.startDay  || 1,
    nWeeks,
    d.stages    || []
  );

  return (
    <Canvas layout={layout}>
      <Chrome league={d.league} right={d.subtitle} bottom="TOURNAMENT SCHEDULE" layout={layout}/>
      <TitleBlock eyebrow="SCHEDULE" title={d.title} layout={layout}/>

      <div style={{ position:"absolute", top:contentTop, left:marginH, right:marginH }}>
        {/* 요일 헤더 */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:6, marginBottom:gapV }}>
          {DOW.map(dow => (
            <div key={dow} style={{
              height:headerH, display:"flex", alignItems:"center", justifyContent:"center",
              background:T.surface, border:`1px solid ${T.line}`,
              fontFamily:F.mono, fontSize:14, color:T.textMute, letterSpacing:"0.2em",
            }}>{dow}</div>
          ))}
        </div>

        {/* 주별 행 */}
        {weeks.map((week, wi) => (
          <div key={wi} style={{
            display:"grid",
            gridTemplateColumns:"repeat(7,1fr)",
            gridTemplateRows:`${cellH}px`,
            gap:6,
            marginBottom: wi < nWeeks - 1 ? gapV : 0,
          }}>
            {/* 날짜 셀 (배경) */}
            {week.days.map((day, di) => (
              <div key={di} style={{
                gridColumn: di + 1, gridRow:1,
                background:T.bgAlt, border:`1px solid ${T.line}`,
                padding:"10px 12px", boxSizing:"border-box", zIndex:1,
                opacity: day.inMonth ? 1 : 0.4,
              }}>
                <div style={{ fontFamily:F.mono, fontSize:dateFz,
                              color:T.textMute, letterSpacing:"0.08em" }}>
                  {day.label}
                </div>
              </div>
            ))}

            {/* 스테이지 스팬 (전경) */}
            {week.spans.map((s, si) => (
              <div key={si} style={{
                gridColumn: `${s.colStart} / ${s.colEnd + 1}`,
                gridRow:1, zIndex:2,
                background: s.color,
                display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"center", gap:6,
              }}>
                <div style={{ fontFamily:F.display, fontSize:nameFz,
                              color:s.textColor, letterSpacing:"0.02em",
                              lineHeight:1, textAlign:"center" }}>
                  {s.name}
                </div>
                <div style={{ fontFamily:F.mono, fontSize:subFz,
                              color:s.textColor, letterSpacing:"0.12em", opacity:0.7 }}>
                  {s.start?.slice(5).replace(".",".") } — {s.end?.slice(5).replace(".",".") }
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Canvas>
  );
}

// ── Tournament Format (브래킷 플로우) ────────────────────────
function TournamentFormat({ data:d, layout }) {
  const { marginH, marginV, titleTop, contentTop } = layout;

  // 팀 슬롯 도트 렌더
  const Slots = ({ total, advance=0, color }) => {
    const cols = Math.min(total, 8);
    return (
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, justifyContent:"center",
                    maxWidth: cols * 28 + (cols-1) * 6 }}>
        {Array.from({length:total}).map((_,i) => (
          <div key={i} style={{
            width:22, height:22,
            background: i < advance ? T.ok : T.surface,
            border:`1px solid ${i < advance ? T.ok : T.line}`,
            opacity: i < advance ? 1 : 0.6,
          }}/>
        ))}
      </div>
    );
  };

  // 단일 페이즈 카드
  const PhaseCard = ({ phase, isLast }) => {
    const hasGroups = !!phase.groups;
    return (
      <div style={{ display:"flex", alignItems:"center", gap:0, flex:1 }}>
        <div style={{ flex:1 }}>
          {/* 카드 헤더 */}
          <div style={{ background:phase.color, padding:"14px 24px", textAlign:"center" }}>
            <div style={{ fontFamily:F.display, fontSize:36, color:
              phase.color==="#FFFFFF"?"#000":
              phase.color==="#CA8A04"?"#000":"#fff",
              lineHeight:1, letterSpacing:"0.02em" }}>{phase.name}</div>
            <div style={{ fontFamily:F.mono, fontSize:12,
              color: phase.color==="#E53935"?"rgba(255,255,255,0.7)":"rgba(0,0,0,0.6)",
              letterSpacing:"0.15em", marginTop:6 }}>{phase.date}</div>
          </div>

          {/* 카드 바디 */}
          <div style={{ background:T.bgAlt, border:`1px solid ${T.line}`,
                        borderTop:"none", padding:"20px 24px",
                        display:"flex", flexDirection:"column", gap:20, alignItems:"center" }}>
            {hasGroups ? (
              phase.groups.map((g, gi) => (
                <div key={gi} style={{ textAlign:"center" }}>
                  <div style={{ fontFamily:F.mono, fontSize:11, color:T.textMute,
                                letterSpacing:"0.2em", marginBottom:10 }}>{g.name}</div>
                  <Slots total={g.totalSlots} advance={g.advanceSlots} color={phase.color}/>
                  <div style={{ fontFamily:F.mono, fontSize:9, color:T.ok,
                                letterSpacing:"0.15em", marginTop:8 }}>
                    TOP {g.advanceSlots} ADVANCE
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign:"center" }}>
                <Slots total={phase.totalSlots||16} advance={phase.advanceSlots||0} color={phase.color}/>
                {phase.advanceSlots > 0 && (
                  <div style={{ fontFamily:F.mono, fontSize:9, color:T.ok,
                                letterSpacing:"0.15em", marginTop:10 }}>
                    TOP {phase.advanceSlots} ADVANCE TO FINALS
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 화살표 연결 */}
        {!isLast && (
          <div style={{ display:"flex", alignItems:"center", flexShrink:0, padding:"0 16px",
                        color:T.accent, fontFamily:F.mono, fontSize:28 }}>→</div>
        )}
      </div>
    );
  };

  return (
    <Canvas layout={layout}>
      <Chrome league={d.league} right={d.subtitle} bottom="TOURNAMENT FORMAT" layout={layout}/>
      <TitleBlock eyebrow="TOURNAMENT FORMAT" title={d.title} layout={layout}/>

      <div style={{ position:"absolute", top:contentTop, left:marginH, right:marginH,
                    display:"flex", alignItems:"flex-start", gap:0 }}>
        {d.phases.map((phase, pi) => (
          <PhaseCard key={pi} phase={phase} isLast={pi===d.phases.length-1}/>
        ))}
      </div>
    </Canvas>
  );
}

// ════════════════════════════════════════════════════════════════
// §9  TEMPLATE REGISTRY  (Comp + Form + data 단일 출처)
// ════════════════════════════════════════════════════════════════
// Form 함수들은 §10에서 `function` 선언으로 정의되며 호이스팅되므로
// 여기서 안전하게 참조 가능.
const TEMPLATES = {
  scoreboard:       { name:"Scoreboard",        Comp:Scoreboard,       Form:ScoreboardForm,       data:DEFAULT_DATA.scoreboard       },
  nextMatch:        { name:"Next Match Up",     Comp:NextMatch,        Form:NextMatchForm,        data:DEFAULT_DATA.nextMatch        },
  overview:         { name:"Overview / Teams",  Comp:Overview,         Form:OverviewForm,         data:DEFAULT_DATA.overview         },
  roster:           { name:"Team Roster",       Comp:Roster,           Form:RosterForm,           data:DEFAULT_DATA.roster           },
  prediction:       { name:"Caster Prediction", Comp:Prediction,       Form:PredictionForm,       data:DEFAULT_DATA.prediction       },
  lowerThird:       { name:"Lower Third",       Comp:LowerThird,       Form:LowerThirdForm,       data:DEFAULT_DATA.lowerThird       },
  brLeaderboard:    { name:"BR Leaderboard",    Comp:BRLeaderboard,    Form:BRLeaderboardForm,    data:DEFAULT_DATA.brLeaderboard    },
  schedule:         { name:"Schedule",          Comp:Schedule,         Form:ScheduleForm,         data:DEFAULT_DATA.schedule         },
  tournamentFormat: { name:"Tournament Format", Comp:TournamentFormat, Form:TournamentFormatForm, data:DEFAULT_DATA.tournamentFormat },
};

// ════════════════════════════════════════════════════════════════
// §10  FORM COMPONENTS
// ════════════════════════════════════════════════════════════════
function ScoreboardForm({ data:d, setData }) {
  const upTeam = (i,v) => setData(p=>({...p,teams:p.teams.map((t,j)=>j===i?{...t,...v}:t)}));
  return (
    <>
      <PanelSection label="// MATCH INFO">
        <FieldRow label="League"   value={d.league}   onChange={v=>setData(p=>({...p,league:v}))}/>
        <SelectRow label="Format"  value={d.format}   onChange={v=>setData(p=>({...p,format:v}))}  options={["BO1","BO3","BO5","BO7"]}/>
        <SelectRow label="Status"  value={d.status}   onChange={v=>setData(p=>({...p,status:v}))}  options={["LIVE","FINAL","UPCOMING"]}/>
        <FieldRow  label="Timecode"value={d.timecode} onChange={v=>setData(p=>({...p,timecode:v}))} mono/>
        <FieldRow  label="Day"     value={d.day}      onChange={v=>setData(p=>({...p,day:v}))}     type="number"/>
        <FieldRow  label="Match"   value={d.match}    onChange={v=>setData(p=>({...p,match:v}))}   type="number"/>
      </PanelSection>
      {[0,1].map(i => (
        <PanelSection key={i} label={i===0?"// HOME TEAM":"// AWAY TEAM"}>
          <FieldRow  label="Name"    value={d.teams[i].name}    onChange={v=>upTeam(i,{name:v})}/>
          <FieldRow  label="Short"   value={d.teams[i].short}   onChange={v=>upTeam(i,{short:v})} mono/>
          <FieldRow  label="Initial" value={d.teams[i].initial} onChange={v=>upTeam(i,{initial:v.toUpperCase()})} mono/>
          <ColorRow  label="Color"   value={d.teams[i].color}   onChange={v=>upTeam(i,{color:v})}/>
          <ScoreSpinner label="Score" value={d.teams[i].score}  onChange={v=>upTeam(i,{score:v})}/>
        </PanelSection>
      ))}
    </>
  );
}

function NextMatchForm({ data:d, setData }) {
  const upMatch = (i,side,v) => setData(p=>({...p,matches:p.matches.map((m,j)=>j===i?{...m,[side]:{...m[side],...v}}:m)}));
  return (
    <>
      <PanelSection label="// DAY INFO">
        <FieldRow label="League"    value={d.league}   onChange={v=>setData(p=>({...p,league:v}))}/>
        <FieldRow label="Day Label" value={d.dayLabel} onChange={v=>setData(p=>({...p,dayLabel:v}))} mono/>
      </PanelSection>
      {d.matches.map((m,i) => (
        <PanelSection key={i} label={`// MATCH ${String(i+1).padStart(2,"0")}`} defaultOpen={false}>
          <div style={{ padding:"4px 18px 2px", fontFamily:UI_F.mono, fontSize:9,
                        color:UI.accent, letterSpacing:"0.2em" }}>HOME</div>
          <FieldRow label="Name"    value={m.home.name}    onChange={v=>upMatch(i,"home",{name:v})}/>
          <FieldRow label="Initial" value={m.home.initial} onChange={v=>upMatch(i,"home",{initial:v.toUpperCase()})} mono/>
          <ColorRow label="Color"   value={m.home.color}   onChange={v=>upMatch(i,"home",{color:v})}/>
          <div style={{ padding:"8px 18px 2px", fontFamily:UI_F.mono, fontSize:9,
                        color:UI.textMute, letterSpacing:"0.2em" }}>AWAY</div>
          <FieldRow label="Name"    value={m.away.name}    onChange={v=>upMatch(i,"away",{name:v})}/>
          <FieldRow label="Initial" value={m.away.initial} onChange={v=>upMatch(i,"away",{initial:v.toUpperCase()})} mono/>
          <ColorRow label="Color"   value={m.away.color}   onChange={v=>upMatch(i,"away",{color:v})}/>
          <FieldRow label="Time"    value={m.time}         onChange={v=>setData(p=>({...p,matches:p.matches.map((x,j)=>j===i?{...x,time:v}:x)}))} mono/>
        </PanelSection>
      ))}
    </>
  );
}

function OverviewForm({ data:d, setData }) {
  const upTeam = (i,v) => setData(p=>({...p,teams:p.teams.map((t,j)=>j===i?{...t,...v}:t)}));
  const addTeam = () => setData(p=>({...p,teams:[...p.teams,{name:"NEW TEAM",short:"NEW",color:"#888888",initial:"N"}]}));
  const removeTeam = i => setData(p=>({...p,teams:p.teams.filter((_,j)=>j!==i)}));
  return (
    <>
      <PanelSection label="// EVENT INFO">
        <FieldRow label="League"   value={d.league}   onChange={v=>setData(p=>({...p,league:v}))}/>
        <FieldRow label="Subtitle" value={d.subtitle} onChange={v=>setData(p=>({...p,subtitle:v}))} mono/>
      </PanelSection>
      <PanelSection label={`// TEAMS (${d.teams.length})`}>
        {d.teams.map((t,i) => (
          <TeamRowCard key={i} team={t} index={i}
            onChange={v=>upTeam(i,v)} onRemove={()=>removeTeam(i)}/>
        ))}
        <AddButton onClick={addTeam} label="+ ADD TEAM"/>
      </PanelSection>
    </>
  );
}

function RosterForm({ data:d, setData }) {
  const upTeam = v => setData(p=>({...p,team:{...p.team,...v}}));
  const upPlayer = (i,v) => setData(p=>({...p,players:p.players.map((x,j)=>j===i?{...x,...v}:x)}));
  return (
    <>
      <PanelSection label="// TEAM">
        <FieldRow  label="League"  value={d.league}       onChange={v=>setData(p=>({...p,league:v}))}/>
        <FieldRow  label="Name"    value={d.team.name}    onChange={v=>upTeam({name:v})}/>
        <FieldRow  label="Short"   value={d.team.short}   onChange={v=>upTeam({short:v})} mono/>
        <FieldRow  label="Initial" value={d.team.initial} onChange={v=>upTeam({initial:v.toUpperCase()})} mono/>
        <ColorRow  label="Color"   value={d.team.color}   onChange={v=>upTeam({color:v})}/>
      </PanelSection>
      <PanelSection label={`// PLAYERS (${d.players.length})`}>
        {d.players.map((p,i) => (
          <div key={i} style={{ margin:"4px 18px", padding:"9px 12px",
                                background:UI.surface, border:`1px solid ${UI.line}` }}>
            <div style={{ display:"flex", gap:8, marginBottom:6, alignItems:"center" }}>
              <div style={{ fontFamily:UI_F.mono, fontSize:9, color:UI.accent,
                            letterSpacing:"0.2em", minWidth:24 }}>
                {String(i+1).padStart(2,"0")}
              </div>
              <input value={p.handle}
                onChange={e=>upPlayer(i,{handle:e.target.value.toUpperCase()})}
                style={{ flex:1, background:UI.bg, border:`1px solid ${UI.line}`, color:UI.text,
                         fontFamily:UI_F.display, fontSize:14, padding:"4px 8px", outline:"none" }}/>
              <input value={p.position} maxLength={3}
                onChange={e=>upPlayer(i,{position:e.target.value.toUpperCase()})}
                style={{ width:44, background:UI.bg, border:`1px solid ${UI.line}`, color:UI.accent,
                         fontFamily:UI_F.mono, fontSize:10, padding:"4px 6px",
                         outline:"none", textAlign:"center" }}/>
              <input value={p.number} type="number"
                onChange={e=>upPlayer(i,{number:Number(e.target.value)})}
                style={{ width:42, background:UI.bg, border:`1px solid ${UI.line}`, color:UI.textDim,
                         fontFamily:UI_F.mono, fontSize:10, padding:"4px 6px",
                         outline:"none", textAlign:"center" }}/>
            </div>
          </div>
        ))}
      </PanelSection>
    </>
  );
}

function PredictionForm({ data:d, setData }) {
  const upSide = (side,v) => setData(p=>({...p,matchup:{...p.matchup,[side]:{...p.matchup[side],...v}}}));
  const upCaster = (i,v) => setData(p=>({...p,casters:p.casters.map((c,j)=>j===i?{...c,...v}:c)}));
  return (
    <>
      <PanelSection label="// MATCHUP">
        <FieldRow  label="League"  value={d.league}          onChange={v=>setData(p=>({...p,league:v}))}/>
        <SelectRow label="Format"  value={d.matchup.format}  onChange={v=>setData(p=>({...p,matchup:{...p.matchup,format:v}}))} options={["BO1","BO3","BO5","BO7"]}/>
        {["home","away"].map(side => (
          <div key={side}>
            <div style={{ padding:"8px 18px 2px", fontFamily:UI_F.mono, fontSize:9,
                          color:side==="home"?UI.accent:UI.textMute, letterSpacing:"0.2em" }}>
              {side.toUpperCase()}
            </div>
            <FieldRow  label="Name"    value={d.matchup[side].name}    onChange={v=>upSide(side,{name:v})}/>
            <FieldRow  label="Initial" value={d.matchup[side].initial} onChange={v=>upSide(side,{initial:v.toUpperCase()})} mono/>
            <ColorRow  label="Color"   value={d.matchup[side].color}   onChange={v=>upSide(side,{color:v})}/>
          </div>
        ))}
      </PanelSection>
      <PanelSection label={`// CASTERS (${d.casters.length})`}>
        {d.casters.map((c,i) => {
          const pt = c.pick==="home"?d.matchup.home:d.matchup.away;
          return (
            <div key={i} style={{ margin:"4px 18px", padding:"8px 12px",
                                  background:UI.surface, border:`1px solid ${UI.line}`,
                                  borderTop:`2px solid ${pt.color}` }}>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <input value={c.name} onChange={e=>upCaster(i,{name:e.target.value.toUpperCase()})}
                  style={{ flex:1, background:UI.bg, border:`1px solid ${UI.line}`, color:UI.text,
                           fontFamily:UI_F.display, fontSize:14, padding:"4px 8px", outline:"none" }}/>
                <select value={c.pick} onChange={e=>upCaster(i,{pick:e.target.value})}
                  style={{ background:UI.bg, border:`1px solid ${UI.line}`, color:UI.accent,
                           fontFamily:UI_F.mono, fontSize:10, padding:"4px 8px", outline:"none", cursor:"pointer" }}>
                  <option value="home">HOME</option>
                  <option value="away">AWAY</option>
                </select>
                <input value={c.score} maxLength={5}
                  onChange={e=>upCaster(i,{score:e.target.value})}
                  style={{ width:54, background:UI.bg, border:`1px solid ${UI.line}`, color:UI.textDim,
                           fontFamily:UI_F.mono, fontSize:11, padding:"4px 6px",
                           outline:"none", textAlign:"center" }}/>
              </div>
            </div>
          );
        })}
      </PanelSection>
    </>
  );
}

function LowerThirdForm({ data:d, setData }) {
  const upP = v => setData(p=>({...p,player:{...p.player,...v}}));
  const upC = v => setData(p=>({...p,caster:{...p.caster,...v}}));
  const upT = v => setData(p=>({...p,teamCallout:{...p.teamCallout,...v}}));
  const upE = v => setData(p=>({...p,event:{...p.event,...v}}));
  return (
    <>
      <PanelSection label="// TYPE">
        <SelectRow label="Variant" value={d.variant}
          onChange={v=>setData(p=>({...p,variant:v}))}
          options={["player","caster","team","event"]}/>
        <FieldRow label="League" value={d.league} onChange={v=>setData(p=>({...p,league:v}))}/>
      </PanelSection>
      {d.variant==="player" && (
        <PanelSection label="// PLAYER">
          <FieldRow label="Handle"   value={d.player.handle}    onChange={v=>upP({handle:v.toUpperCase()})} mono/>
          <FieldRow label="Name"     value={d.player.name}      onChange={v=>upP({name:v})}/>
          <FieldRow label="Position" value={d.player.position}  onChange={v=>upP({position:v.toUpperCase()})} mono/>
          <FieldRow label="Number"   value={d.player.number}    onChange={v=>upP({number:v})} type="number"/>
          <FieldRow label="Team"     value={d.player.team}      onChange={v=>upP({team:v})}/>
          <FieldRow label="Short"    value={d.player.teamShort} onChange={v=>upP({teamShort:v.toUpperCase()})} mono/>
          <FieldRow label="Initial"  value={d.player.teamInitial} onChange={v=>upP({teamInitial:v.toUpperCase()})} mono/>
          <ColorRow label="Color"    value={d.player.teamColor} onChange={v=>upP({teamColor:v})}/>
        </PanelSection>
      )}
      {d.variant==="caster" && (
        <PanelSection label="// CASTER">
          <FieldRow label="Name" value={d.caster.name} onChange={v=>upC({name:v})}/>
          <FieldRow label="Role" value={d.caster.role} onChange={v=>upC({role:v.toUpperCase()})} mono/>
          <FieldRow label="Org"  value={d.caster.org}  onChange={v=>upC({org:v})}/>
        </PanelSection>
      )}
      {d.variant==="team" && (
        <PanelSection label="// TEAM CALLOUT">
          <FieldRow label="Name"    value={d.teamCallout.name}    onChange={v=>upT({name:v})}/>
          <FieldRow label="Short"   value={d.teamCallout.short}   onChange={v=>upT({short:v.toUpperCase()})} mono/>
          <FieldRow label="Tagline" value={d.teamCallout.tagline} onChange={v=>upT({tagline:v.toUpperCase()})} mono/>
          <FieldRow label="Initial" value={d.teamCallout.initial} onChange={v=>upT({initial:v.toUpperCase()})} mono/>
          <ColorRow label="Color"   value={d.teamCallout.color}   onChange={v=>upT({color:v})}/>
        </PanelSection>
      )}
      {d.variant==="event" && (
        <PanelSection label="// EVENT">
          <FieldRow label="Headline" value={d.event.headline} onChange={v=>upE({headline:v.toUpperCase()})} mono/>
          <FieldRow label="Sub"      value={d.event.sub}      onChange={v=>upE({sub:v.toUpperCase()})} mono/>
          <ColorRow label="Accent"   value={d.event.accent||"#D4FF00"} onChange={v=>upE({accent:v})}/>
        </PanelSection>
      )}
    </>
  );
}

function BRLeaderboardForm({ data:d, setData }) {
  const upTeam = (i,v) => setData(p=>({...p,teams:p.teams.map((t,j)=>j===i?{...t,...v}:t)}));
  const addTeam = () => setData(p=>({...p,teams:[...p.teams,{
    rank:p.teams.length+1,name:"NEW TEAM",short:"NEW",region:"AS",
    color:"#888888",initial:"N",kills:0,placement:0,total:0,trend:"same"
  }]}));
  return (
    <>
      <PanelSection label="// MATCH INFO">
        <FieldRow label="League"       value={d.league}      onChange={v=>setData(p=>({...p,league:v}))}/>
        <FieldRow label="Round"        value={d.round}       onChange={v=>setData(p=>({...p,round:v}))} type="number"/>
        <FieldRow label="Total Rounds" value={d.totalRounds} onChange={v=>setData(p=>({...p,totalRounds:v}))} type="number"/>
        <FieldRow label="Point System" value={d.pointSystem} onChange={v=>setData(p=>({...p,pointSystem:v}))} mono/>
      </PanelSection>
      <PanelSection label="// ZONE SETTINGS">
        <FieldRow label="Advance (TOP)" value={d.advanceZone} onChange={v=>setData(p=>({...p,advanceZone:v}))} type="number"/>
        <FieldRow label="Safe (TOP)"    value={d.safeZone}    onChange={v=>setData(p=>({...p,safeZone:v}))}    type="number"/>
        <FieldRow label="Danger (TOP)"  value={d.dangerZone}  onChange={v=>setData(p=>({...p,dangerZone:v}))}  type="number"/>
      </PanelSection>
      <PanelSection label={`// TEAMS (${d.teams.length})`}>
        {d.teams.map((t,i) => (
          <div key={i} style={{ margin:"4px 18px", padding:"8px 10px",
                                background:UI.surface, border:`1px solid ${UI.line}`,
                                borderLeft:`3px solid ${t.color}` }}>
            <div style={{ display:"flex", gap:6, marginBottom:6, alignItems:"center" }}>
              <div style={{ fontFamily:UI_F.mono, fontSize:9, color:UI.accent,
                            letterSpacing:"0.2em", minWidth:22 }}>
                {String(i+1).padStart(2,"0")}
              </div>
              <input value={t.name} onChange={e=>upTeam(i,{name:e.target.value})}
                style={{ flex:1, background:UI.bg, border:`1px solid ${UI.line}`, color:UI.text,
                         fontFamily:UI_F.narrow, fontSize:11, fontWeight:700,
                         padding:"4px 7px", outline:"none" }}/>
              <input value={t.region} maxLength={4}
                onChange={e=>upTeam(i,{region:e.target.value.toUpperCase()})}
                style={{ width:42, background:UI.bg, border:`1px solid ${UI.line}`, color:UI.textDim,
                         fontFamily:UI_F.mono, fontSize:10, padding:"4px 5px",
                         outline:"none", textAlign:"center" }}/>
              <select value={t.trend||"same"} onChange={e=>upTeam(i,{trend:e.target.value})}
                style={{ width:46, background:UI.bg, border:`1px solid ${UI.line}`, color:UI.accent,
                         fontFamily:UI_F.mono, fontSize:11, padding:"3px 4px",
                         outline:"none", cursor:"pointer" }}>
                <option value="up">▲</option>
                <option value="same">—</option>
                <option value="down">▼</option>
              </select>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"40px 1fr 46px 46px 50px", gap:6, alignItems:"center" }}>
              <label style={{ position:"relative", width:40, height:28, cursor:"pointer" }}>
                <div style={{ width:40, height:28, background:t.color,
                              border:"1px solid rgba(255,255,255,0.1)" }}/>
                <input type="color" value={t.color} onChange={e=>upTeam(i,{color:e.target.value})}
                  style={{ position:"absolute", inset:0, opacity:0, cursor:"pointer",
                           width:"100%", height:"100%" }}/>
              </label>
              <input value={t.initial} maxLength={2}
                onChange={e=>upTeam(i,{initial:e.target.value.toUpperCase().slice(0,2)})}
                style={{ background:UI.bg, border:`1px solid ${UI.line}`, color:UI.text,
                         fontFamily:UI_F.display, fontSize:14, padding:"3px 6px",
                         outline:"none", textAlign:"center" }}/>
              {["kills","placement","total"].map(k => (
                <input key={k} type="number" value={t[k]}
                  onChange={e=>upTeam(i,{[k]:Number(e.target.value)})}
                  style={{ background:UI.bg, border:`1px solid ${UI.line}`,
                           color:k==="total"?UI.accent:UI.text,
                           fontFamily:UI_F.mono, fontSize:11, padding:"3px 5px",
                           outline:"none", textAlign:"center",
                           fontWeight:k==="total"?"700":"400" }}/>
              ))}
            </div>
          </div>
        ))}
        <AddButton onClick={addTeam} label="+ ADD TEAM"/>
      </PanelSection>
    </>
  );
}

// ── CalendarPicker (스케줄 날짜 선택 팝업) ─────────────────────
const MONTH_NAMES = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const DOW_SHORT = ["Mo","Tu","We","Th","Fr","Sa","Su"];

function CalendarPicker({ value, stageColor, onSelect, onClose, label="" }) {
  // value: "YYYY.MM.DD" 또는 ""
  const parseYMD = str => {
    const p = (str||"").split(".");
    return p.length === 3 ? [+p[0], +p[1], +p[2]] : [null, null, null];
  };
  const [selY, selM, selD] = parseYMD(value);

  const today = new Date();
  const [viewY, setViewY] = useState(selY || today.getFullYear());
  const [viewM, setViewM] = useState(selM || today.getMonth()+1); // 1-indexed

  const prevMonth = () => {
    if (viewM === 1) { setViewY(viewY-1); setViewM(12); }
    else setViewM(viewM-1);
  };
  const nextMonth = () => {
    if (viewM === 12) { setViewY(viewY+1); setViewM(1); }
    else setViewM(viewM+1);
  };

  // 이번 달 첫째 날 요일 (월=0 ... 일=6)
  const firstDow = (new Date(viewY, viewM-1, 1).getDay() + 6) % 7; // Mon-based
  const daysInMonth = new Date(viewY, viewM, 0).getDate();
  const daysInPrev  = new Date(viewY, viewM-1, 0).getDate();

  // 6주 × 7일 셀 생성
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const pos = i - firstDow + 1;
    if (pos <= 0) {
      cells.push({ d: daysInPrev + pos, cur: false });
    } else if (pos > daysInMonth) {
      cells.push({ d: pos - daysInMonth, cur: false });
    } else {
      cells.push({ d: pos, cur: true });
    }
  }

  const accent = stageColor || "#D4FF00";
  const isSelected = c => c.cur && selY===viewY && selM===viewM && selD===c.d;
  const isToday = c => c.cur && viewY===today.getFullYear()
    && viewM===today.getMonth()+1 && c.d===today.getDate();

  return (
    <div style={{ userSelect:"none" }}>
      {/* 헤더 */}
      <div style={{ padding:"14px 16px 10px", borderBottom:`1px solid ${UI.line}33`,
                    display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ fontFamily:UI_F.mono, fontSize:10, color:accent,
                      letterSpacing:"0.15em" }}>{label}</div>
        <button onClick={onClose} style={{ background:"transparent", border:"none",
                                           color:UI.textMute, fontFamily:UI_F.mono, fontSize:12,
                                           cursor:"pointer", padding:"2px 6px" }}>✕</button>
      </div>

      {/* 월 네비게이션 */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                    padding:"10px 16px 8px" }}>
        <button onClick={prevMonth} style={{
          width:30, height:30, background:UI.surface, border:`1px solid ${UI.line}44`,
          borderRadius:"50%", color:UI.textDim, fontFamily:UI_F.mono, fontSize:14,
          cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
        }}>‹</button>
        <div style={{ fontFamily:UI_F.narrow, fontSize:16, fontWeight:700, color:UI.text,
                      letterSpacing:"0.05em" }}>
          {MONTH_NAMES[viewM-1]} {viewY}
        </div>
        <button onClick={nextMonth} style={{
          width:30, height:30, background:UI.surface, border:`1px solid ${UI.line}44`,
          borderRadius:"50%", color:UI.textDim, fontFamily:UI_F.mono, fontSize:14,
          cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
        }}>›</button>
      </div>

      {/* 요일 헤더 */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)",
                    padding:"0 12px", gap:2, marginBottom:4 }}>
        {DOW_SHORT.map(dow => (
          <div key={dow} style={{ textAlign:"center", padding:"4px 0",
                                   fontFamily:UI_F.mono, fontSize:10, color:UI.textMute,
                                   letterSpacing:"0.05em" }}>{dow}</div>
        ))}
      </div>

      {/* 날짜 셀 */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)",
                    padding:"0 12px 14px", gap:2 }}>
        {cells.map((cell, idx) => {
          const sel = isSelected(cell);
          const tod = isToday(cell);
          return (
            <button key={idx}
              onClick={() => {
                if (!cell.cur) return;
                const ym = `${viewY}.${String(viewM).padStart(2,"0")}.${String(cell.d).padStart(2,"0")}`;
                onSelect(ym);
              }}
              style={{
                width:"100%", aspectRatio:"1", borderRadius:6,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontFamily:UI_F.narrow, fontSize:13, fontWeight:sel?700:400,
                cursor: cell.cur ? "pointer" : "default",
                background: sel ? accent : "transparent",
                color: sel ? (accent==="#FFFFFF"||accent==="#E8EAF0"?"#000":UI.bg)
                           : cell.cur ? UI.text : UI.textMute,
                border: tod && !sel ? `1px solid ${accent}88` : "1px solid transparent",
                opacity: cell.cur ? 1 : 0.3,
                transition:"background 0.1s",
              }}>
              {cell.d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScheduleForm({ data:d, setData }) {
  // picker: { stageIdx, field:"start"|"end" } | null
  const [picker, setPicker] = useState(null);

  const upStage = (i, val) => setData(p => ({
    ...p, stages: p.stages.map((s, j) => j === i ? {...s, ...val} : s)
  }));
  const addStage = () => setData(p => ({
    ...p, stages: [...p.stages, {
      name:"NEW STAGE", start:"2025.01.01", end:"2025.01.03",
      color:"#4B5563", textColor:"#FFFFFF"
    }]
  }));
  const removeStage = i => setData(p => ({ ...p, stages: p.stages.filter((_,j)=>j!==i) }));

  const pickDate = (stageIdx, field) => setPicker({ stageIdx, field });
  const onPick = dateStr => {
    if (!picker) return;
    upStage(picker.stageIdx, { [picker.field]: dateStr });
    setPicker(null);
  };
  const pickerValue = picker
    ? (d.stages[picker.stageIdx]?.[picker.field] || "")
    : "";

  // YYYY.MM.DD → { y, m, d } 파싱
  const parseDate = str => {
    const p = (str||"").split(".");
    return p.length === 3 ? { y:+p[0], m:+p[1], d:+p[2] } : null;
  };
  // 날짜 display
  const fmtDate = str => {
    const p = parseDate(str);
    return p ? `${p.y}.${String(p.m).padStart(2,"0")}.${String(p.d).padStart(2,"0")}` : "—";
  };

  return (
    <>
      <PanelSection label="EVENT INFO">
        <FieldRow label="League"   value={d.league}   onChange={v=>setData(p=>({...p,league:v}))}/>
        <FieldRow label="Title"    value={d.title}    onChange={v=>setData(p=>({...p,title:v}))} mono/>
        <FieldRow label="Subtitle" value={d.subtitle} onChange={v=>setData(p=>({...p,subtitle:v}))} mono/>
        <div style={{ display:"flex", gap:8, padding:"4px 18px", alignItems:"center" }}>
          <div style={{ fontFamily:UI_F.mono, fontSize:10, color:UI.textMute,
                        letterSpacing:"0.1em", width:88, textTransform:"uppercase" }}>Weeks</div>
          <div style={{ display:"flex", flex:1 }}>
            <button onClick={()=>setData(p=>({...p,numWeeks:Math.max(2,(p.numWeeks||3)-1)}))}
              style={{ width:32, height:32, background:UI.bgAlt, border:`1px solid ${UI.line}44`,
                       color:UI.textDim, fontFamily:UI_F.mono, fontSize:14, cursor:"pointer" }}>−</button>
            <div style={{ flex:1, height:32, background:UI.bgAlt,
                          border:`1px solid ${UI.line}44`, borderLeft:"none", borderRight:"none",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontFamily:UI_F.mono, fontSize:13, color:UI.accent }}>
              {d.numWeeks||3}주
            </div>
            <button onClick={()=>setData(p=>({...p,numWeeks:Math.min(5,(p.numWeeks||3)+1)}))}
              style={{ width:32, height:32, background:UI.bgAlt, border:`1px solid ${UI.line}44`,
                       color:UI.textDim, fontFamily:UI_F.mono, fontSize:14, cursor:"pointer" }}>+</button>
          </div>
        </div>
      </PanelSection>

      <PanelSection label={`STAGES (${(d.stages||[]).length})`}>
        {(d.stages||[]).map((s, i) => (
          <div key={i} style={{ margin:"4px 14px 2px", borderRadius:4,
                                background:UI.bgAlt, borderLeft:`3px solid ${s.color}`,
                                padding:"10px 12px" }}>
            {/* 스테이지명 + 삭제 */}
            <div style={{ display:"flex", gap:8, marginBottom:10, alignItems:"center" }}>
              <div style={{ fontFamily:UI_F.mono, fontSize:10, color:UI.accent,
                            letterSpacing:"0.15em", minWidth:20, opacity:0.7 }}>
                {String(i+1).padStart(2,"0")}
              </div>
              <input value={s.name} onChange={e=>upStage(i,{name:e.target.value.toUpperCase()})}
                style={{ flex:1, background:UI.bg, border:`1px solid ${UI.line}44`,
                         borderRadius:3, color:UI.text, fontFamily:UI_F.narrow, fontSize:12,
                         fontWeight:700, padding:"5px 8px", outline:"none" }}/>
              <button onClick={()=>removeStage(i)} style={{
                background:"transparent", border:"none", color:UI.textMute,
                fontFamily:UI_F.mono, fontSize:12, padding:"3px 6px", cursor:"pointer",
              }}>✕</button>
            </div>

            {/* 날짜 범위 — 달력 버튼 */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 20px 1fr", gap:4,
                          alignItems:"center", marginBottom:10 }}>
              {/* 시작일 */}
              <button onClick={()=>pickDate(i,"start")} style={{
                padding:"8px 6px", borderRadius:3, cursor:"pointer",
                background: picker?.stageIdx===i && picker?.field==="start"
                  ? `${s.color}30` : UI.bg,
                border:`1px solid ${
                  picker?.stageIdx===i && picker?.field==="start" ? s.color : `${UI.line}55`}`,
                display:"flex", flexDirection:"column", alignItems:"center", gap:3,
              }}>
                <div style={{ fontFamily:UI_F.mono, fontSize:9, color:UI.textMute,
                              letterSpacing:"0.15em" }}>START</div>
                <div style={{ fontFamily:UI_F.mono, fontSize:12, color:UI.text,
                              letterSpacing:"0.05em" }}>{fmtDate(s.start)}</div>
              </button>

              <div style={{ fontFamily:UI_F.mono, fontSize:11, color:UI.textMute,
                            textAlign:"center" }}>→</div>

              {/* 종료일 */}
              <button onClick={()=>pickDate(i,"end")} style={{
                padding:"8px 6px", borderRadius:3, cursor:"pointer",
                background: picker?.stageIdx===i && picker?.field==="end"
                  ? `${s.color}30` : UI.bg,
                border:`1px solid ${
                  picker?.stageIdx===i && picker?.field==="end" ? s.color : `${UI.line}55`}`,
                display:"flex", flexDirection:"column", alignItems:"center", gap:3,
              }}>
                <div style={{ fontFamily:UI_F.mono, fontSize:9, color:UI.textMute,
                              letterSpacing:"0.15em" }}>END</div>
                <div style={{ fontFamily:UI_F.mono, fontSize:12, color:UI.text,
                              letterSpacing:"0.05em" }}>{fmtDate(s.end)}</div>
              </button>
            </div>

            {/* 색상 */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
              <ColorRow label="Fill" value={s.color}     onChange={v=>upStage(i,{color:v})}/>
              <ColorRow label="Text" value={s.textColor} onChange={v=>upStage(i,{textColor:v})}/>
            </div>
          </div>
        ))}
        <AddButton onClick={addStage} label="+ ADD STAGE"/>
      </PanelSection>

      {/* ── 달력 피커 팝업 ── */}
      {picker && (
        <div style={{
          position:"fixed", inset:0, zIndex:9999,
        }} onClick={e => { if(e.target===e.currentTarget) setPicker(null); }}>
          <div style={{
            position:"absolute", left:18, top:"50%", transform:"translateY(-50%)",
            width:324, background:"#1A1D26", borderRadius:8,
            border:`1px solid ${UI.line}`, boxShadow:"0 12px 40px rgba(0,0,0,0.6)",
            overflow:"hidden",
          }}>
            <CalendarPicker
              value={pickerValue}
              stageColor={(d.stages[picker.stageIdx]||{}).color||UI.accent}
              onSelect={onPick}
              onClose={()=>setPicker(null)}
              label={picker.field==="start"?"시작일 선택":"종료일 선택"}
            />
          </div>
        </div>
      )}
    </>
  );
}
function TournamentFormatForm({ data:d, setData }) {
  const upPhase = (i, val) => setData(p=>({...p,phases:p.phases.map((ph,j)=>j===i?{...ph,...val}:ph)}));
  return (
    <>
      <PanelSection label="// EVENT INFO">
        <FieldRow label="League"   value={d.league}   onChange={v=>setData(p=>({...p,league:v}))}/>
        <FieldRow label="Title"    value={d.title}    onChange={v=>setData(p=>({...p,title:v}))} mono/>
        <FieldRow label="Subtitle" value={d.subtitle} onChange={v=>setData(p=>({...p,subtitle:v}))} mono/>
      </PanelSection>
      {d.phases.map((phase, pi) => (
        <PanelSection key={pi} label={`// PHASE ${pi+1}: ${phase.name}`}>
          <FieldRow label="Name"  value={phase.name} onChange={v=>upPhase(pi,{name:v})} mono/>
          <FieldRow label="Date"  value={phase.date} onChange={v=>upPhase(pi,{date:v})} mono/>
          <ColorRow label="Color" value={phase.color} onChange={v=>upPhase(pi,{color:v})}/>
          {phase.groups ? (
            phase.groups.map((g, gi) => (
              <div key={gi}>
                <div style={{ padding:"4px 18px 2px", fontFamily:UI_F.mono, fontSize:9,
                              color:UI.textMute, letterSpacing:"0.15em" }}>{g.name}</div>
                <FieldRow label="Total Teams" value={g.totalSlots}   onChange={v=>setData(p=>({...p,phases:p.phases.map((ph,j)=>j===pi?{...ph,groups:ph.groups.map((gg,k)=>k===gi?{...gg,totalSlots:Number(v)}:gg)}:ph)}))} type="number"/>
                <FieldRow label="Advance"     value={g.advanceSlots} onChange={v=>setData(p=>({...p,phases:p.phases.map((ph,j)=>j===pi?{...ph,groups:ph.groups.map((gg,k)=>k===gi?{...gg,advanceSlots:Number(v)}:gg)}:ph)}))} type="number"/>
              </div>
            ))
          ) : (
            <>
              <FieldRow label="Total Slots"   value={phase.totalSlots||0}   onChange={v=>upPhase(pi,{totalSlots:Number(v)})}   type="number"/>
              <FieldRow label="Advance Slots" value={phase.advanceSlots||0} onChange={v=>upPhase(pi,{advanceSlots:Number(v)})} type="number"/>
            </>
          )}
        </PanelSection>
      ))}
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// §11  LAYOUT PANEL
// ════════════════════════════════════════════════════════════════
function LayoutPanel({ layout, setLayout, setThemeKey, titleAlign }) {
  const upL = (k,v) => setLayout(l=>({...l,[k]:v}));

  // titleAlign은 themeState 소속 — setThemeKey로 정규 경로 갱신
  const curAlign = titleAlign || "left";
  const setAlign = (v) => setThemeKey("titleAlign", v);

  return (
    <>
      {/* ── 타이틀 정렬 (가장 위에 배치 — 자주 쓰는 옵션) ── */}
      <PanelSection label="// TITLE ALIGNMENT">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, padding:"8px 18px 12px" }}>
          {[
            { key:"left",   label:"LEFT",   desc:"▌  TEXT" },
            { key:"center", label:"CENTER", desc:"  TEXT  " },
          ].map(opt => {
            const active = curAlign === opt.key;
            return (
              <button key={opt.key} onClick={() => setAlign(opt.key)} style={{
                padding:"14px 8px",
                background: active ? `${UI.accent}1A` : UI.bgAlt,
                border:`2px solid ${active ? UI.accent : UI.line}`,
                cursor:"pointer", display:"flex", flexDirection:"column",
                alignItems:"center", gap:8, transition:"border-color 0.12s",
              }}>
                <div style={{ fontFamily:"monospace", fontSize:13, letterSpacing:"0.05em",
                              color: active ? UI.accent : UI.textMute, whiteSpace:"pre" }}>
                  {opt.desc}
                </div>
                <div style={{ fontFamily:UI_F.mono, fontSize:9, letterSpacing:"0.2em",
                              color: active ? UI.accent : UI.textMute }}>
                  {opt.label}
                </div>
              </button>
            );
          })}
        </div>
      </PanelSection>

      <PanelSection label="// CHROME VISIBILITY">
        <ToggleRow label="Show Header"     value={layout.showHeader ?? true}  onChange={v=>upL("showHeader",v)}  desc="리그 로고 · 우측 텍스트 정보"/>
        <ToggleRow label="Show Footer"     value={layout.showFooter ?? true}  onChange={v=>upL("showFooter",v)}  desc="하단 라인 · 해상도 텍스트"/>
        <ToggleRow label="Safe Area Guide" value={layout.showSafeArea} onChange={v=>upL("showSafeArea",v)} desc="Cyan dashed overlay (88%×80%)"/>
      </PanelSection>

      <PanelSection label="// MARGIN">
        <SliderRow label="Horizontal Margin" value={layout.marginH} onChange={v=>upL("marginH",v)} min={40}  max={240} step={8} unit="px"/>
        <SliderRow label="Vertical Margin"   value={layout.marginV} onChange={v=>upL("marginV",v)} min={16}  max={128} step={8} unit="px"/>
      </PanelSection>

      <PanelSection label="// GRID">
        <SliderRow label="Columns" value={layout.gridCols}    onChange={v=>upL("gridCols",v)}  min={2} max={24} step={1} unit=" col" color={UI.accent2}/>
        <SliderRow label="Rows"    value={layout.gridRows||6} onChange={v=>upL("gridRows",v)}  min={2} max={16} step={1} unit=" row" color={UI.accent2}/>
        <ToggleRow label="Show Grid" value={layout.showGrid}  onChange={v=>upL("showGrid",v)}  desc="컬럼 + 행 + 교차점 오버레이"/>
      </PanelSection>

      <PanelSection label="// LAYOUT OFFSETS">
        <SliderRow label="Title Top"   value={layout.titleTop}   onChange={v=>upL("titleTop",v)}   min={100} max={400} step={8} unit="px" color={UI.textDim}/>
        <SliderRow label="Content Top" value={layout.contentTop} onChange={v=>upL("contentTop",v)} min={300} max={700} step={8} unit="px" color={UI.textDim}/>
        <SliderRow label="Gap"         value={layout.gap}        onChange={v=>upL("gap",v)}        min={4}   max={64}  step={4} unit="px" color={UI.textDim}/>
        <SliderRow label="Accent Bar"  value={layout.accentBarW} onChange={v=>upL("accentBarW",v)} min={1}   max={12}  step={1} unit="px" color={UI.warn}/>
      </PanelSection>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// §12  DESIGN SYSTEM PANEL  (전문 디자인 가이드 컨트롤)
// ════════════════════════════════════════════════════════════════
// 각 프리셋: { family: CSS font-family 문자열, weights?: ":wght@..." 뒤에 붙을 값 }
// weights가 없으면 로더가 weight 지정 없이 기본 weight만 불러옴 (단일 weight 폰트용)
const FONT_PRESETS = {
  display:{
    // ── 기본 ────────────────────────────────────────────────
    "Bebas Neue":         { family:"'Bebas Neue','Archivo Narrow',sans-serif" },       // single-weight
    "Barlow Condensed":   { family:"'Barlow Condensed','Arial Narrow',sans-serif", weights:"400;700" },
    "Oswald":             { family:"'Oswald',sans-serif",                         weights:"400;700" },
    "Anton":              { family:"'Anton',sans-serif" },                         // single-weight
    // ── 추가 ────────────────────────────────────────────────
    "Teko":               { family:"'Teko',sans-serif",                           weights:"400;700" },
    "Big Shoulders Display": { family:"'Big Shoulders Display',sans-serif",       weights:"400;700" },
    "Staatliches":        { family:"'Staatliches',sans-serif" },                   // single-weight (stencil)
    "Archivo Black":      { family:"'Archivo Black',sans-serif" },                 // single-weight (blocky)
    "Fjalla One":         { family:"'Fjalla One',sans-serif" },                    // single-weight
    "Russo One":          { family:"'Russo One',sans-serif" },                     // single-weight
  },
  narrow:{
    // ── 기본 ────────────────────────────────────────────────
    "Archivo Narrow":     { family:"'Archivo Narrow',sans-serif",                 weights:"400;700" },
    "Barlow":             { family:"'Barlow','Arial',sans-serif",                 weights:"400;700" },
    "Roboto Condensed":   { family:"'Roboto Condensed',sans-serif",               weights:"400;700" },
    "DM Sans":            { family:"'DM Sans',sans-serif",                        weights:"400;700" },
    // ── 추가 ────────────────────────────────────────────────
    "Rajdhani":           { family:"'Rajdhani',sans-serif",                       weights:"400;700" },    // 에스포츠 감성
    "Chakra Petch":       { family:"'Chakra Petch',sans-serif",                   weights:"400;700" },    // 사이버펑크
    "Saira Condensed":    { family:"'Saira Condensed',sans-serif",                weights:"400;700" },
    "Inter":              { family:"'Inter',sans-serif",                          weights:"400;700" },    // 표준 산세리프
    "Exo 2":              { family:"'Exo 2',sans-serif",                          weights:"400;700" },    // 스포티
    "Titillium Web":      { family:"'Titillium Web',sans-serif",                  weights:"400;700" },
  },
  mono:{
    // ── 기본 ────────────────────────────────────────────────
    "JetBrains Mono":     { family:"'JetBrains Mono',monospace",                  weights:"400;700" },
    "IBM Plex Mono":      { family:"'IBM Plex Mono',monospace",                   weights:"400;700" },
    "Fira Mono":          { family:"'Fira Mono',monospace",                       weights:"400;700" },
    "Source Code Pro":    { family:"'Source Code Pro',monospace",                 weights:"400;700" },
    // ── 추가 ────────────────────────────────────────────────
    "Space Mono":         { family:"'Space Mono',monospace",                      weights:"400;700" },
    "Roboto Mono":        { family:"'Roboto Mono',monospace",                     weights:"400;700" },
    "Fira Code":          { family:"'Fira Code',monospace",                       weights:"400;700" },
    "Ubuntu Mono":        { family:"'Ubuntu Mono',monospace",                     weights:"400;700" },
  },
};

// ── Primary color 프리셋 ──────────────────────────────────────
const ACCENT_PRESETS = [
  { name:"Lime",    val:"#D4FF00" },
  { name:"Cyan",    val:"#00E5FF" },
  { name:"Orange",  val:"#FF6B00" },
  { name:"Red",     val:"#FF3355" },
  { name:"Purple",  val:"#9333EA" },
  { name:"Blue",    val:"#3B82F6" },
  { name:"Green",   val:"#22C55E" },
  { name:"Pink",    val:"#EC4899" },
  { name:"Yellow",  val:"#FBBF24" },
  { name:"White",   val:"#E8EAF0" },
];

// ── 모듈 스코프 서브 컴포넌트 ─────────────────────────────────
// (패널 안에 선언하면 리렌더 시 언마운트 → 피커 닫힘 버그 발생)

function DSColorRow({ label, tokenKey, theme, setThemeKey }) {
  const val = theme[tokenKey] || "#000000";
  return (
    <div style={{ display:"grid", gridTemplateColumns:"110px 40px 1fr 76px",
                  gap:8, alignItems:"center", padding:"5px 18px" }}>
      <div style={{ fontFamily:UI_F.mono, fontSize:11, color:UI.textMute,
                    letterSpacing:"0.12em", textTransform:"uppercase" }}>{label}</div>
      <label style={{ position:"relative", width:40, height:30, cursor:"pointer" }}>
        <div style={{ width:40, height:30, background:val,
                      border:"1px solid rgba(255,255,255,0.12)" }}/>
        <input type="color" value={val}
          onChange={e => setThemeKey(tokenKey, e.target.value)}
          style={{ position:"absolute", inset:0, opacity:0, cursor:"pointer",
                   width:"100%", height:"100%" }}/>
      </label>
      <div style={{ height:30, background:`linear-gradient(90deg,${val},${darken(val)})`,
                    border:"1px solid rgba(255,255,255,0.05)" }}/>
      <input type="text" value={val.toUpperCase()} maxLength={7}
        onChange={e => { if(HEX_RE.test(e.target.value)) setThemeKey(tokenKey, e.target.value); }}
        style={{ background:UI.surface, border:`1px solid ${UI.line}`, color:UI.text,
                 fontFamily:UI_F.mono, fontSize:11, padding:"6px 8px", outline:"none",
                 textAlign:"center", letterSpacing:"0.06em", width:"100%" }}/>
    </div>
  );
}

function DSFontSelect({ label, group, fonts, setFontKey, customFonts=[] }) {
  // 현재 선택된 폰트 이름 결정 (프리셋 or 커스텀)
  const presetEntry = Object.entries(FONT_PRESETS[group]).find(([,v]) => v.family===fonts[group]);
  const customEntry = customFonts.find(f => f.family===fonts[group]);
  const cur = presetEntry?.[0] || customEntry?.name || Object.keys(FONT_PRESETS[group])[0];

  return (
    <div style={{ display:"grid", gridTemplateColumns:"90px 1fr", gap:10,
                  alignItems:"center", padding:"5px 18px" }}>
      <div style={{ fontFamily:UI_F.mono, fontSize:11, color:UI.textMute,
                    letterSpacing:"0.12em", textTransform:"uppercase" }}>{label}</div>
      <select value={cur} onChange={e => setFontKey(group, e.target.value)} style={{
        background:UI.surface, border:`1px solid ${UI.line}`, color:UI.text,
        fontFamily:UI_F.narrow, fontSize:12, fontWeight:700,
        padding:"7px 10px", outline:"none", cursor:"pointer",
      }}>
        {/* 빌트인 프리셋 */}
        <optgroup label="── BUILT-IN ──" style={{ color:UI.textMute }}>
          {Object.keys(FONT_PRESETS[group]).map(k => (
            <option key={k} value={k}>{k}</option>
          ))}
        </optgroup>
        {/* 커스텀 업로드 폰트 */}
        {customFonts.length > 0 && (
          <optgroup label="── UPLOADED ──" style={{ color:UI.accent }}>
            {customFonts.map(f => (
              <option key={f.name} value={f.name}>↑ {f.name}</option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}

// ── COLORS TAB ───────────────────────────────────────────────
function DSColorsTab({ theme, setThemeKey }) {
  // Primary 컬러 프리셋 버튼
  const Presets = ({ tokenKey, presets }) => (
    <div style={{ display:"flex", flexWrap:"wrap", gap:6, padding:"4px 18px 10px" }}>
      {presets.map(p => (
        <button key={p.val} title={p.name}
          onClick={() => setThemeKey(tokenKey, p.val)}
          style={{
            width:28, height:28, background:p.val, border:"none", cursor:"pointer",
            outline: theme[tokenKey]===p.val ? `2px solid ${UI.text}` : "none",
            outlineOffset: 2,
            position:"relative",
          }}>
          {theme[tokenKey]===p.val && (
            <div style={{ position:"absolute", inset:0, display:"flex",
                          alignItems:"center", justifyContent:"center",
                          fontFamily:UI_F.mono, fontSize:10,
                          color: p.val === "#FBBF24" || p.val === "#D4FF00" || p.val === "#E8EAF0" ? "#000" : "#fff" }}>✓</div>
          )}
        </button>
      ))}
    </div>
  );

  // 전체 팔레트 오버뷰 그리드
  const PaletteOverview = () => {
    const slots = [
      {k:"accent",   lbl:"ACCENT"},
      {k:"accent2",  lbl:"LIVE"},
      {k:"accent3",  lbl:"LOSS"},
      {k:"ok",       lbl:"WIN"},
      {k:"warn",     lbl:"WARN"},
      {k:"text",     lbl:"TEXT"},
      {k:"textDim",  lbl:"DIM"},
      {k:"textMute", lbl:"MUTE"},
      {k:"surface",  lbl:"SURF"},
      {k:"bg",       lbl:"BG"},
    ];
    return (
      <div style={{ padding:"12px 18px", borderBottom:`1px solid ${UI.line}` }}>
        <div style={{ fontFamily:UI_F.mono, fontSize:11, color:UI.accent,
                      letterSpacing:"0.25em", marginBottom:10 }}>// PALETTE OVERVIEW</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(10,1fr)", gap:4 }}>
          {slots.map(s => (
            <div key={s.k}>
              <div style={{ height:32, background:theme[s.k],
                            border:`1px solid ${UI.line}` }}/>
              <div style={{ fontFamily:UI_F.mono, fontSize:9, color:UI.textMute,
                            textAlign:"center", marginTop:3,
                            letterSpacing:"0.05em", overflow:"hidden",
                            textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {s.lbl}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <PaletteOverview/>

      <PanelSection label="// PRIMARY ACCENT">
        {/* 빠른 프리셋 */}
        <div style={{ padding:"6px 18px 0", fontFamily:UI_F.mono, fontSize:11,
                      color:UI.textMute, letterSpacing:"0.12em" }}>QUICK PRESETS</div>
        <Presets tokenKey="accent" presets={ACCENT_PRESETS}/>
        <DSColorRow label="Accent" tokenKey="accent" theme={theme} setThemeKey={setThemeKey}/>
        <DSColorRow label="Accent 2" tokenKey="accent2" theme={theme} setThemeKey={setThemeKey}/>
        <DSColorRow label="Accent 3" tokenKey="accent3" theme={theme} setThemeKey={setThemeKey}/>
      </PanelSection>

      <PanelSection label="// BACKGROUND & SURFACE">
        <DSColorRow label="Background"     tokenKey="bg"       theme={theme} setThemeKey={setThemeKey}/>
        <DSColorRow label="Background Alt" tokenKey="bgAlt"    theme={theme} setThemeKey={setThemeKey}/>
        <DSColorRow label="Surface"        tokenKey="surface"  theme={theme} setThemeKey={setThemeKey}/>
        <DSColorRow label="Line / Border"  tokenKey="line"     theme={theme} setThemeKey={setThemeKey}/>
        <DSColorRow label="Line Soft"      tokenKey="lineSoft" theme={theme} setThemeKey={setThemeKey}/>
      </PanelSection>

      <PanelSection label="// TEXT HIERARCHY">
        <DSColorRow label="Text Primary" tokenKey="text"     theme={theme} setThemeKey={setThemeKey}/>
        <DSColorRow label="Text Mid"     tokenKey="textDim"  theme={theme} setThemeKey={setThemeKey}/>
        <DSColorRow label="Text Muted"   tokenKey="textMute" theme={theme} setThemeKey={setThemeKey}/>
      </PanelSection>

      <PanelSection label="// SIGNAL COLORS">
        <DSColorRow label="Win / OK" tokenKey="ok"   theme={theme} setThemeKey={setThemeKey}/>
        <DSColorRow label="Warning"  tokenKey="warn" theme={theme} setThemeKey={setThemeKey}/>
        <DSColorRow label="Loss"     tokenKey="accent3" theme={theme} setThemeKey={setThemeKey}/>
      </PanelSection>
    </div>
  );
}

// ── TYPE TAB ─────────────────────────────────────────────────
function DSTypeTab({ theme, setThemeKey, fonts, setFontKey, customFonts, addCustomFont, removeCustomFont }) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // 포맷 감지
  const getFormat = ext => ({ ttf:"truetype", otf:"opentype", woff:"woff", woff2:"woff2" }[ext] || "truetype");

  // 파일 → @font-face 등록
  const loadFontFile = (file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["ttf","otf","woff","woff2"].includes(ext)) return;

    // 파일명에서 폰트 이름 추출 (확장자 제거, 특수문자 처리)
    const rawName = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
    // 중복 방지: 같은 이름이면 덮어쓰기
    const name = rawName;

    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target.result;
      const family  = `'${name}', sans-serif`;
      const format  = getFormat(ext);

      // @font-face 동적 주입
      const styleId = `oap-custom-font-${name.replace(/\s+/g,"-")}`;
      document.getElementById(styleId)?.remove();
      const style = document.createElement("style");
      style.id = styleId;
      // wght 400 / 700 모두 같은 파일로 등록 (없으면 브라우저가 합성)
      style.textContent = [400,700].map(w =>
        `@font-face{font-family:'${name}';src:url('${dataUrl}')format('${format}');font-weight:${w};font-style:normal;}`
      ).join("");
      document.head.appendChild(style);

      addCustomFont({ name, family, ext: ext.toUpperCase(), dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const handleFiles = files => {
    Array.from(files).forEach(loadFontFile);
  };

  const handleDrop = e => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  // 라이브 타입 스케일 스페시멘
  const TypeSpecimen = () => (
    <div style={{ margin:"0 18px 12px", padding:"16px 20px",
                  background:theme.bg, border:`1px solid ${UI.line}` }}>
      {/* Display — H1 */}
      <div style={{ borderBottom:`1px solid ${UI.lineSoft}`, paddingBottom:12, marginBottom:12 }}>
        <div style={{ fontFamily:UI_F.mono, fontSize:11, color:UI.textMute,
                      letterSpacing:"0.2em", marginBottom:6 }}>DISPLAY · H1</div>
        <div style={{ fontFamily:fonts.display,
                      fontSize: Math.round(48 * (theme.displayScale ?? 1)),
                      color:theme.text, lineHeight:0.9,
                      letterSpacing:theme.displayTracking }}>
          CHAMPIONSHIP 2026
        </div>
      </div>
      {/* Eyebrow 레이블 */}
      <div style={{ borderBottom:`1px solid ${UI.lineSoft}`, paddingBottom:12, marginBottom:12 }}>
        <div style={{ fontFamily:UI_F.mono, fontSize:11, color:UI.textMute,
                      letterSpacing:"0.2em", marginBottom:6 }}>LABEL · EYEBROW</div>
        <div style={{ fontFamily:fonts.mono,
                      fontSize: theme.eyebrowSize || 14,
                      color:theme.accent,
                      letterSpacing:theme.eyebrowTracking || "0.3em" }}>
          // NEXT MATCH UP · DAY 03
        </div>
      </div>
      {/* Title / Narrow */}
      <div style={{ borderBottom:`1px solid ${UI.lineSoft}`, paddingBottom:12, marginBottom:12 }}>
        <div style={{ fontFamily:UI_F.mono, fontSize:11, color:UI.textMute,
                      letterSpacing:"0.2em", marginBottom:6 }}>TITLE · SECTION</div>
        <div style={{ fontFamily:fonts.narrow, fontSize:18, fontWeight:700,
                      color:theme.text, textTransform:"uppercase",
                      letterSpacing:"0.04em" }}>
          GROUP STAGE — ROUND 03
        </div>
      </div>
      {/* Mono / Caption */}
      <div>
        <div style={{ fontFamily:UI_F.mono, fontSize:11, color:UI.textMute,
                      letterSpacing:"0.2em", marginBottom:6 }}>MONO · CAPTION</div>
        <div style={{ fontFamily:fonts.mono, fontSize:11, color:theme.textDim,
                      letterSpacing:"0.12em" }}>
          TIMECODE 00:29:30 · MATCH 05 · BO5 · FINAL
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* ── 커스텀 폰트 업로드 ────────────────────────────────── */}
      <PanelSection label="// CUSTOM FONT UPLOAD">
        {/* 숨겨진 파일 input */}
        <input ref={fileInputRef} type="file" multiple
          accept=".ttf,.otf,.woff,.woff2"
          style={{ display:"none" }}
          onChange={e => handleFiles(e.target.files)}/>

        {/* 드래그앤드롭 존 */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          style={{
            margin:"6px 18px 10px",
            padding:"20px 16px",
            border:`2px dashed ${dragOver ? UI.accent : UI.line}`,
            background: dragOver ? `${UI.accent}0D` : UI.bgAlt,
            cursor:"pointer", textAlign:"center",
            transition:"border-color 0.15s, background 0.15s",
          }}>
          <div style={{ fontFamily:UI_F.mono, fontSize:22, color: dragOver ? UI.accent : UI.textMute,
                        lineHeight:1, marginBottom:8 }}>⊕</div>
          <div style={{ fontFamily:UI_F.mono, fontSize:11, color: dragOver ? UI.accent : UI.textDim,
                        letterSpacing:"0.15em" }}>
            {dragOver ? "드롭하여 업로드" : "클릭 또는 드래그 & 드롭"}
          </div>
          <div style={{ fontFamily:UI_F.mono, fontSize:11, color:UI.textMute,
                        letterSpacing:"0.12em", marginTop:6 }}>
            .TTF · .OTF · .WOFF · .WOFF2
          </div>
        </div>

        {/* 업로드된 폰트 목록 */}
        {customFonts.length === 0 ? (
          <div style={{ padding:"4px 18px 10px", fontFamily:UI_F.mono, fontSize:11,
                        color:UI.textMute, letterSpacing:"0.1em" }}>
            업로드된 폰트 없음
          </div>
        ) : (
          <div style={{ paddingBottom:4 }}>
            {customFonts.map(f => (
              <div key={f.name} style={{
                display:"flex", alignItems:"center", gap:10,
                margin:"4px 18px",
                padding:"9px 12px",
                background:UI.surface, border:`1px solid ${UI.line}`,
                borderLeft:`3px solid ${UI.accent}`,
              }}>
                {/* 실제 폰트로 이름 렌더 */}
                <div style={{ flex:1, fontFamily:f.family, fontSize:17,
                              color:UI.text, lineHeight:1,
                              overflow:"hidden", textOverflow:"ellipsis",
                              whiteSpace:"nowrap" }}>
                  {f.name}
                </div>
                {/* 포맷 뱃지 */}
                <div style={{ fontFamily:UI_F.mono, fontSize:11, color:UI.accent,
                              letterSpacing:"0.15em", border:`1px solid ${UI.accent}`,
                              padding:"2px 6px", flexShrink:0 }}>
                  {f.ext}
                </div>
                {/* 삭제 버튼 */}
                <button onClick={() => removeCustomFont(f.name)} style={{
                  width:22, height:22, background:"transparent",
                  border:`1px solid ${UI.line}`, color:UI.textMute,
                  fontFamily:UI_F.mono, fontSize:11, cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  flexShrink:0,
                }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {customFonts.length > 0 && (
          <div style={{ padding:"0 18px 10px", fontFamily:UI_F.mono, fontSize:10,
                        color:UI.textMute, letterSpacing:"0.1em" }}>
            ↓ 아래 드롭다운에서 각 역할에 적용하세요
          </div>
        )}
      </PanelSection>

      {/* ── 빌트인 + 커스텀 폰트 선택 ───────────────────────── */}
      <PanelSection label="// DISPLAY FONT">
        <DSFontSelect label="Family" group="display" fonts={fonts} setFontKey={setFontKey}
          customFonts={customFonts}/>
        <SliderRow label="Size Scale"  value={Math.round((theme.displayScale??1)*100)}
          onChange={v => setThemeKey("displayScale", v/100)}
          min={50} max={150} step={5} unit="%" color={UI.accent}/>
        <SliderRow label="Tracking"
          value={Math.round(parseFloat(theme.displayTracking??"-0.005")*1000)}
          onChange={v => setThemeKey("displayTracking", `${(v/1000).toFixed(3)}em`)}
          min={-20} max={60} step={1} unit="" color={UI.accent}/>
        <div style={{ padding:"2px 18px 8px", fontFamily:UI_F.mono, fontSize:10,
                      color:UI.textMute, letterSpacing:"0.1em" }}>
          Tracking: {theme.displayTracking}
        </div>
      </PanelSection>

      <PanelSection label="// LABEL (EYEBROW)">
        <DSFontSelect label="Family" group="mono" fonts={fonts} setFontKey={setFontKey}
          customFonts={customFonts}/>
        <SliderRow label="Size"
          value={theme.eyebrowSize ?? 14}
          onChange={v => setThemeKey("eyebrowSize", v)}
          min={10} max={22} step={1} unit="px" color={UI.accent2}/>
        <SliderRow label="Tracking"
          value={Math.round(parseFloat(theme.eyebrowTracking??"0.3")*100)}
          onChange={v => setThemeKey("eyebrowTracking", `${(v/100).toFixed(2)}em`)}
          min={5} max={50} step={1} unit="" color={UI.accent2}/>
        <div style={{ padding:"2px 18px 8px", fontFamily:UI_F.mono, fontSize:10,
                      color:UI.textMute, letterSpacing:"0.1em" }}>
          Tracking: {theme.eyebrowTracking}
        </div>
      </PanelSection>

      <PanelSection label="// BODY / TITLE FONT">
        <DSFontSelect label="Family" group="narrow" fonts={fonts} setFontKey={setFontKey}
          customFonts={customFonts}/>
      </PanelSection>

      {/* 타입 스케일 스페시멘 */}
      <div style={{ padding:"8px 0 0", fontFamily:UI_F.mono, fontSize:11,
                    color:UI.accent, letterSpacing:"0.25em", paddingLeft:18 }}>
        // TYPE SCALE SPECIMEN
      </div>
      <TypeSpecimen/>
    </div>
  );
}

// ── COMPONENTS TAB ───────────────────────────────────────────
const SHAPE_DEFS = [
  { key:"pentagon", label:"PENTA",  preview:"M 4 0 L 28 0 L 28 22 L 22 28 L 4 28 Z" },
  { key:"square",   label:"SQUARE", preview:null },
  { key:"diamond",  label:"DIAMOND",preview:"M 16 2 L 30 16 L 16 30 L 2 16 Z" },
  { key:"hexagon",  label:"HEXAGON",preview:"M 9 2 L 23 2 L 30 16 L 23 30 L 9 30 L 2 16 Z" },
  { key:"circle",   label:"CIRCLE", preview:"circle" },
];

function DSComponentsTab({ theme, setThemeKey }) {
  return (
    <div>
      {/* ── 타이틀 정렬 ──────────────────────────────────────── */}
      <PanelSection label="// TITLE ALIGNMENT">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, padding:"8px 18px 12px" }}>
          {[
            { key:"left",   label:"LEFT",   icon:"▐  TEXT" },
            { key:"center", label:"CENTER", icon:"  TEXT  " },
          ].map(opt => {
            const active = (theme.titleAlign || "left") === opt.key;
            return (
              <button key={opt.key} onClick={() => setThemeKey("titleAlign", opt.key)} style={{
                padding:"14px 8px",
                background: active ? `${theme.accent}18` : UI.bgAlt,
                border:`1px solid ${active ? theme.accent : UI.line}`,
                cursor:"pointer", display:"flex", flexDirection:"column",
                alignItems:"center", gap:8,
              }}>
                <div style={{ fontFamily:"monospace", fontSize:11,
                              color: active ? theme.accent : UI.textMute,
                              letterSpacing:"0.05em", whiteSpace:"pre" }}>
                  {opt.icon}
                </div>
                <div style={{ fontFamily:UI_F.mono, fontSize:11,
                              color: active ? theme.accent : UI.textMute,
                              letterSpacing:"0.15em" }}>{opt.label}</div>
              </button>
            );
          })}
        </div>
        <div style={{ padding:"0 18px 10px", fontFamily:UI_F.mono, fontSize:10,
                      color:UI.textMute, letterSpacing:"0.1em" }}>
          모든 장표의 타이틀 · 레이블 텍스트에 적용됩니다
        </div>
      </PanelSection>

      {/* ── // 접두사 표시 여부 ───────────────────────────────── */}
      <PanelSection label="// EYEBROW PREFIX">
        <ToggleRow
          label='"//" 표시'
          value={theme.eyebrowSlash !== false}
          onChange={v => setThemeKey("eyebrowSlash", v)}
          desc='레이블 앞 장식 슬래시 (// SCOREBOARD)'
        />
        {/* 미리보기 */}
        <div style={{ margin:"4px 18px 10px", padding:"12px 16px",
                      background:UI.bgAlt, border:`1px solid ${UI.line}` }}>
          <div style={{ fontFamily:UI_F.mono,
                        fontSize:_T.eyebrowSize||14,
                        color:theme.accent,
                        letterSpacing:_T.eyebrowTracking||"0.3em" }}>
            {theme.eyebrowSlash !== false ? "// " : ""}NEXT MATCH UP
          </div>
          <div style={{ fontFamily:UI_F.display, fontSize:28,
                        color:UI.text, lineHeight:1, marginTop:6 }}>
            UPCOMING.
          </div>
        </div>
      </PanelSection>

      {/* 팀 마크 셰이프 */}
      <PanelSection label="// TEAM MARK SHAPE">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8,
                      padding:"8px 18px 12px" }}>
          {SHAPE_DEFS.map(s => {
            const active = (theme.markShape || "pentagon") === s.key;
            return (
              <button key={s.key} onClick={() => setThemeKey("markShape", s.key)} style={{
                display:"flex", flexDirection:"column", alignItems:"center", gap:8,
                padding:"10px 6px",
                background: active ? `${theme.accent}18` : UI.bgAlt,
                border:`1px solid ${active ? theme.accent : UI.line}`,
                cursor:"pointer",
              }}>
                {/* 셰이프 SVG 미리보기 */}
                <svg width="32" height="32" viewBox="0 0 32 32">
                  <defs>
                    <linearGradient id={`g-${s.key}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={theme.accent}/>
                      <stop offset="100%" stopColor={darken(theme.accent, 50)}/>
                    </linearGradient>
                  </defs>
                  {s.preview === null && (
                    <rect x="2" y="2" width="28" height="28" fill={`url(#g-${s.key})`}/>
                  )}
                  {s.preview === "circle" && (
                    <circle cx="16" cy="16" r="14" fill={`url(#g-${s.key})`}/>
                  )}
                  {s.preview && s.preview !== "circle" && (
                    <path d={s.preview} fill={`url(#g-${s.key})`}/>
                  )}
                </svg>
                <div style={{ fontFamily:UI_F.mono, fontSize:10,
                              color: active ? theme.accent : UI.textMute,
                              letterSpacing:"0.1em" }}>{s.label}</div>
              </button>
            );
          })}
        </div>
      </PanelSection>

      {/* 배경 그라디언트 */}
      <PanelSection label="// CANVAS BACKGROUND">
        <ToggleRow label="Ambient Gradient"
          value={theme.bgGradient !== false}
          onChange={v => setThemeKey("bgGradient", v)}
          desc="Accent 컬러 기반 배경 빛 번짐"/>
        {/* 배경색 미리보기 */}
        <div style={{ margin:"4px 18px 8px", height:48, position:"relative",
                      border:`1px solid ${UI.line}`, overflow:"hidden" }}>
          <div style={{ position:"absolute", inset:0, background:theme.bg }}/>
          {theme.bgGradient !== false && (
            <div style={{ position:"absolute", inset:0,
                          background:`radial-gradient(ellipse at 15% 110%,${theme.accent}18,transparent 60%)` }}/>
          )}
          <div style={{ position:"absolute", bottom:8, left:12,
                        fontFamily:UI_F.mono, fontSize:11, color:theme.textMute,
                        letterSpacing:"0.15em" }}>
            BACKGROUND PREVIEW
          </div>
        </div>
      </PanelSection>

      {/* 팀 마크 컬러 미리보기 */}
      <PanelSection label="// MARK PREVIEW">
        <div style={{ display:"flex", gap:10, padding:"8px 18px 12px",
                      flexWrap:"wrap" }}>
          {[theme.accent, theme.accent2, "#E53935","#1E40AF","#7C3AED","#059669"].map((c,i) => (
            <div key={i}>
              <TeamMark color={c} initial={["A","B","K","S","P","G"][i]} size={52} fs={26}/>
            </div>
          ))}
        </div>
        <div style={{ padding:"0 18px 8px", fontFamily:UI_F.mono, fontSize:10,
                      color:UI.textMute, letterSpacing:"0.1em" }}>
          ↑ 현재 셰이프: {(theme.markShape||"pentagon").toUpperCase()}
        </div>
      </PanelSection>
    </div>
  );
}

// ── DESIGN SYSTEM PANEL  (탭 기반) ────────────────────────────
// 4개 장표 동시 미리보기 (Design System 모드 우측 패널)
const DS_PREVIEW_KEYS = ["scoreboard","brLeaderboard","lowerThird","roster"];

function DesignSystemPreview({ dataMap, layout }) {
  return (
    <div style={{ flex:1, display:"grid", gridTemplateColumns:"1fr 1fr",
                  gridTemplateRows:"1fr 1fr", gap:8, padding:12, minHeight:0 }}>
      {DS_PREVIEW_KEYS.map(key => {
        const tpl = TEMPLATES[key];
        if (!tpl) return null;
        const { Comp } = tpl;
        const data = dataMap[key] || tpl.data;
        return (
          <div key={key} style={{ display:"flex", flexDirection:"column",
                                  background:"#090A0D", minHeight:0, overflow:"hidden" }}>
            <div style={{ padding:"4px 10px", background:UI.bgAlt,
                          borderBottom:`1px solid ${UI.line}`, flexShrink:0,
                          fontFamily:UI_F.mono, fontSize:11, color:UI.accent,
                          letterSpacing:"0.2em" }}>
              {tpl.name.toUpperCase()}
            </div>
            <AutoScaleCanvas Comp={Comp} data={data} layout={layout} padX={6} padY={6}/>
          </div>
        );
      })}
    </div>
  );
}

function DesignSystemPanel({ theme, setThemeKey, fonts, setFontKey, onReset, customFonts, addCustomFont, removeCustomFont }) {
  const [tab, setTab] = useState("colors");

  const tabs = [
    { key:"colors",     label:"COLORS"     },
    { key:"type",       label:"TYPOGRAPHY" },
    { key:"components", label:"COMPONENTS" },
  ];

  const tabBtn = (k) => ({
    flex:1, padding:"9px 0",
    background: tab===k ? `${theme.accent}14` : "transparent",
    border:"none", borderBottom:"none",
    color: tab===k ? theme.accent : UI.textMute,
    fontFamily:UI_F.mono, fontSize:11, letterSpacing:"0.15em",
    textTransform:"uppercase", cursor:"pointer", whiteSpace:"nowrap",
    transition:"color 0.12s, background 0.12s",
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0 }}>
      {/* 내부 탭 */}
      <div style={{ display:"flex", borderBottom:`1px solid ${UI.line}22`, flexShrink:0,
                    background:UI.bgAlt }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={tabBtn(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div style={{ flex:1, overflowY:"auto", minHeight:0 }}>
        {tab==="colors"     && <DSColorsTab     theme={theme} setThemeKey={setThemeKey}/>}
        {tab==="type"       && <DSTypeTab        theme={theme} setThemeKey={setThemeKey} fonts={fonts} setFontKey={setFontKey} customFonts={customFonts} addCustomFont={addCustomFont} removeCustomFont={removeCustomFont}/>}
        {tab==="components" && <DSComponentsTab  theme={theme} setThemeKey={setThemeKey}/>}
      </div>

      {/* 하단 리셋 버튼 */}
      <div style={{ padding:"12px 18px", borderTop:`1px solid ${UI.line}`,
                    flexShrink:0, background:UI.bgAlt }}>
        <button onClick={onReset} style={{
          width:"100%", padding:"9px", background:"transparent",
          border:`1px solid ${UI.accent3}`, color:UI.accent3,
          fontFamily:UI_F.mono, fontSize:10, letterSpacing:"0.25em",
          textTransform:"uppercase", cursor:"pointer",
        }}>↺ RESET TO DEFAULT</button>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════
// §13  APP
// ════════════════════════════════════════════════════════════════
const DEFAULT_THEME = {
  bg:"#0A0B0F", bgAlt:"#12141A", surface:"#1A1D26",
  line:"#2A2E3B", lineSoft:"#1F222C",
  text:"#E8EAF0", textDim:"#8A8F9E", textMute:"#545A6B",
  accent:"#D4FF00", accent2:"#00E5FF", accent3:"#FF3366",
  ok:"#34D399", warn:"#FFB020",
  displayScale:1.0, displayTracking:"-0.005em",
  eyebrowSize:14, eyebrowTracking:"0.3em",
  markShape:"pentagon", bgGradient:true,
  titleAlign:"left",
  eyebrowSlash:true,
};
const DEFAULT_FONTS_INIT = {
  display: FONT_PRESETS.display["Bebas Neue"].family,
  narrow:  FONT_PRESETS.narrow["Archivo Narrow"].family,
  mono:    FONT_PRESETS.mono["JetBrains Mono"].family,
};

export default function App() {
  const [activeKey,   setActiveKey]   = useState("scoreboard");
  const [pageMode,    setPageMode]    = useState("template"); // "template"|"designSystem"
  const [leftTab,     setLeftTab]     = useState("data");     // "data"|"layout"
  const [manualScale, setManualScale] = useState(null);       // null = auto-fit
  const [autoScale,   setAutoScale]   = useState(0.5);

  // ── Callback Ref + ResizeObserver ──────────────────────────
  // useRef + useEffect 조합은 조건부 렌더로 div가 언마운트될 때
  // 이전 DOM 엘리먼트를 계속 감시하다가 size(0,0) 리포트 → scale 최솟값 고착
  // Callback Ref 패턴: 엘리먼트가 새로 마운트될 때마다 자동으로 재연결
  const roRef = useRef(null);
  const previewRef = useCallback(node => {
    // 이전 observer 해제
    if (roRef.current) { roRef.current.disconnect(); roRef.current = null; }
    if (!node) return;
    const PAD = 16; // previewRef div의 padding과 동일
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width === 0 || height === 0) return; // 0,0은 무시 (언마운트 직전)
      const s = Math.min((width - PAD*2) / 1920, (height - PAD*2) / 1080);
      setAutoScale(Math.max(0.1, parseFloat(s.toFixed(4))));
    });
    ro.observe(node);
    roRef.current = ro;
  }, []); // [] → 함수 레퍼런스 고정, 재생성 없음

  // ── 글로벌 테마 ─────────────────────────────────────────────
  const [themeState, setThemeState] = useState({...DEFAULT_THEME});
  const [fontState,  setFontState]  = useState({...DEFAULT_FONTS_INIT});

  // 커스텀 업로드 폰트 목록
  const [customFonts, setCustomFonts] = useState([]);
  // setFontKey에서 customFonts를 참조하기 위한 ref (useCallback [] 의존성 불변 유지)
  const customFontsRef = useRef([]);
  customFontsRef.current = customFonts;

  const addCustomFont = useCallback((font) => {
    setCustomFonts(prev => {
      // 같은 이름이면 교체
      const filtered = prev.filter(f => f.name !== font.name);
      return [...filtered, font];
    });
  }, []);

  const removeCustomFont = useCallback((name) => {
    // @font-face 스타일 태그도 제거
    document.getElementById(`oap-custom-font-${name.replace(/\s+/g,"-")}`)?.remove();
    setCustomFonts(prev => prev.filter(f => f.name !== name));
  }, []);

  // _T/_F 를 setter 안에서 동기 업데이트
  const setThemeKey = useCallback((k, v) => {
    _T = { ..._T, [k]: v };
    setThemeState(s => ({ ...s, [k]: v }));
  }, []);

  const setFontKey = useCallback((group, name) => {
    // 빌트인 프리셋 먼저 확인
    const preset = FONT_PRESETS[group]?.[name];
    let val = preset?.family;
    // 없으면 커스텀 폰트에서 찾기 (ref로 최신값 참조)
    if (!val) {
      const custom = customFontsRef.current.find(f => f.name === name);
      if (custom) val = custom.family;
    }
    if (!val) return;

    _F = { ..._F, [group]: val };
    setFontState(s => ({ ...s, [group]: val }));

    // 빌트인 Google Font만 동적 로드 (커스텀은 이미 @font-face 등록됨)
    if (preset) {
      const id = `oap-font-dyn-${group}`;
      let link = document.getElementById(id);
      if (!link) {
        link = document.createElement("link");
        link.id = id; link.rel = "stylesheet";
        document.head.appendChild(link);
      }
      // 단일-weight 폰트는 wght 지정 생략 (Google Fonts API가 거절하는 문제 회피)
      const wght = preset.weights ? `:wght@${preset.weights}` : "";
      link.href = `https://fonts.googleapis.com/css2?family=${name.replace(/ /g,"+")}${wght}&display=swap`;
    }
  }, []);

  const resetTheme = useCallback(() => {
    _T = { ...DEFAULT_THEME };
    _F = { ...DEFAULT_FONTS_INIT };
    setThemeState({ ...DEFAULT_THEME });
    setFontState({ ...DEFAULT_FONTS_INIT });
    // 커스텀 폰트는 유지 (리셋해도 업로드한 폰트는 남김)
  }, []);

  // ── 데이터 ─────────────────────────────────────────────────
  const [dataMap, setDataMap] = useState(() => {
    const m={};
    Object.keys(TEMPLATES).forEach(k=>{ m[k]={...TEMPLATES[k].data}; });
    return m;
  });
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);

  const scale = manualScale ?? autoScale;

  const data    = dataMap[activeKey];
  const setData = useCallback(fn => {
    setDataMap(prev => ({...prev, [activeKey]: typeof fn==="function"?fn(prev[activeKey]):fn}));
  }, [activeKey]);

  const reset = useCallback(
    () => setDataMap(prev => ({...prev,[activeKey]:{...TEMPLATES[activeKey].data}})),
    [activeKey]
  );

  const { Comp, Form } = TEMPLATES[activeKey] || TEMPLATES.scoreboard;
  const isDS     = pageMode === "designSystem";

  // 공통 탭 스타일
  const tabStyle = useCallback((active) => ({
    padding:"10px 16px", background:"transparent",
    border:"none", borderRight:"none",
    borderBottom:active?`2px solid ${themeState.accent}`:"2px solid transparent",
    color:active?UI.text:UI.textMute,
    fontFamily:fontState.narrow, fontWeight:active?700:400, fontSize:11,
    letterSpacing:"0.04em", textTransform:"uppercase", cursor:"pointer",
    whiteSpace:"nowrap", flexShrink:0,
    transition:"color 0.12s",
  }), [themeState.accent, fontState.narrow]);

  const subTabStyle = useCallback((active) => ({
    flex:1, padding:"9px 0",
    background:active?`${themeState.accent}12`:"transparent",
    border:"none", borderBottom:"none",
    borderRadius:0,
    color:active?themeState.accent:UI.textMute,
    fontFamily:UI_F.mono, fontSize:11,
    letterSpacing:"0.18em", textTransform:"uppercase", cursor:"pointer",
    transition:"color 0.12s, background 0.12s",
  }), [themeState.accent]);

  return (
    <div style={{ minHeight:"100vh", background:UI.bg, color:UI.text,
                  fontFamily:fontState.narrow, display:"flex", flexDirection:"column",
                  WebkitFontSmoothing:"antialiased" }}>

      {/* HEADER */}
      <header style={{ borderBottom:`1px solid ${UI.line}22`, padding:"11px 24px",
                       flexShrink:0, display:"flex", justifyContent:"space-between",
                       alignItems:"center", background:UI.bgAlt }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:20, height:20, background:themeState.accent,
                        clipPath:"polygon(0 0,100% 0,100% 70%,70% 100%,0 100%)", flexShrink:0 }}/>
          <div>
            <div style={{ fontFamily:fontState.display, fontSize:18,
                          lineHeight:1, letterSpacing:"0.04em" }}>
              OAP WIREFRAME GENERATOR
            </div>
            <div style={{ fontFamily:fontState.mono, fontSize:11, color:themeState.textMute,
                          letterSpacing:"0.25em", marginTop:3 }}>
              v3.0 · DESIGN SYSTEM + 7 TEMPLATES
            </div>
          </div>
        </div>
        {/* accent 팔레트 칩 */}
        <div style={{ display:"flex", gap:5, alignItems:"center" }}>
          {["accent","accent2","ok","warn","accent3"].map(k=>(
            <div key={k} style={{ width:14, height:14, background:themeState[k],
                                  border:"1px solid rgba(255,255,255,0.08)" }}/>
          ))}
          <span style={{ fontFamily:fontState.mono, fontSize:11,
                         color:themeState.textMute, letterSpacing:"0.2em", marginLeft:8 }}>
            OAP.DS v1.0
          </span>
        </div>
      </header>

      {/* NAV TABS */}
      <nav style={{ display:"flex", borderBottom:`1px solid ${UI.line}22`,
                    background:UI.bg, flexShrink:0, overflowX:"auto" }}>
        {/* Design System 탭 */}
        <button onClick={()=>setPageMode(isDS?"template":"designSystem")} style={{
          ...tabStyle(isDS),
          color:isDS?themeState.accent:UI.textMute,
          paddingRight:20,
        }}>
          DESIGN SYSTEM
        </button>
        <div style={{ width:1, height:16, background:UI.line, margin:"auto 4px", opacity:0.3 }}/>
        {/* 템플릿 탭들 */}
        {Object.entries(TEMPLATES).map(([key,tpl]) => (
          <button key={key} onClick={()=>{ setActiveKey(key); setPageMode("template"); }}
            style={tabStyle(!isDS && activeKey===key)}>
            {tpl.name}
          </button>
        ))}
      </nav>

      {/* BODY */}
      <div style={{ display:"grid", gridTemplateColumns:"360px 1fr", flex:1, minHeight:0 }}>

        {/* LEFT PANEL */}
        {isDS ? (
          // Design System 에디터
          <div style={{ borderRight:`1px solid ${UI.line}`, display:"flex",
                        flexDirection:"column", minHeight:0, overflow:"hidden" }}>
            <div style={{ padding:"11px 18px", borderBottom:`1px solid ${UI.line}`,
                          display:"flex", justifyContent:"space-between", alignItems:"center",
                          flexShrink:0, background:UI.bgAlt }}>
              <div style={{ fontFamily:UI_F.mono, fontSize:11, color:themeState.accent,
                            letterSpacing:"0.2em", opacity:0.9 }}>DESIGN SYSTEM</div>
              <button onClick={resetTheme} style={{
                background:"transparent", border:`1px solid ${UI.line}33`, color:UI.textMute,
                fontFamily:UI_F.mono, fontSize:10, letterSpacing:"0.1em",
                padding:"3px 10px", cursor:"pointer", borderRadius:3,
              }}>RESET</button>
            </div>
            <DesignSystemPanel
              theme={themeState} setThemeKey={setThemeKey}
              fonts={fontState}  setFontKey={setFontKey}
              onReset={resetTheme}
              customFonts={customFonts}
              addCustomFont={addCustomFont}
              removeCustomFont={removeCustomFont}/>
          </div>
        ) : (
          // 템플릿 데이터/레이아웃 에디터
          <div style={{ borderRight:`1px solid ${UI.line}`, display:"flex",
                        flexDirection:"column", minHeight:0, overflow:"hidden" }}>
            <div style={{ display:"flex", borderBottom:`1px solid ${UI.line}`,
                          flexShrink:0, background:UI.bgAlt }}>
              <button style={subTabStyle(leftTab==="data")}   onClick={()=>setLeftTab("data")}>DATA</button>
              <button style={subTabStyle(leftTab==="layout")} onClick={()=>setLeftTab("layout")}>LAYOUT</button>
              <div style={{ marginLeft:"auto", padding:"0 14px", display:"flex", alignItems:"center" }}>
                <button onClick={reset} style={{
                  background:"transparent", border:`1px solid ${UI.line}`,
                  color:UI.textMute, fontFamily:UI_F.mono, fontSize:11,
                  letterSpacing:"0.15em", padding:"4px 10px", cursor:"pointer",
                }}>RESET</button>
              </div>
            </div>
            <div style={{ flex:1, overflowY:"auto", minHeight:0 }}>
              {leftTab==="data"   && <Form data={data} setData={setData}/>}
              {leftTab==="layout" && <LayoutPanel layout={layout} setLayout={setLayout}
                                       setThemeKey={setThemeKey} titleAlign={themeState.titleAlign}/>}
            </div>
          </div>
        )}

        {/* RIGHT: PREVIEW */}
        <div style={{ display:"flex", flexDirection:"column", background:"#090A0D", minHeight:0 }}>

          {/* Toolbar */}
          <div style={{ padding:"10px 20px", borderBottom:`1px solid ${UI.line}`,
                        flexShrink:0, display:"flex", justifyContent:"space-between",
                        alignItems:"center", background:UI.bgAlt }}>
            <div style={{ fontFamily:fontState.mono, fontSize:11, color:themeState.accent,
                          letterSpacing:"0.2em", opacity:0.9 }}>
              {isDS ? "DESIGN SYSTEM · ALL TEMPLATES LIVE" : "PREVIEW · 1920×1080"}
            </div>
            {!isDS && (
              <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                <button onClick={()=>setManualScale(null)} style={{
                  background:manualScale===null?themeState.accent:"transparent",
                  color:manualScale===null?themeState.bg:themeState.textDim,
                  border:`1px solid ${manualScale===null?themeState.accent:themeState.line}`,
                  fontFamily:fontState.mono, fontSize:11, letterSpacing:"0.15em",
                  padding:"5px 12px", cursor:"pointer",
                }}>FIT ◈</button>
                <div style={{ width:1, height:16, background:themeState.line, margin:"0 4px" }}/>
                {[0.25,0.33,0.5,0.75].map(s => (
                  <button key={s} onClick={()=>setManualScale(s)} style={{
                    background:manualScale===s?themeState.accent:"transparent",
                    color:manualScale===s?themeState.bg:themeState.textDim,
                    border:`1px solid ${manualScale===s?themeState.accent:themeState.line}`,
                    fontFamily:fontState.mono, fontSize:11, letterSpacing:"0.15em",
                    padding:"5px 10px", cursor:"pointer",
                  }}>{Math.round(s*100)}%</button>
                ))}
              </div>
            )}
          </div>

          {/* Canvas / Preview ─────────────────────────────────
               previewRef div는 항상 DOM에 마운트 유지.
               DS 모드일 때 flex:0 + overflow:hidden으로 공간 제거.
               → 언마운트가 없으므로 Callback Ref가 항상 유효한 엘리먼트를 감시. */}

          {/* DS 모드 전용: 4개 템플릿 동시 미리보기 */}
          {isDS && <DesignSystemPreview dataMap={dataMap} layout={layout}/>}

          {/* 템플릿 프리뷰 (항상 마운트) */}
          <div ref={previewRef} style={{
            flex: isDS ? "0 0 0" : 1,
            minHeight:0, overflow: isDS ? "hidden" : (manualScale ? "auto" : "hidden"),
            display: isDS ? "block" : "flex",
            justifyContent:"center", alignItems:"center",
            padding: isDS ? 0 : 16,
          }}>
            {!isDS && (
              <ScaleWrapper scale={scale}>
                <Comp data={data} layout={layout}/>
              </ScaleWrapper>
            )}
          </div>

          {/* Status bar */}
          {!isDS && (
            <div style={{ padding:"7px 20px", borderTop:`1px solid ${themeState.line}`,
                          flexShrink:0, display:"flex", alignItems:"center", gap:20,
                          fontFamily:fontState.mono, fontSize:11, color:themeState.textMute,
                          letterSpacing:"0.13em", background:themeState.bgAlt }}>
              <span style={{ color:manualScale?themeState.warn:themeState.accent }}>
                {manualScale?`MANUAL ${Math.round(scale*100)}%`:`AUTO-FIT ${Math.round(scale*100)}%`}
              </span>
              <span>{Math.round(1920*scale)}×{Math.round(1080*scale)}px</span>
              <span>MARGIN H:{layout.marginH} V:{layout.marginV}</span>
              <span>GAP {layout.gap}px</span>
              <span style={{ marginLeft:"auto", color:themeState.ok }}>✓ 16:9</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
