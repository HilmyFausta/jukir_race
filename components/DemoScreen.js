import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { applyMove } from "../lib/game";

const Board = dynamic(() => import("./Board"), { ssr: false });

const ENGINES = [
  { key: "alphabeta", label: "MINIMAX + ALPHA-BETA", color: "blue" },
  { key: "minimax", label: "MINIMAX MURNI", color: "red" },
];

const emptyGame = (n, obstacles) => ({ n, obstacles, pieces: [], turn: 0, over: false, winner: null });

function DemoCard({ engine, state, info, total, thinking }) {
  const meta = ENGINES.find((item) => item.key === engine);
  return (
    <article className={`demo-card ${meta.color}`}>
      <div className="demo-card-title">{meta.label}</div>
      <div className="demo-status">
        {state.over ? `${state.winner === 0 ? "APRIL" : "BETH"} MENANG` : thinking ? "BERPIKIR..." : `Giliran ${state.turn === 0 ? "April" : "Beth"}`}
      </div>
      <div className="demo-board">
        <Board state={state} preview={null} onHover={() => {}} onTap={() => {}} />
      </div>
      <div className="demo-info">
        <span>Langkah: {state.pieces.length}</span>
        <span>Node: {info ? info.nodes.toLocaleString("id-ID") : "-"}</span>
        <span>Pruning: {info ? info.cuts.toLocaleString("id-ID") : "-"}</span>
        <span>Waktu: {info ? `${info.ms} ms` : "-"}</span>
        <span className="demo-total">Total: {total.toLocaleString("id-ID")} ms</span>
      </div>
    </article>
  );
}

export default function DemoScreen({ config, onExit }) {
  const { n } = config;
  const [games, setGames] = useState([null, null]);
  const [infos, setInfos] = useState([null, null]);
  const [totals, setTotals] = useState([0, 0]);
  const [thinking, setThinking] = useState([false, false]);
  const [notice, setNotice] = useState("");
  const [run, setRun] = useState(0);
  const [depth, setDepth] = useState(2);
  const [paused, setPaused] = useState(false);
  const inFlight = useRef(false);
  const generation = useRef(0);

  const newDemo = useCallback(async () => {
    generation.current += 1;
    inFlight.current = false;
    setGames([null, null]);
    setInfos([null, null]);
    setTotals([0, 0]);
    setThinking([false, false]);
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
    if (!games[0] || !games[1] || games.every((game) => game.over) || paused || inFlight.current) return undefined;
    const currentGeneration = generation.current;
    inFlight.current = true;
    const timer = setTimeout(async () => {
      setThinking(games.map((game) => !game.over));
      try {
        const tasks = games.map(async (game, index) => {
          if (game.over) return { index, result: null, error: null };
          try {
            const response = await fetch("/api/game/ai-move", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                state: { n: game.n, obstacles: game.obstacles, pieces: game.pieces, turn: game.turn },
                depth,
                engine: ENGINES[index].key,
                unlimited: true,
              }),
            });
            if (!response.ok) throw new Error(`${ENGINES[index].label} gagal menghitung langkah.`);
            return { index, result: await response.json(), error: null };
          } catch (error) {
            return { index, result: null, error };
          }
        });

        await Promise.all(tasks.map(async (task) => {
          const { index, result, error } = await task;
          if (currentGeneration !== generation.current) return;
          if (error) {
            setNotice(error.message);
            return;
          }
          if (!result) return;
          setInfos((current) => current.map((info, infoIndex) => infoIndex === index ? result.info : info));
          setTotals((current) => current.map((total, totalIndex) => totalIndex === index ? total + result.info.ms : total));
          setGames((current) => current.map((game, gameIndex) => gameIndex === index ? applyMove(game, result.move) : game));
        }));
      } catch (error) {
        if (currentGeneration === generation.current) setNotice(error.message);
      } finally {
        if (currentGeneration === generation.current) {
          inFlight.current = false;
          setThinking([false, false]);
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [games, depth, paused, run, thinking]);

  return (
    <div className="game-screen demo-screen">
      <div className="game-top">
        <button className="px-btn small" onClick={onExit}>MENU</button>
        <div className="game-title">MODE DEMO · {n}x{n} · DEPTH {depth}</div>
        <button className="px-btn small" onClick={newDemo}>RESET</button>
      </div>
      <div className="demo-heading px-box">
        <h1>PERBANDINGAN ENGINE</h1>
        <p>Dua papan memakai obstacle dan posisi awal yang identik. Setiap papan bergerak segera setelah engine-nya selesai menghitung.</p>
        <div className="demo-controls">
          <label>
            DEPTH
            <select value={depth} onChange={(event) => setDepth(Number(event.target.value))} disabled={thinking.some(Boolean)}>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </label>
          <button className="px-btn small" onClick={() => setPaused((value) => !value)}>
            {paused ? "LANJUT" : "JEDA"}
          </button>
        </div>
      </div>
      {notice && <div className="notice">{notice}</div>}
      <div className="demo-grid">
        {games.map((game, index) => game && (
          <DemoCard
            key={ENGINES[index].key}
            engine={ENGINES[index].key}
            state={game}
            info={infos[index]}
            total={totals[index]}
            thinking={thinking[index]}
          />
        ))}
      </div>
      {!games[0] && <div className="loading">Menyiapkan dua arena demo...</div>}
    </div>
  );
}
