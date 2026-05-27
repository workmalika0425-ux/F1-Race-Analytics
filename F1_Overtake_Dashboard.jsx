import { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, AreaChart, Area, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Cell
} from "recharts";

/* ─── THEME ─────────────────────────────────────────────── */
const T = {
  bg: "#050508",
  panel: "#0d0d14",
  border: "#1a1a2e",
  red: "#e8002d",
  cyan: "#00c8ff",
  gold: "#ffd700",
  green: "#39b54a",
  white: "#f0f0f0",
  muted: "#6b7280",
  text: "#c8ccd4",
};

const COMPOUND_COLORS = {
  SOFT: "#e8002d", MEDIUM: "#ffd700", HARD: "#f0f0f0",
  INTERMEDIATE: "#39b54a", WET: "#0067ff", UNKNOWN: "#888"
};

/* ─── DRIVER TEAMS / COLORS ──────────────────────────────── */
const DRIVER_TEAM_COLORS = {
  VER:"#3671C6",HAM:"#27F4D2",LEC:"#E8002D",SAI:"#E8002D",
  NOR:"#FF8000",PIA:"#FF8000",RUS:"#27F4D2",ALO:"#358C75",
  STR:"#358C75",PER:"#3671C6",GAS:"#0093CC",OCO:"#0093CC",
  HUL:"#B6BABD",MAG:"#B6BABD",BOT:"#C92D4B",ZHO:"#C92D4B",
  TSU:"#5E8FAA",DEV:"#5E8FAA",ALB:"#64C4FF",SAR:"#64C4FF",
  MSC:"#B6BABD",LAT:"#64C4FF",VET:"#358C75",RIC:"#3671C6",
};

/* ─── STATIC F1 DATA (realistic simulation) ──────────────── */
const RACE_SCHEDULES = {
  2023: ["Bahrain","Saudi Arabia","Australia","Azerbaijan","Miami","Monaco","Spain","Canada","Austria","British","Hungarian","Belgian","Dutch","Italian","Singapore","Japanese","Qatar","United States","Mexico City","São Paulo","Las Vegas","Abu Dhabi"],
  2024: ["Bahrain","Saudi Arabia","Australia","Japanese","Chinese","Miami","Emilia Romagna","Monaco","Canadian","Spanish","Austrian","British","Hungarian","Belgian","Dutch","Italian","Azerbaijan","Singapore","United States","Mexico City","São Paulo","Las Vegas","Qatar","Abu Dhabi"],
  2022: ["Bahrain","Saudi Arabia","Australian","Emilia Romagna","Miami","Spanish","Monaco","Azerbaijan","Canadian","British","Austrian","French","Hungarian","Belgian","Dutch","Italian","Singapore","Japanese","United States","Mexico City","São Paulo","Abu Dhabi"],
  2021: ["Bahrain","Emilia Romagna","Portuguese","Spanish","Monaco","Azerbaijan","French","Styrian","Austrian","British","Hungarian","Belgian","Dutch","Italian","Russian","Turkish","United States","Mexico City","São Paulo","Qatar","Saudi Arabia","Abu Dhabi"],
};

const TRACK_LAYOUTS = {
  Bahrain:      { corners: 15, drs_zones: 3, length_km: 5.412, overtake_rating: 7 },
  Australia:    { corners: 16, drs_zones: 4, length_km: 5.278, overtake_rating: 5 },
  Monaco:       { corners: 19, drs_zones: 1, length_km: 3.337, overtake_rating: 2 },
  Spain:        { corners: 16, drs_zones: 2, length_km: 4.675, overtake_rating: 5 },
  British:      { corners: 18, drs_zones: 2, length_km: 5.891, overtake_rating: 6 },
  Italian:      { corners: 11, drs_zones: 2, length_km: 5.793, overtake_rating: 8 },
  Singapore:    { corners: 23, drs_zones: 3, length_km: 5.063, overtake_rating: 4 },
  Japanese:     { corners: 18, drs_zones: 2, length_km: 5.807, overtake_rating: 6 },
  Abu_Dhabi:    { corners: 16, drs_zones: 3, length_km: 5.281, overtake_rating: 6 },
  default:      { corners: 16, drs_zones: 2, length_km: 5.2,   overtake_rating: 5 },
};

const ALL_DRIVERS_2023 = ["VER","PER","ALO","HAM","LEC","SAI","NOR","RUS","STR","GAS","OCO","ALB","BOT","ZHO","TSU","MAG","HUL","DEV","SAR","PIA"];
const ALL_DRIVERS_2024 = ["VER","NOR","LEC","SAI","PIA","RUS","HAM","PER","ALO","STR","GAS","OCO","ALB","MAG","HUL","BOT","ZHO","TSU","RIC","SAR"];
const ALL_DRIVERS_2022 = ["VER","LEC","PER","SAI","HAM","RUS","NOR","BOT","OCO","ALO","VET","GAS","STR","ZHO","MSC","LAT","ALB","TSU","MAG","RIC"];
const ALL_DRIVERS_2021 = ["VER","HAM","BOT","PER","SAI","NOR","LEC","RIC","ALO","STR","GAS","VET","RUS","LAT","MAG","TSU","STR","OCO","ALB","MSC"];

function getDriverList(year) {
  if (year === 2024) return ALL_DRIVERS_2024;
  if (year === 2022) return ALL_DRIVERS_2022;
  if (year === 2021) return ALL_DRIVERS_2021;
  return ALL_DRIVERS_2023;
}

