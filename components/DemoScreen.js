import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { LEVELS, applyMove } from "../lib/game";

const Board = dynamic(() => import("./Board"), { ssr: false });

const ENGINES = [
  { key: "alphabeta", label: "MINIMAX + ALPHA-BETA", color: "blue" },
  { key: "minimax", label: "MINIMAX MURNI", color: "red" },
];

const emptyGame = (n, obstacles) => ({ n, obstacles, pieces: [], turn: 0, over: false, winner: null });

function DemoCard({ engine, state, info, thinking }) {
  const meta = ENGINES.find((item) => item.key === engine);
  return (
    <article className={`demo-card ${meta.color}`}>
      <div className="demo-card-title">{meta.label}</div>
      <div className="demo-status">
        {state.over ? `${state.winner === 0 ? "INDOAPRIL" : "BETAMART"} MENANG` : thinking ? "BERPIKIR..." : `Giliran ${state.turn === 0 ? "Indoapril" : "Betamart"}`}
      </div>
      <div className="demo-board">
        <Board state={state} preview={null} onHover={() => {}} onTap={() => {}} />
      </div>
      <div className="demo-info">
        <span>Langkah: {state.pieces.length}</span>
        <span>Node: {info ? info.nodes.toLocaleString("id-ID") : "-"}</span>
        <span>Pruning: {info ? info.cuts.toLocaleString("id-ID") : "-"}</span>
        <span>Waktu: {info ? `${info.ms} ms` : "-"}</span>
      </div>
    </article>
  );
}

export default function DemoScreen({ config, onExit }) {
  const { n, level } = config;
  const [games, setGames] = useState([null, null]);
  const [infos, setInfos] = useState([null, null]);
  const [thinking, setThinking] = useState([false, false]);
  const [notice, setNotice] = useState("");
  const [run, setRun] = useState(0);

  const newDemo = useCallback(async () => {
    setGames([null, null]);
    setInfos([null, null]);
    setNotice("");
    try {
      const response = await fetch("/api/game/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n }),
      });
      if (!response.ok) throw new Error("Backend tidak dapat membuat arena demo.");
      const data = await response.json();
      setGames([emptyGame(n, data.obstacles), emptyGame(n, data.obstacles)]);
      setRun((value) => value + 1);
    } catch (error) {
      setNotice(error.message);
    }
  }, [n]);

  useEffect(() => {
    newDemo();
  }, [newDemo]);

  useEffect(() => {
    if (!games[0] || !games[1] || games.every((game) => game.over)) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const levelConfig = LEVELS[level] || LEVELS.sedang;
      const active = games.map((game) => !game.over);
      setThinking(active);
      try {
        const results = await Promise.all(games.map(async (game, index) => {
          if (game.over) return null;
          const response = await fetch("/api/game/ai-move", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              state: { n: game.n, obstacles: game.obstacles, pieces: game.pieces, turn: game.turn },
              depth: levelConfig.depth,
              time_limit: levelConfig.time,
              engine: ENGINES[index].key,
            }),
          });
          if (!response.ok) throw new Error(`${ENGINES[index].label} gagal menghitung langkah.`);
          return response.json();
        }));
        if (cancelled) return;
        setInfos((current) => current.map((info, index) => results[index]?.info || info));
        setGames((current) => current.map((game, index) => results[index] ? applyMove(game, results[index].move) : game));
      } catch (error) {
        if (!cancelled) setNotice(error.message);
      } finally {
        if (!cancelled) setThinking([false, false]);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [games, level, run]);

  return (
    <div className="game-screen demo-screen">
      <div className="game-top">
        <button className="px-btn small" onClick={onExit}>MENU</button>
        <div className="game-title">MODE DEMO · {n}x{n}</div>
        <button className="px-btn small" onClick={newDemo}>RESET</button>
      </div>
      <div className="demo-heading px-box">
        <h1>PERBANDINGAN ENGINE</h1>
        <p>Dua papan memakai obstacle dan posisi awal yang identik. Keduanya berjalan sendiri agar jumlah node dan waktu dapat dibandingkan.</p>
      </div>
      {notice && <div className="notice">{notice}</div>}
      <div className="demo-grid">
        {games.map((game, index) => game && (
          <DemoCard key={ENGINES[index].key} engine={ENGINES[index].key} state={game} info={infos[index]} thinking={thinking[index]} />
        ))}
      </div>
      {!games[0] && <div className="loading">Menyiapkan dua arena demo...</div>}
    </div>
  );
}
