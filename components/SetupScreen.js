import { useState } from "react";
import { LEVELS, SIDES } from "../lib/game";

const MODES = [
  { key: "avai", title: "AI vs AI", sub: "Tonton dua AI beradu" },
  { key: "pvai", title: "Player vs AI", sub: "Lawan AI minimax" },
  { key: "pvp", title: "Player vs Player", sub: "Berdua, 1 device" },
];

export default function SetupScreen({ initial, onStart, onBack }) {
  const [mode, setMode] = useState(initial?.mode || "pvai");
  const [n, setN] = useState(initial?.n || 6);
  const [humanSide, setHumanSide] = useState(initial?.humanSide ?? 0);
  const [level, setLevel] = useState(initial?.level || "sedang");

  const hasAI = mode !== "pvp";

  return (
    <div className="setup-screen">
      <div className="setup-glow blue" />
      <div className="setup-glow red" />

      <div className="px-box setup-card">
        <h2 className="setup-title">PILIH MODE</h2>
        <div className="mode-grid">
          {MODES.map((m) => (
            <button key={m.key} className={`px-btn mode-btn ${mode === m.key ? "on" : ""}`} onClick={() => setMode(m.key)}>
              <strong>{m.title}</strong>
              <small>{m.sub}</small>
            </button>
          ))}
        </div>

        <h2 className="setup-title">UKURAN ARENA</h2>
        <div className="size-row">
          <button className="px-btn sq" onClick={() => setN(Math.max(3, n - 1))} aria-label="kurangi">
            -
          </button>
          <div className="size-label">
            {n} x {n}
          </div>
          <button className="px-btn sq" onClick={() => setN(Math.min(8, n + 1))} aria-label="tambah">
            +
          </button>
        </div>
        <div className="mini-grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
          {Array.from({ length: n * n }).map((_, i) => (
            <span key={i} />
          ))}
        </div>

        {mode === "pvai" && (
          <>
            <h2 className="setup-title">KAMU MAIN SEBAGAI</h2>
            <div className="side-grid">
              {SIDES.map((s, i) => (
                <button key={s.key} className={`px-btn side-btn ${s.color} ${humanSide === i ? "on" : ""}`} onClick={() => setHumanSide(i)}>
                  <img src={`/assets/char/${s.key}_put.png`} alt="" />
                  <span>
                    {s.name.toUpperCase()}
                    <small>{i === 0 ? "biru - jalan duluan" : "merah - jalan kedua"}</small>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {hasAI && (
          <>
            <h2 className="setup-title">LEVEL AI</h2>
            <div className="level-grid">
              {Object.entries(LEVELS).map(([k, v]) => (
                <button key={k} className={`px-btn ${level === k ? "on" : ""}`} onClick={() => setLevel(k)}>
                  {v.label}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="setup-actions">
          <button className="px-btn" onClick={onBack}>
            KEMBALI
          </button>
          <button className="px-btn primary" onClick={() => onStart({ mode, n, humanSide, level })}>
            MULAI
          </button>
        </div>
      </div>
    </div>
  );
}