/* ─── DATA SIMULATION ENGINE ─────────────────────────────── */
function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function generateRaceData(year, race, drivers) {
  const seed = year * 1000 + race.charCodeAt(0) * 7;
  const rng = seededRand(seed);
  const totalLaps = 45 + Math.floor(rng() * 25);
  const track = TRACK_LAYOUTS[race.split(" ")[0]] || TRACK_LAYOUTS.default;

  // baseline pace per driver (lower = faster)
  const basePace = {};
  const shuffled = [...drivers].sort(() => rng() - 0.5);
  shuffled.forEach((d, i) => { basePace[d] = 88 + i * 0.25 + rng() * 0.5; });

  // generate lap-by-lap data
  const lapData = {};
  const stintData = {};
  const compounds = ["SOFT","MEDIUM","HARD"];
  const startPositions = {};
  const shuffledStart = [...drivers].sort(() => rng() - 0.5);
  shuffledStart.forEach((d, i) => { startPositions[d] = i + 1; });

  drivers.forEach(driver => {
    lapData[driver] = [];
    stintData[driver] = [];
    let currentPos = startPositions[driver];
    let tyreLife = 0;
    let stint = 1;
    let compound = rng() < 0.6 ? "SOFT" : "MEDIUM";
    let lapOnTyre = 0;
    const pitLaps = [];
    if (totalLaps > 30) {
      const pit1 = 15 + Math.floor(rng() * 15);
      pitLaps.push(pit1);
      if (rng() > 0.4) pitLaps.push(pit1 + 15 + Math.floor(rng() * 10));
    }

    for (let lap = 1; lap <= totalLaps; lap++) {
      if (pitLaps.includes(lap)) {
        stintData[driver].push({ stint, compound, lapStart: lap - lapOnTyre, lapEnd: lap - 1 });
        stint++;
        lapOnTyre = 0;
        const prevCompound = compound;
        compound = compounds.filter(c => c !== prevCompound)[Math.floor(rng() * 2)];
        tyreLife = 0;
      }
      lapOnTyre++;
      tyreLife++;

      const tyreDeg = tyreLife * (compound === "SOFT" ? 0.06 : compound === "MEDIUM" ? 0.04 : 0.02);
      const noise = (rng() - 0.5) * 0.8;
      const lapTime = basePace[driver] + tyreDeg + noise;
      const posNoise = rng() < 0.1 ? (rng() < 0.5 ? 1 : -1) : 0;
      currentPos = Math.max(1, Math.min(drivers.length, currentPos + posNoise));

      // overtake probability (XGBoost-like simulation)
      const posAdv = (currentPos - 1) / (drivers.length - 1);
      const tyreAdv = Math.max(0, 1 - tyreLife / 30);
      const paceAdv = Math.max(0, (90 - lapTime) / 10);
      const drsBoost = track.drs_zones * 0.05;
      const prob = Math.max(0, Math.min(25,
        (posAdv * 3 + tyreAdv * 5 + paceAdv * 4 + drsBoost + (rng() - 0.5) * 2) *
        track.overtake_rating / 5
      ));

      const s1 = lapTime * 0.28 + (rng() - 0.5) * 0.2;
      const s2 = lapTime * 0.35 + (rng() - 0.5) * 0.2;
      const s3 = lapTime - s1 - s2;

      lapData[driver].push({
        lap, lapTime: +lapTime.toFixed(3),
        position: currentPos, compound, tyreLife,
        sector1: +s1.toFixed(3), sector2: +s2.toFixed(3), sector3: +s3.toFixed(3),
        overtakeProb: +prob.toFixed(2), stint,
        speed: 220 + Math.floor(rng() * 100),
      });
    }
    stintData[driver].push({ stint, compound, lapStart: totalLaps - lapOnTyre + 1, lapEnd: totalLaps });
  });

  return { lapData, stintData, totalLaps, track, basePace, startPositions };
}

/* ─── TRACK MAP SVG (schematic) ─────────────────────────── */
const TRACK_PATHS = {
  Bahrain: "M 80 200 L 80 100 Q 80 60 120 60 L 200 60 Q 260 60 260 100 L 260 140 Q 260 180 300 180 L 340 180 Q 380 180 380 160 L 380 120 Q 380 80 420 80 L 460 80 Q 500 80 500 120 L 500 200 Q 500 260 460 280 L 380 300 Q 320 320 260 300 L 200 260 Q 160 240 140 220 L 80 200",
  default: "M 100 180 L 100 100 Q 100 60 140 60 L 220 60 Q 280 60 300 100 L 320 140 Q 340 180 380 180 L 420 180 Q 460 180 460 140 L 460 100 Q 460 60 500 60 L 520 60 Q 560 60 560 100 L 560 200 Q 560 260 520 280 L 440 300 Q 360 320 280 300 L 200 260 Q 150 240 120 210 L 100 180",
};

function TrackMap({ driverLaps, driver1Color, driver2Color, selectedDrivers, totalLaps, currentHighlightLap }) {
  const path = TRACK_PATHS.default;
  return (
    <svg viewBox="0 0 660 360" style={{ width: "100%", height: "100%" }}>
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Track base */}
      <path d={path} fill="none" stroke="#1a1a2e" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round"/>
      <path d={path} fill="none" stroke="#2a2a3e" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round"/>
      {/* DRS zones highlight */}
      <path d="M 80 200 L 80 100" fill="none" stroke="#00c8ff22" strokeWidth="18"/>
      <path d="M 380 180 L 460 180" fill="none" stroke="#00c8ff22" strokeWidth="18"/>
      {/* Track surface */}
      <path d={path} fill="none" stroke="#252535" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round"/>

      {/* Overtake markers */}
      {driverLaps && currentHighlightLap && driverLaps.map((lap, i) => {
        if (lap.lap !== currentHighlightLap) return null;
        if (lap.overtakeProb > 8) {
          return (
            <g key={i}>
              <circle cx={120 + (i * 40)} cy={80} r={8} fill={T.red} filter="url(#glow)" opacity={0.8}/>
              <text x={120 + (i * 40)} y={75} textAnchor="middle" fill={T.white} fontSize={9}>⚡</text>
            </g>
          );
        }
        return null;
      })}

      {/* DRS labels */}
      <text x={60} y={150} fill={T.cyan} fontSize={9} opacity={0.7} transform="rotate(-90, 60, 150)">DRS 1</text>
      <text x={420} y={175} fill={T.cyan} fontSize={9} opacity={0.7}>DRS 2</text>

      {/* Start/Finish */}
      <line x1={80} y1={185} x2={80} y2={215} stroke={T.gold} strokeWidth={3}/>
      <text x={56} y={205} fill={T.gold} fontSize={9} fontWeight="bold">S/F</text>

      {/* Corner numbers */}
      {[1,2,3,5,7,10,12,15].map((c, i) => {
        const angles = [0.05,0.12,0.2,0.32,0.45,0.6,0.72,0.85];
        const pts = getPathPoint(path, angles[i]);
        return pts ? (
          <text key={c} x={pts.x} y={pts.y} fill={T.muted} fontSize={8} textAnchor="middle">{c}</text>
        ) : null;
      })}
    </svg>
  );
}

function getPathPoint(d, t) {
  // simple approximation — return fixed points for our schematic
  const pts = [
    {x:80,y:150},{x:100,y:70},{x:180,y:55},{x:260,y:80},
    {x:280,y:160},{x:340,y:185},{x:420,y:185},{x:460,y:120},
    {x:500,y:65},{x:540,y:90},{x:555,y:200},{x:520,y:275},
    {x:400,y:310},{x:280,y:305},{x:160,y:260},{x:100,y:210}
  ];
  const idx = Math.min(Math.floor(t * pts.length), pts.length - 1);
  return pts[idx];
}

