import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  LEVELS,
  SHAPES,
  SIDES,
  anchor,
  applyMove,
  canPlace,
  localObstacles,
  occupancy,
  randomMove,
  shapeOf,
  spriteUrl,
} from "../lib/game";

const Board = dynamic(() => import("./Board"), { ssr: false });

const fmt = (v) => Number(v || 0).toLocaleString("id-ID");

function PlayerCard({ side, idx, active, role, count, over }) {
  const s = SIDES[idx];
  return (
    <div className={`px-box player-card ${s.color} ${active && !over ? "active" : ""}`}>
      <div className="pc-role">{role}</div>
      <img className="pc-img" src={`/assets/char/${s.key}${active && !over ? "" : "_put"}${active && !over ? ".gif" : ".png"}`} alt={s.name} />
      <div className="pc-name">{s.name.toUpperCase()}</div>
      <div className="pc-count">Kendaraan: {count}</div>
      <div className="pc-turn">{active && !over ? "GILIRAN" : "\u00a0"}</div>
    </div>
  );
}

export default function GameScreen({ config, onExit }) {
  const { mode, n, humanSide, level } = config;
  const [game, setGame] = useState(null);
  const [gid, setGid] = useState(0);
  const [sel, setSel] = useState({ type: "motor", o: "h" });
  const [hoverCell, setHoverCell] = useState(null);
  const [aiInfo, setAiInfo] = useState(null);
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState("");
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const newGame = useCallback(async () => {
    setGame(null);
    setHoverCell(null);
    setAiInfo(null);
    setNotice("");
    let obstacles;
    try {
      const res = await fetch("/api/game/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n }),
      });
      if (!res.ok) throw new Error("bad status");
      obstacles = (await res.json()).obstacles;
    } catch (e) {
      obstacles = localObstacles(n);
      setNotice("Backend tidak terjangkau, rintangan dibuat lokal.");
    }
    setGame({ n, obstacles, pieces: [], turn: 0, over: false, winner: null });
    setGid((g) => g + 1);
  }, [n]);

  useEffect(() => {
    newGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isHumanTurn = !!game && !game.over && (mode === "pvp" || (mode === "pvai" && game.turn === humanSide));
  const aiTurn = !!game && !game.over && !isHumanTurn;
  const thinking = aiTurn && !paused;

  // ---- giliran AI ----
  useEffect(() => {
    if (!game || game.over || isHumanTurn || paused) return;
    let cancelled = false;
    const lv = LEVELS[level] || LEVELS.sedang;
    const timer = setTimeout(async () => {
      let move = null;
      try {
        const res = await fetch("/api/game/ai-move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            state: { n: game.n, obstacles: game.obstacles, pieces: game.pieces, turn: game.turn },
            depth: lv.depth,
            time_limit: lv.time,
          }),
        });
        if (!res.ok) throw new Error("bad status");
        const data = await res.json();
        if (cancelled) return;
        move = data.move;
        setAiInfo(data.info);
        setNotice("");
      } catch (e) {
        if (cancelled) return;
        move = randomMove(game);
        setAiInfo(null);
        setNotice("AI backend gagal, memakai langkah acak sementara.");
      }
      if (move) setGame((g) => (g && !cancelled ? applyMove(g, move) : g));
    }, mode === "avai" ? 700 : 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid, game?.pieces.length, game?.over, isHumanTurn, paused]);

  // ---- input manusia ----
  const shape = shapeOf(sel.type, sel.o);
  const occ = useMemo(() => (game ? occupancy(game) : null), [game]);

  const candidate = useMemo(() => {
    if (!game || !isHumanTurn || !hoverCell) return null;
    const a = anchor(hoverCell, shape, game.n);
    return { ...a, valid: canPlace(occ, game.n, a.r, a.c, a.h, a.w) };
  }, [game, isHumanTurn, hoverCell, shape, occ]);

  const place = useCallback(
    (m) => {
      if (!m || !m.valid) return;
      setGame((g) => applyMove(g, { r: m.r, c: m.c, h: m.h, w: m.w }));
      setHoverCell(null);
    },
    [setGame]
  );

  const onHover = useCallback((cell) => setHoverCell(cell), []);
  const onTap = useCallback(
    (cell, kind) => {
      if (!isHumanTurn || !game) return;
      if (kind === "mouse") {
        const a = anchor(cell, shape, game.n);
        place({ ...a, valid: canPlace(occ, game.n, a.r, a.c, a.h, a.w) });
        return;
      }
      // sentuh: tap pertama = taruh bayangan, tap di dalam bayangan (valid) = konfirmasi
      if (candidate && candidate.valid && cell.r >= candidate.r && cell.r < candidate.r + candidate.h && cell.c >= candidate.c && cell.c < candidate.c + candidate.w) {
        place(candidate);
      } else {
        setHoverCell(cell);
      }
    },
    [isHumanTurn, game, shape, occ, candidate, place]
  );

  // pintasan keyboard: R = putar orientasi, 1 = motor, 2 = mobil
  useEffect(() => {
    const h = (e) => {
      if (e.key === "r" || e.key === "R") setSel((s) => ({ ...s, o: s.o === "h" ? "v" : "h" }));
      if (e.key === "1") setSel((s) => ({ ...s, type: "motor" }));
      if (e.key === "2") setSel((s) => ({ ...s, type: "mobil" }));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  if (!game) return <div className="loading">Menyiapkan arena...</div>;

  const turnSide = SIDES[game.turn];
  const counts = [0, 1].map((i) => game.pieces.filter((p) => p.p === i).length);
  const roleOf = (i) => (mode === "pvp" ? `PLAYER ${i + 1}` : mode === "avai" ? "AI" : i === humanSide ? "KAMU" : "AI");

  let status;
  if (game.over) status = `${SIDES[1 - game.winner].name} tidak bisa menaruh kendaraan lagi`;
  else if (paused && aiTurn) status = "Dijeda";
  else if (aiTurn) status = `${turnSide.name} (AI) berpikir...`;
  else status = `Giliran ${turnSide.name} - pilih kendaraan lalu taruh`;

  const info = aiInfo;
  const showConfirm = coarse && isHumanTurn && candidate && candidate.valid;

  return (
    <div className="game-screen">
      <div className="game-top">
        <button className="px-btn small" onClick={onExit}>
          MENU
        </button>
        <div className="game-title">
          {mode === "avai" ? "AI vs AI" : mode === "pvai" ? "Player vs AI" : "Player vs Player"} &middot; {n}x{n}
        </div>
        <button className="px-btn small" onClick={newGame}>
          RESET
        </button>
      </div>

      <div className="game-layout">
        <PlayerCard side={SIDES[0]} idx={0} active={game.turn === 0} role={roleOf(0)} count={counts[0]} over={game.over} />

        <div className="game-center">
          <div className={`status-bar ${turnSide.color}`}>{status}</div>
          <div className="board-frame">
            <Board state={game} preview={candidate} onHover={onHover} onTap={onTap} />
            {game.over && (
              <div className="win-overlay">
                <div className={`px-box win-card ${SIDES[game.winner].color}`}>
                  <img src={`/assets/char/${SIDES[game.winner].key}.gif`} alt="" />
                  <h2>{SIDES[game.winner].name.toUpperCase()} MENANG!</h2>
                  <p>{SIDES[1 - game.winner].name} tidak bisa menaruh kendaraan lagi.</p>
                  <div className="win-actions">
                    <button className="px-btn" onClick={onExit}>
                      MENU
                    </button>
                    <button className="px-btn primary" onClick={newGame}>
                      MAIN LAGI
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="palette">
            {SHAPES.map((s) => {
              const on = s.type === sel.type && s.o === sel.o;
              return (
                <button
                  key={`${s.type}${s.o}`}
                  className={`px-btn pal-btn ${on ? "on" : ""}`}
                  disabled={!isHumanTurn}
                  onClick={() => setSel({ type: s.type, o: s.o })}
                  title={`${s.label} ${s.h}x${s.w}`}
                >
                  <img src={spriteUrl(s.type, turnSide.color, s.o)} alt={s.label} style={{ width: s.w * 28, height: s.h * 28 }} />
                  <small>
                    {s.label} {s.h}x{s.w}
                  </small>
                </button>
              );
            })}
          </div>

          <div className="hint-row">
            {showConfirm ? (
              <button className="px-btn primary" onClick={() => place(candidate)}>
                TARUH DI SINI
              </button>
            ) : (
              <span className="hint">
                {isHumanTurn
                  ? coarse
                    ? "Tap petak untuk melihat bayangan, tap lagi / tombol TARUH untuk konfirmasi"
                    : "Arahkan kursor ke papan, klik untuk menaruh. Tekan R untuk memutar."
                  : "\u00a0"}
              </span>
            )}
          </div>

          {mode === "avai" && !game.over && (
            <button className="px-btn small" onClick={() => setPaused((p) => !p)}>
              {paused ? "LANJUT" : "JEDA"}
            </button>
          )}

          {info && (
            <div className="ai-info">
              <strong>{info.strategy === "mirror" ? "Strategi cermin" : "Minimax + Alpha-Beta"}</strong>
              {info.strategy !== "mirror" && (
                <span>
                  kedalaman {info.depth} &middot; {fmt(info.nodes)} node &middot; {fmt(info.cuts)} pemangkasan &middot; {info.ms} ms &middot; {info.result}
                </span>
              )}
            </div>
          )}
          {notice && <div className="notice">{notice}</div>}
        </div>

        <PlayerCard side={SIDES[1]} idx={1} active={game.turn === 1} role={roleOf(1)} count={counts[1]} over={game.over} />
      </div>
    </div>
  );
}