/* ─── SMALL COMPONENTS ───────────────────────────────────── */
const MetricCard = ({ label, value, sub, color = T.red, icon }) => (
  <div style={{
    background: T.panel, border: `1px solid ${T.border}`,
    borderTop: `3px solid ${color}`, borderRadius: 8, padding: "14px 16px",
    display: "flex", flexDirection: "column", gap: 4, minWidth: 0,
  }}>
    <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: 1 }}>{icon} {label}</div>
    <div style={{ fontSize: 22, fontWeight: 900, color, fontFamily: "'Oswald', sans-serif", lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: T.muted }}>{sub}</div>}
  </div>
);

const SectionHeader = ({ children, icon }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "24px 0 12px" }}>
    <div style={{ width: 3, height: 20, background: T.red, borderRadius: 2 }}/>
    <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: 2,
      textTransform: "uppercase", color: T.white, fontFamily: "'Oswald', sans-serif" }}>
      {icon} {children}
    </h2>
  </div>
);

const TabBtn = ({ active, onClick, children }) => (
  <button onClick={onClick} style={{
    background: active ? T.red : "transparent",
    color: active ? T.white : T.muted,
    border: `1px solid ${active ? T.red : T.border}`,
    borderRadius: 4, padding: "6px 14px", cursor: "pointer",
    fontSize: 12, fontWeight: 700, letterSpacing: 1,
    textTransform: "uppercase", fontFamily: "'Oswald', sans-serif",
    transition: "all 0.15s",
  }}>{children}</button>
);

const Select = ({ value, onChange, options, style = {} }) => (
  <select value={value} onChange={e => onChange(e.target.value)} style={{
    background: T.panel, color: T.white, border: `1px solid ${T.border}`,
    borderRadius: 5, padding: "7px 12px", fontSize: 13,
    fontFamily: "'Oswald', sans-serif", cursor: "pointer",
    appearance: "none", minWidth: 120, ...style,
  }}>
    {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
  </select>
);

/* ─── CUSTOM TOOLTIP ─────────────────────────────────────── */
const DarkTooltip = ({ active, payload, label, unit = "" }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0d0d14ee", border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 12px" }}>
      <p style={{ margin: "0 0 4px", color: T.muted, fontSize: 11 }}>Lap {label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: "2px 0", color: p.color || T.white, fontSize: 12, fontWeight: 600 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}{unit}
        </p>
      ))}
    </div>
  );
};

/* ─── OVERTAKE PROBABILITY TIMELINE CHART ───────────────── */
const OvertakeTimeline = ({ lapData, driver1, driver2, totalLaps }) => {
  const d1 = lapData[driver1] || [];
  const d2 = driver2 ? (lapData[driver2] || []) : [];
  const merged = d1.map(l => ({
    lap: l.lap,
    [driver1]: l.overtakeProb,
    ...(d2[l.lap - 1] ? { [driver2]: d2[l.lap - 1].overtakeProb } : {}),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={merged} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={T.red} stopOpacity={0.3}/>
            <stop offset="95%" stopColor={T.red} stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="grad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={T.cyan} stopOpacity={0.3}/>
            <stop offset="95%" stopColor={T.cyan} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#1a1a2e" strokeDasharray="3 3"/>
        <XAxis dataKey="lap" tick={{ fill: T.muted, fontSize: 10 }} label={{ value: "Lap", position: "insideBottom", fill: T.muted, fontSize: 10 }}/>
        <YAxis tick={{ fill: T.muted, fontSize: 10 }} unit="%"/>
        <Tooltip content={<DarkTooltip unit="%" />} />
        <Legend wrapperStyle={{ fontSize: 11, color: T.muted }}/>
        <Area type="monotone" dataKey={driver1} stroke={T.red} fill="url(#grad1)" strokeWidth={2} dot={false}/>
        {driver2 && <Area type="monotone" dataKey={driver2} stroke={T.cyan} fill="url(#grad2)" strokeWidth={2} dot={false}/>}
        <ReferenceLine y={10} stroke={T.gold} strokeDasharray="3 3" label={{ value: "High risk", fill: T.gold, fontSize: 10 }}/>
      </AreaChart>
    </ResponsiveContainer>
  );
};

/* ─── TYRE STRATEGY BAR ──────────────────────────────────── */
const TyreStrategy = ({ stintData, driver, totalLaps }) => {
  const stints = stintData[driver] || [];
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center", height: 28, position: "relative" }}>
      {stints.map((s, i) => {
        const width = ((s.lapEnd - s.lapStart + 1) / totalLaps) * 100;
        const color = COMPOUND_COLORS[s.compound] || COMPOUND_COLORS.UNKNOWN;
        return (
          <div key={i} title={`${s.compound}: Laps ${s.lapStart}–${s.lapEnd}`}
            style={{
              width: `${width}%`, height: "100%", background: color,
              borderRadius: 3, display: "flex", alignItems: "center",
              justifyContent: "center", position: "relative", cursor: "pointer",
            }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: s.compound === "HARD" ? "#111" : "#111",
              textShadow: "none" }}>{s.compound[0]}</span>
          </div>
        );
      })}
    </div>
  );
};

/* ─── DRIVER PROFILE CARD ────────────────────────────────── */
const DriverCard = ({ driver, lapData, stintData, totalLaps, color }) => {
  const laps = lapData[driver] || [];
  if (!laps.length) return null;
  const lastLap = laps[laps.length - 1];
  const bestLap = Math.min(...laps.map(l => l.lapTime));
  const avgLap = (laps.reduce((a, b) => a + b.lapTime, 0) / laps.length).toFixed(3);
  const startPos = laps[0]?.position || "—";
  const finishPos = lastLap?.position || "—";
  const gained = startPos - finishPos;
  const avgOvertake = (laps.reduce((a, b) => a + b.overtakeProb, 0) / laps.length).toFixed(1);

  return (
    <div style={{
      background: T.panel, border: `1px solid ${T.border}`,
      borderLeft: `4px solid ${color}`, borderRadius: 8, padding: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 24, fontWeight: 700, color }}>{driver}</div>
        <div style={{
          background: `${color}22`, border: `1px solid ${color}44`,
          borderRadius: 20, padding: "3px 10px", fontSize: 11, color, fontWeight: 700
        }}>P{finishPos}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          ["Best Lap", `${bestLap.toFixed(3)}s`],
          ["Avg Lap", `${avgLap}s`],
          ["Start Pos", `P${startPos}`],
          ["Pos Change", gained > 0 ? `▲${gained}` : gained < 0 ? `▼${Math.abs(gained)}` : "—"],
          ["Avg OT%", `${avgOvertake}%`],
          ["Laps", laps.length],
        ].map(([k,v]) => (
          <div key={k}>
            <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>{k}</div>
            <div style={{ fontSize: 14, color: T.white, fontWeight: 700 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 10, color: T.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>TYRE STRATEGY</div>
        <TyreStrategy stintData={stintData} driver={driver} totalLaps={totalLaps}/>
      </div>
    </div>
  );
};

/* ─── LEADERBOARD ────────────────────────────────────────── */
const Leaderboard = ({ lapData, drivers, currentLap }) => {
  const rows = drivers.map(d => {
    const laps = lapData[d] || [];
    const atLap = laps.find(l => l.lap === currentLap) || laps[laps.length - 1];
    return { driver: d, position: atLap?.position || 99, compound: atLap?.compound || "—",
             tyreLife: atLap?.tyreLife || 0, overtakeProb: atLap?.overtakeProb || 0 };
  }).sort((a,b) => a.position - b.position);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {rows.map((r, i) => {
        const dColor = DRIVER_TEAM_COLORS[r.driver] || T.muted;
        const barWidth = Math.min(100, r.overtakeProb * 5);
        return (
          <div key={r.driver} style={{
            background: T.panel, border: `1px solid ${T.border}`,
            borderLeft: `3px solid ${dColor}`,
            borderRadius: 5, padding: "6px 12px",
            display: "grid", gridTemplateColumns: "28px 48px 1fr 70px 60px 80px",
            alignItems: "center", gap: 8, fontSize: 12,
          }}>
            <span style={{ color: i < 3 ? T.gold : T.muted, fontWeight: 700 }}>P{r.position}</span>
            <span style={{ color: dColor, fontWeight: 700, fontFamily: "'Oswald', sans-serif" }}>{r.driver}</span>
            <div style={{ height: 4, background: "#1a1a2e", borderRadius: 2 }}>
              <div style={{ width: `${barWidth}%`, height: "100%", background: T.red, borderRadius: 2 }}/>
            </div>
            <span style={{ color: COMPOUND_COLORS[r.compound] || T.muted, fontSize: 11 }}>
              {r.compound} ({r.tyreLife}L)
            </span>
            <span style={{ color: T.muted, fontSize: 11 }}>Lap {r.tyreLife}</span>
            <span style={{ color: r.overtakeProb > 10 ? T.red : r.overtakeProb > 5 ? T.gold : T.green,
              fontWeight: 700, textAlign: "right" }}>
              {r.overtakeProb.toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
};

/* ─── COMPARISON RADAR ───────────────────────────────────── */
const DriverRadar = ({ lapData, driver1, driver2 }) => {
  const calc = (driver) => {
    const laps = lapData[driver] || [];
    if (!laps.length) return null;
    const bestLap = Math.min(...laps.map(l => l.lapTime));
    const avgOT = laps.reduce((a, b) => a + b.overtakeProb, 0) / laps.length;
    const s1 = laps.reduce((a, b) => a + b.sector1, 0) / laps.length;
    const s2 = laps.reduce((a, b) => a + b.sector2, 0) / laps.length;
    const s3 = laps.reduce((a, b) => a + b.sector3, 0) / laps.length;
    const consistency = 100 - (Math.max(...laps.map(l=>l.lapTime)) - bestLap) * 10;
    return { bestLap, avgOT, s1, s2, s3, consistency: Math.max(0, consistency) };
  };

  const d1 = calc(driver1);
  const d2 = calc(driver2);
  if (!d1 || !d2) return null;

  const norm = (val, min, max) => Math.round(((val - min) / (max - min)) * 100);

  const data = [
    { metric: "Pace", [driver1]: norm(d1.bestLap, 95, 86), [driver2]: norm(d2.bestLap, 95, 86) },
    { metric: "OT Threat", [driver1]: Math.round(d1.avgOT * 4), [driver2]: Math.round(d2.avgOT * 4) },
    { metric: "Sector 1", [driver1]: norm(d1.s1, 28, 23), [driver2]: norm(d2.s1, 28, 23) },
    { metric: "Sector 2", [driver1]: norm(d1.s2, 34, 28), [driver2]: norm(d2.s2, 34, 28) },
    { metric: "Sector 3", [driver1]: norm(d1.s3, 26, 22), [driver2]: norm(d2.s3, 26, 22) },
    { metric: "Consistency", [driver1]: Math.round(d1.consistency), [driver2]: Math.round(d2.consistency) },
  ];

  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={data}>
        <PolarGrid stroke={T.border}/>
        <PolarAngleAxis dataKey="metric" tick={{ fill: T.muted, fontSize: 10 }}/>
        <PolarRadiusAxis domain={[0, 100]} tick={false}/>
        <Radar name={driver1} dataKey={driver1} stroke={T.red} fill={T.red} fillOpacity={0.15}/>
        <Radar name={driver2} dataKey={driver2} stroke={T.cyan} fill={T.cyan} fillOpacity={0.15}/>
        <Legend wrapperStyle={{ fontSize: 11, color: T.muted }}/>
        <Tooltip contentStyle={{ background: T.panel, border: `1px solid ${T.border}`, fontSize: 11 }}/>
      </RadarChart>
    </ResponsiveContainer>
  );
};

/* ─── SECTOR HEATMAP ─────────────────────────────────────── */
const SectorHeatmap = ({ lapData, driver }) => {
  const laps = (lapData[driver] || []).slice(0, 40);
  if (!laps.length) return null;
  const allS = laps.flatMap(l => [l.sector1, l.sector2, l.sector3]);
  const minS = Math.min(...allS), maxS = Math.max(...allS);
  const interp = v => {
    const t = (v - minS) / (maxS - minS);
    return t < 0.33 ? `rgb(39,180,72)` : t < 0.66 ? `rgb(255,215,0)` : `rgb(232,0,45)`;
  };
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", gap: 2, minWidth: laps.length * 22 }}>
        {["S1","S2","S3"].map(sector => (
          <div key={sector} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <div style={{ fontSize: 9, color: T.muted, textAlign: "center", marginBottom: 2 }}>{sector}</div>
            {laps.map((l, i) => {
              const v = sector === "S1" ? l.sector1 : sector === "S2" ? l.sector2 : l.sector3;
              return (
                <div key={i} title={`Lap ${l.lap} ${sector}: ${v.toFixed(3)}s`}
                  style={{ width: 18, height: 14, background: interp(v), borderRadius: 2, cursor: "pointer" }}/>
              );
            })}
          </div>
        ))}
        <div style={{ display: "flex", flexDirection: "column", gap: 1, marginLeft: 4 }}>
          <div style={{ fontSize: 9, color: T.muted, marginBottom: 2 }}>LAP</div>
          {laps.map(l => (
            <div key={l.lap} style={{ fontSize: 8, color: T.muted, height: 14, lineHeight: "14px" }}>{l.lap}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─── MAIN APP ────────────────────────────────────────────── */
export default function F1Dashboard() {
  const [year, setYear] = useState(2023);
  const [race, setRace] = useState("Bahrain");
  const [driver, setDriver] = useState("VER");
  const [compareD1, setCompareD1] = useState("VER");
  const [compareD2, setCompareD2] = useState("LEC");
  const [tab, setTab] = useState("driver");
  const [highlightLap, setHighlightLap] = useState(null);
  const [raceData, setRaceData] = useState(null);
  const [loading, setLoading] = useState(false);

  const drivers = getDriverList(year);
  const races = RACE_SCHEDULES[year] || RACE_SCHEDULES[2023];

  // Load race data when year/race changes
  useEffect(() => {
    setLoading(true);
    // Simulate async load
    const timer = setTimeout(() => {
      const data = generateRaceData(year, race, drivers);
      setRaceData(data);
      setDriver(drivers[0]);
      setCompareD1(drivers[0]);
      setCompareD2(drivers[1]);
      setHighlightLap(null);
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [year, race]);

  if (!raceData) return (
    <div style={{ background: T.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: T.red, fontFamily: "'Oswald', sans-serif", fontSize: 24 }}>Loading F1 Data...</div>
    </div>
  );

  const { lapData, stintData, totalLaps, track } = raceData;
  const driverLaps = lapData[driver] || [];
  const currentLap = driverLaps.length;

  // Top-level metrics
  const allLatest = drivers.map(d => {
    const l = lapData[d];
    return l ? l[l.length - 1] : null;
  }).filter(Boolean);
  const leader = allLatest.sort((a,b) => a.position - b.position)[0]?.driver || "—";
  const highestOT = Math.max(...allLatest.map(l => l.overtakeProb)).toFixed(1);
  const highestOTDriver = allLatest.find(l => l.overtakeProb === Math.max(...allLatest.map(x => x.overtakeProb)))?.driver || "—";
  const avgOT = (allLatest.reduce((a,b) => a + b.overtakeProb, 0) / allLatest.length).toFixed(1);

  const d1Color = DRIVER_TEAM_COLORS[compareD1] || T.red;
  const d2Color = DRIVER_TEAM_COLORS[compareD2] || T.cyan;
  const dColor = DRIVER_TEAM_COLORS[driver] || T.red;

  // For comparison lap time chart
  const compLapData = (lapData[compareD1] || []).map((l, i) => ({
    lap: l.lap,
    [compareD1]: l.lapTime,
    [compareD2]: lapData[compareD2]?.[i]?.lapTime,
  }));
  const compPosData = (lapData[compareD1] || []).map((l, i) => ({
    lap: l.lap,
    [compareD1]: l.position,
    [compareD2]: lapData[compareD2]?.[i]?.position,
  }));
  const compOTData = (lapData[compareD1] || []).map((l, i) => ({
    lap: l.lap,
    [compareD1]: l.overtakeProb,
    [compareD2]: lapData[compareD2]?.[i]?.overtakeProb,
  }));

  // Overtake events (prob spike > 12)
  const overtakeEvents = driverLaps.filter(l => l.overtakeProb > 12);

  return (
    <div style={{
      background: T.bg, minHeight: "100vh", color: T.text,
      fontFamily: "'Barlow', 'Helvetica Neue', sans-serif",
      fontSize: 13,
    }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&family=Barlow:wght@400;600&display=swap');
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: ${T.bg}; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 2px; }
        select option { background: ${T.panel}; color: ${T.white}; }
      `}</style>

      {/* ── TOP HEADER ── */}
      <div style={{
        background: `linear-gradient(180deg, #0d0010 0%, ${T.bg} 100%)`,
        borderBottom: `1px solid ${T.border}`,
        padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 4, height: 36, background: T.red, borderRadius: 2 }}/>
          <div>
            <div style={{
              fontFamily: "'Oswald', sans-serif", fontSize: 22, fontWeight: 700,
              color: T.white, letterSpacing: 3, textTransform: "uppercase",
            }}>
              🏎️ F1 OVERTAKE PREDICTOR
            </div>
            <div style={{ fontSize: 11, color: T.muted, letterSpacing: 1 }}>
              AI Race Analytics Dashboard · {year} {race} Grand Prix
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Select value={year} onChange={v => setYear(+v)}
            options={[2021,2022,2023,2024].map(y => ({ value: y, label: `${y} Season` }))}/>
          <Select value={race} onChange={setRace}
            options={races.map(r => ({ value: r, label: r + " GP" }))}/>
          {loading && <div style={{ color: T.muted, fontSize: 11 }}>⏳ Loading...</div>}
        </div>
      </div>

      <div style={{ padding: "16px 24px", maxWidth: 1400, margin: "0 auto" }}>

        {/* ── METRICS ROW ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
          <MetricCard icon="🏁" label="Race Leader" value={leader} color={T.gold}/>
          <MetricCard icon="🔥" label="Highest OT%" value={`${highestOT}%`} sub={highestOTDriver} color={T.red}/>
          <MetricCard icon="📊" label="Avg OT Prob" value={`${avgOT}%`} color={T.cyan}/>
          <MetricCard icon="🛞" label="Total Laps" value={totalLaps} color={T.green}/>
          <MetricCard icon="🏟️" label="DRS Zones" value={track.drs_zones} color={T.cyan}/>
          <MetricCard icon="📐" label="Circuit Length" value={`${track.length_km}km`} color={T.muted}/>
        </div>

        {/* ── TABS ── */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            { key: "driver", label: "Driver Analysis" },
            { key: "track", label: "Track & Overtakes" },
            { key: "compare", label: "Driver vs Driver" },
            { key: "leaderboard", label: "Live Leaderboard" },
          ].map(t => <TabBtn key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>{t.label}</TabBtn>)}
        </div>

        {/* ══════════════════════ TAB: DRIVER ANALYSIS ══════════════════════ */}
        {tab === "driver" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <Select value={driver} onChange={setDriver}
                options={drivers.map(d => ({ value: d, label: d }))}
                style={{ fontSize: 15, fontWeight: 700 }}/>
              <div style={{ color: T.muted, fontSize: 12 }}>
                Select a driver to see their complete race analytics
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 14, marginBottom: 16 }}>
              <DriverCard driver={driver} lapData={lapData} stintData={stintData} totalLaps={totalLaps} color={dColor}/>
              <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16 }}>
                <SectionHeader icon="🔥">Overtake Probability — All Laps</SectionHeader>
                <OvertakeTimeline lapData={lapData} driver1={driver} totalLaps={totalLaps}/>
                {overtakeEvents.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>HIGH OVERTAKE PROBABILITY LAPS</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {overtakeEvents.map(l => (
                        <div key={l.lap} style={{
                          background: `${T.red}22`, border: `1px solid ${T.red}55`,
                          borderRadius: 4, padding: "3px 8px", fontSize: 11,
                          color: T.red, fontWeight: 700, cursor: "pointer",
                        }} onClick={() => setHighlightLap(l.lap)}>
                          L{l.lap} — {l.overtakeProb.toFixed(1)}%
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Lap Time chart */}
            <SectionHeader icon="⏱️">Lap Times</SectionHeader>
            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16, marginBottom: 14 }}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={driverLaps} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#1a1a2e" strokeDasharray="3 3"/>
                  <XAxis dataKey="lap" tick={{ fill: T.muted, fontSize: 10 }}/>
                  <YAxis domain={["auto","auto"]} tick={{ fill: T.muted, fontSize: 10 }} unit="s"/>
                  <Tooltip content={<DarkTooltip unit="s"/>}/>
                  <Line type="monotone" dataKey="lapTime" stroke={dColor} dot={false} strokeWidth={2}
                    name="Lap Time"/>
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Sector Heatmap */}
            <SectionHeader icon="⚡">Sector Time Heatmap</SectionHeader>
            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>
                Green = fastest · Yellow = medium · Red = slowest
              </div>
              <SectorHeatmap lapData={lapData} driver={driver}/>
            </div>

            {/* Position chart */}
            <SectionHeader icon="📈">Race Position</SectionHeader>
            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16 }}>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={driverLaps} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#1a1a2e" strokeDasharray="3 3"/>
                  <XAxis dataKey="lap" tick={{ fill: T.muted, fontSize: 10 }}/>
                  <YAxis reversed domain={[1, drivers.length]} tick={{ fill: T.muted, fontSize: 10 }}/>
                  <Tooltip content={<DarkTooltip/>}/>
                  <Line type="stepAfter" dataKey="position" stroke={dColor} dot={false} strokeWidth={2} name="Position"/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ══════════════════════ TAB: TRACK & OVERTAKES ══════════════════════ */}
        {tab === "track" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              {/* Track Map */}
              <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16 }}>
                <SectionHeader icon="🗺️">Track Map — {race}</SectionHeader>
                <div style={{ height: 280 }}>
                  <TrackMap
                    driverLaps={driverLaps}
                    driver1Color={dColor}
                    totalLaps={totalLaps}
                    currentHighlightLap={highlightLap}
                  />
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                  {[
                    ["Corners", track.corners],
                    ["DRS Zones", track.drs_zones],
                    ["OT Rating", `${track.overtake_rating}/10`],
                    ["Length", `${track.length_km}km`],
                  ].map(([k,v]) => (
                    <div key={k} style={{ background: "#1a1a2e", borderRadius: 4, padding: "4px 10px" }}>
                      <span style={{ color: T.muted, fontSize: 10 }}>{k}: </span>
                      <span style={{ color: T.white, fontSize: 11, fontWeight: 700 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Overtake Probability Heatmap — all drivers, by lap */}
              <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16 }}>
                <SectionHeader icon="🔥">Overtake Probability by Driver & Lap</SectionHeader>
                <div style={{ overflowY: "auto", maxHeight: 300 }}>
                  {drivers.map(d => {
                    const laps = lapData[d] || [];
                    const dC = DRIVER_TEAM_COLORS[d] || T.muted;
                    return (
                      <div key={d} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <div style={{ width: 36, fontSize: 11, color: dC, fontWeight: 700,
                          fontFamily: "'Oswald', sans-serif" }}>{d}</div>
                        <div style={{ flex: 1, display: "flex", gap: 1, overflowX: "hidden" }}>
                          {laps.map(l => {
                            const intensity = Math.min(1, l.overtakeProb / 20);
                            const bg = l.overtakeProb > 12 ? T.red :
                                       l.overtakeProb > 6 ? T.gold :
                                       `rgba(39,180,72,${intensity + 0.1})`;
                            return (
                              <div key={l.lap} title={`L${l.lap}: ${l.overtakeProb.toFixed(1)}%`}
                                onClick={() => setHighlightLap(l.lap)}
                                style={{ width: 8, height: 20, background: bg,
                                  borderRadius: 1, cursor: "pointer", flexShrink: 0 }}/>
                            );
                          })}
                        </div>
                        <div style={{ width: 40, fontSize: 10, color: T.muted, textAlign: "right" }}>
                          {(laps.reduce((a,b) => a + b.overtakeProb, 0) / (laps.length||1)).toFixed(1)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10, color: T.muted, marginTop: 8 }}>
                  🟥 High (>12%) &nbsp; 🟡 Medium (>6%) &nbsp; 🟢 Low (&lt;6%)
                </div>
              </div>
            </div>

            {/* Overtake probability over all laps for selected driver */}
            <SectionHeader icon="📍">Overtake Probability Timeline — Select Driver</SectionHeader>
            <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <Select value={driver} onChange={setDriver} options={drivers}/>
            </div>
            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16, marginBottom: 14 }}>
              <OvertakeTimeline lapData={lapData} driver1={driver} totalLaps={totalLaps}/>
            </div>

            {/* Overtake events table */}
            <SectionHeader icon="⚡">Overtake Events (High Probability Laps)</SectionHeader>
            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#1a1a2e" }}>
                    {["Driver","Lap","Position","Compound","Tyre Life","OT Probability","Risk Level"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", fontSize: 10, color: T.muted,
                        textTransform: "uppercase", letterSpacing: 0.8, textAlign: "left", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drivers.flatMap(d => {
                    const laps = lapData[d] || [];
                    return laps
                      .filter(l => l.overtakeProb > 8)
                      .map(l => ({ driver: d, ...l }));
                  }).sort((a,b) => b.overtakeProb - a.overtakeProb).slice(0, 20).map((row, i) => {
                    const dC = DRIVER_TEAM_COLORS[row.driver] || T.muted;
                    const risk = row.overtakeProb > 15 ? ["🔴","HIGH",T.red] :
                                 row.overtakeProb > 10 ? ["🟡","MEDIUM",T.gold] : ["🟢","LOW",T.green];
                    return (
                      <tr key={i} style={{ borderTop: `1px solid ${T.border}`,
                        background: i % 2 === 0 ? "transparent" : "#0a0a10" }}>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{ color: dC, fontWeight: 700, fontFamily: "'Oswald', sans-serif" }}>{row.driver}</span>
                        </td>
                        <td style={{ padding: "8px 12px", color: T.white }}>Lap {row.lap}</td>
                        <td style={{ padding: "8px 12px", color: T.muted }}>P{row.position}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{ color: COMPOUND_COLORS[row.compound] || T.muted }}>{row.compound}</span>
                        </td>
                        <td style={{ padding: "8px 12px", color: T.muted }}>{row.tyreLife}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 50, height: 4, background: "#1a1a2e", borderRadius: 2 }}>
                              <div style={{ width: `${Math.min(100, row.overtakeProb * 5)}%`, height: "100%",
                                background: risk[2], borderRadius: 2 }}/>
                            </div>
                            <span style={{ color: risk[2], fontWeight: 700 }}>{row.overtakeProb.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{ color: risk[2], fontSize: 11 }}>{risk[0]} {risk[1]}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════ TAB: DRIVER vs DRIVER ══════════════════════ */}
        {tab === "compare" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <Select value={compareD1} onChange={setCompareD1} options={drivers.map(d => ({ value: d, label: d }))}/>
              <div style={{ color: T.red, fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 18 }}>VS</div>
              <Select value={compareD2} onChange={v => v !== compareD1 && setCompareD2(v)}
                options={drivers.filter(d => d !== compareD1).map(d => ({ value: d, label: d }))}/>
            </div>

            {/* Driver cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <DriverCard driver={compareD1} lapData={lapData} stintData={stintData} totalLaps={totalLaps} color={d1Color}/>
              <DriverCard driver={compareD2} lapData={lapData} stintData={stintData} totalLaps={totalLaps} color={d2Color}/>
            </div>

            {/* Radar chart */}
            <SectionHeader icon="🎯">Performance Radar</SectionHeader>
            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16, marginBottom: 14 }}>
              <DriverRadar lapData={lapData} driver1={compareD1} driver2={compareD2}/>
            </div>

            {/* Lap time battle */}
            <SectionHeader icon="⏱️">Lap Time Battle</SectionHeader>
            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16, marginBottom: 14 }}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={compLapData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#1a1a2e" strokeDasharray="3 3"/>
                  <XAxis dataKey="lap" tick={{ fill: T.muted, fontSize: 10 }}/>
                  <YAxis domain={["auto","auto"]} tick={{ fill: T.muted, fontSize: 10 }} unit="s"/>
                  <Tooltip content={<DarkTooltip unit="s"/>}/>
                  <Legend wrapperStyle={{ fontSize: 11 }}/>
                  <Line type="monotone" dataKey={compareD1} stroke={d1Color} dot={false} strokeWidth={2}/>
                  <Line type="monotone" dataKey={compareD2} stroke={d2Color} dot={false} strokeWidth={2}/>
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Position battle */}
            <SectionHeader icon="🏁">Position Battle</SectionHeader>
            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16, marginBottom: 14 }}>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={compPosData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#1a1a2e" strokeDasharray="3 3"/>
                  <XAxis dataKey="lap" tick={{ fill: T.muted, fontSize: 10 }}/>
                  <YAxis reversed domain={[1, drivers.length]} tick={{ fill: T.muted, fontSize: 10 }}/>
                  <Tooltip content={<DarkTooltip/>}/>
                  <Legend wrapperStyle={{ fontSize: 11 }}/>
                  <Line type="stepAfter" dataKey={compareD1} stroke={d1Color} dot={false} strokeWidth={2}/>
                  <Line type="stepAfter" dataKey={compareD2} stroke={d2Color} dot={false} strokeWidth={2}/>
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* OT Probability comparison */}
            <SectionHeader icon="🔥">Overtake Probability Per Lap — Head to Head</SectionHeader>
            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16, marginBottom: 14 }}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={compOTData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gD1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={d1Color} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={d1Color} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gD2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={d2Color} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={d2Color} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1a1a2e" strokeDasharray="3 3"/>
                  <XAxis dataKey="lap" tick={{ fill: T.muted, fontSize: 10 }}/>
                  <YAxis tick={{ fill: T.muted, fontSize: 10 }} unit="%"/>
                  <Tooltip content={<DarkTooltip unit="%"/>}/>
                  <Legend wrapperStyle={{ fontSize: 11 }}/>
                  <Area type="monotone" dataKey={compareD1} stroke={d1Color} fill="url(#gD1)" strokeWidth={2} dot={false}/>
                  <Area type="monotone" dataKey={compareD2} stroke={d2Color} fill="url(#gD2)" strokeWidth={2} dot={false}/>
                  <ReferenceLine y={10} stroke={T.gold} strokeDasharray="3 3"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Average sector times */}
            <SectionHeader icon="⚡">Average Sector Times</SectionHeader>
            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16, marginBottom: 14 }}>
              {(() => {
                const d1Laps = lapData[compareD1] || [];
                const d2Laps = lapData[compareD2] || [];
                const avg = (arr, key) => arr.reduce((a,b) => a + b[key], 0) / (arr.length||1);
                const data = [
                  { sector: "Sector 1", [compareD1]: +avg(d1Laps,"sector1").toFixed(3), [compareD2]: +avg(d2Laps,"sector1").toFixed(3) },
                  { sector: "Sector 2", [compareD1]: +avg(d1Laps,"sector2").toFixed(3), [compareD2]: +avg(d2Laps,"sector2").toFixed(3) },
                  { sector: "Sector 3", [compareD1]: +avg(d1Laps,"sector3").toFixed(3), [compareD2]: +avg(d2Laps,"sector3").toFixed(3) },
                ];
                return (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="#1a1a2e" strokeDasharray="3 3"/>
                      <XAxis dataKey="sector" tick={{ fill: T.muted, fontSize: 11 }}/>
                      <YAxis tick={{ fill: T.muted, fontSize: 10 }} unit="s" domain={["auto","auto"]}/>
                      <Tooltip content={<DarkTooltip unit="s"/>}/>
                      <Legend wrapperStyle={{ fontSize: 11 }}/>
                      <Bar dataKey={compareD1} fill={d1Color} radius={[3,3,0,0]}/>
                      <Bar dataKey={compareD2} fill={d2Color} radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>

            {/* Tyre strategy */}
            <SectionHeader icon="🛞">Tyre Strategy Comparison</SectionHeader>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[compareD1, compareD2].map((d, idx) => {
                const dC = idx === 0 ? d1Color : d2Color;
                return (
                  <div key={d} style={{ background: T.panel, border: `1px solid ${T.border}`,
                    borderLeft: `4px solid ${dC}`, borderRadius: 8, padding: 16 }}>
                    <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, color: dC, marginBottom: 10 }}>{d}</div>
                    {(stintData[d] || []).map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 12, height: 12, background: COMPOUND_COLORS[s.compound]||T.muted, borderRadius: 2 }}/>
                        <span style={{ color: COMPOUND_COLORS[s.compound]||T.muted, fontWeight: 700, fontSize: 12 }}>{s.compound}</span>
                        <span style={{ color: T.muted, fontSize: 11 }}>Laps {s.lapStart}–{s.lapEnd}</span>
                        <span style={{ color: T.muted, fontSize: 11 }}>({s.lapEnd - s.lapStart + 1} laps)</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 8 }}>
                      <TyreStrategy stintData={stintData} driver={d} totalLaps={totalLaps}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════ TAB: LEADERBOARD ══════════════════════ */}
        {tab === "leaderboard" && (
          <div>
            <SectionHeader icon="🏆">Live Race Leaderboard</SectionHeader>
            <Leaderboard lapData={lapData} drivers={drivers} currentLap={totalLaps}/>

            <SectionHeader icon="📈">All Drivers — Position Changes</SectionHeader>
            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16, marginBottom: 14 }}>
              {(() => {
                const sampleDrivers = drivers.slice(0, 8);
                const allLapNums = Array.from({ length: totalLaps }, (_, i) => i + 1);
                const data = allLapNums.map(lap => {
                  const row = { lap };
                  sampleDrivers.forEach(d => {
                    const l = (lapData[d] || []).find(x => x.lap === lap);
                    if (l) row[d] = l.position;
                  });
                  return row;
                });
                const driverColors = sampleDrivers.map(d => DRIVER_TEAM_COLORS[d] || T.muted);
                return (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="#1a1a2e" strokeDasharray="3 3"/>
                      <XAxis dataKey="lap" tick={{ fill: T.muted, fontSize: 10 }}/>
                      <YAxis reversed domain={[1, drivers.length]} tick={{ fill: T.muted, fontSize: 10 }}/>
                      <Tooltip contentStyle={{ background: T.panel, border: `1px solid ${T.border}`, fontSize: 11 }}/>
                      <Legend wrapperStyle={{ fontSize: 10 }}/>
                      {sampleDrivers.map((d, i) => (
                        <Line key={d} type="stepAfter" dataKey={d} stroke={driverColors[i]}
                          dot={false} strokeWidth={1.5}/>
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>

            {/* AI Insights */}
            <SectionHeader icon="🤖">AI Race Insights</SectionHeader>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
              {(() => {
                const sortedOT = [...allLatest].sort((a,b) => b.overtakeProb - a.overtakeProb);
                const topOT = sortedOT[0];
                const lowOT = sortedOT[sortedOT.length - 1];
                const posLeader = allLatest.sort((a,b) => a.position - b.position)[0];
                const insights = [
                  { icon: "🔥", color: T.red, text: `${topOT?.driver} has the highest overtake probability at ${topOT?.overtakeProb.toFixed(1)}% — watch for an attack soon.` },
                  { icon: "🛞", color: T.green, text: `${lowOT?.driver} has the lowest overtake probability at ${lowOT?.overtakeProb.toFixed(1)}% — likely managing tyres or comfortable in position.` },
                  { icon: "🏁", color: T.gold, text: `Current race leader: ${posLeader?.driver}. They will need ${track.drs_zones} DRS zones to defend against attacks on the ${track.length_km}km circuit.` },
                  { icon: "📊", color: T.cyan, text: `Average overtake probability across the field: ${avgOT}%. Track overtake rating is ${track.overtake_rating}/10 with ${track.corners} corners.` },
                ];
                return insights.map((ins, i) => (
                  <div key={i} style={{
                    background: T.panel, border: `1px solid ${ins.color}44`,
                    borderLeft: `3px solid ${ins.color}`, borderRadius: 8, padding: "12px 14px",
                  }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>{ins.icon}</div>
                    <div style={{ fontSize: 12, color: T.text, lineHeight: 1.5 }}>{ins.text}</div>
                  </div>
                ));
              })()}
            </div>

            {/* Tyre degradation scatter */}
            <SectionHeader icon="🛞">Tyre Degradation Analysis</SectionHeader>
            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16 }}>
              {(() => {
                const data = drivers.flatMap(d =>
                  (lapData[d] || []).map(l => ({
                    tyreLife: l.tyreLife, lapTime: l.lapTime, compound: l.compound, driver: d,
                  }))
                );
                return (
                  <ResponsiveContainer width="100%" height={200}>
                    <ScatterChart margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="#1a1a2e" strokeDasharray="3 3"/>
                      <XAxis dataKey="tyreLife" name="Tyre Life" tick={{ fill: T.muted, fontSize: 10 }} label={{ value: "Tyre Age (Laps)", position: "insideBottom", fill: T.muted, fontSize: 10 }}/>
                      <YAxis dataKey="lapTime" name="Lap Time" tick={{ fill: T.muted, fontSize: 10 }} unit="s" domain={["auto","auto"]}/>
                      <Tooltip cursor={false} contentStyle={{ background: T.panel, border: `1px solid ${T.border}`, fontSize: 11 }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 10px" }}>
                              <p style={{ margin: 0, fontSize: 11, color: COMPOUND_COLORS[d.compound]||T.white }}>{d.compound}</p>
                              <p style={{ margin: 0, fontSize: 11, color: T.muted }}>Tyre Age: {d.tyreLife} laps</p>
                              <p style={{ margin: 0, fontSize: 11, color: T.white }}>{d.lapTime.toFixed(3)}s</p>
                            </div>
                          );
                        }}/>
                      {["SOFT","MEDIUM","HARD"].map(compound => (
                        <Scatter key={compound} name={compound}
                          data={data.filter(d => d.compound === compound)}
                          fill={COMPOUND_COLORS[compound]} opacity={0.6}/>
                      ))}
                      <Legend wrapperStyle={{ fontSize: 11 }}/>
                    </ScatterChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div style={{ textAlign: "center", marginTop: 32, padding: "16px 0",
          borderTop: `1px solid ${T.border}`, color: T.muted, fontSize: 11, letterSpacing: 1 }}>
          🏎️ Formula 1 AI Analytics Dashboard &nbsp;·&nbsp; {year} {race} GP &nbsp;·&nbsp;
          XGBoost Overtake Prediction Engine &nbsp;·&nbsp; Powered by FastF1 Data
        </div>
      </div>
    </div>
  );
}
