import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const GameBoard = dynamic(() => import("../components/GameBoard"), {
  ssr: false,
});

const money = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");

export default function Home() {
  const [state, setState] = useState(null);
  const [mode, setMode] = useState("pvai");
  const [size, setSize] = useState(6);
  const [pieceType, setPieceType] = useState("motor");
  const [busy, setBusy] = useState(false);
  const aiTimer = useRef(null);

  const newGame = useCallback(async () => {
    clearTimeout(aiTimer.current);
    setBusy(false);
    const res = await fetch("/api/game/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ width: size, height: size }),
    });
    const data = await res.json();
    setState(data);
  }, [size]);

  useEffect(() => {
    newGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasValidMove = useCallback((s, player, type) => {
    if (!s) return false;
    const quota = s.quota[player];
    if (quota[type] <= 0) return false;
    const pSize = type === "motor" ? 2 : 3;
    const cells = s.board.cells;
    for (let y = 0; y < s.board.height; y++) {
      for (let x = 0; x < s.board.width; x++) {
        let ok = true;
        if (player === "V") {
          if (y + pSize > s.board.height) continue;
          for (let i = 0; i < pSize; i++) if (cells[y + i][x] != null) ok = false;
        } else {
          if (x + pSize > s.board.width) continue;
          for (let i = 0; i < pSize; i++) if (cells[y][x + i] != null) ok = false;
        }
        if (ok) return true;
      }
    }
    return false;
  }, []);

  const scheduleAI = useCallback(
    (currentState) => {
      if (!currentState || currentState.terminal) return;
      const aiTurn =
        (mode === "pvai" && currentState.turn === "H") || mode === "avav";
      if (!aiTurn) return;

      setBusy(true);
      aiTimer.current = setTimeout(async () => {
        const res = await fetch("/api/game/ai-move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: currentState, depth: size >= 9 ? 3 : 4 }),
        });
        const result = await res.json();
        setState(result.newState);
        setBusy(false);
        if (
          !result.newState.terminal &&
          ((mode === "pvai" && result.newState.turn === "H") || mode === "avav")
        ) {
          scheduleAI(result.newState);
        }
      }, 350);
    },
    [mode, size]
  );

  const onCellClick = useCallback(
    async (x, y) => {
      if (busy || !state || state.terminal) return;
      if (mode === "pvai" && state.turn === "H") return;
      if (!hasValidMove(state, state.turn, pieceType)) return;

      setBusy(true);
      const res = await fetch("/api/game/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, pieceType, x, y }),
      });
      const result = await res.json();
      if (result.error) {
        setBusy(false);
        return;
      }
      setState(result);
      setBusy(false);
      scheduleAI(result);
    },
    [busy, state, mode, pieceType, hasValidMove, scheduleAI]
  );

  useEffect(() => {
    if (state && mode === "avav" && !state.terminal) {
      scheduleAI(state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const turnName = state?.turn === "V" ? "IndoPark (biru)" : "AlfaPark (merah)";
  const statusText = state?.terminal ? "Permainan selesai" : `Giliran ${turnName}`;
  const winnerText = state
    ? state.winner === "TIE"
      ? "Seri!"
      : `${state.winner === "V" ? "IndoPark" : "AlfaPark"} menang!`
    : "";

  return (
    <div className="app">
      <header>
        <h1>
          <span className="brand-blue">Indo</span>
          <span className="brand-red">Park</span>
        </h1>
        <div className="controls">
          <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
            <option value={6}>6 x 6</option>
            <option value={8}>8 x 8</option>
            <option value={10}>10 x 10</option>
          </select>
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="pvai">Player vs Agent</option>
            <option value="pvp">Player vs Player</option>
            <option value="avav">Agent vs Agent</option>
          </select>
          <button
            className={pieceType === "motor" ? "active" : ""}
            onClick={() => setPieceType("motor")}
          >
            Sepeda Motor &middot; Rp2K
          </button>
          <button
            className={pieceType === "mobil" ? "active" : ""}
            onClick={() => setPieceType("mobil")}
          >
            Mobil &middot; Rp3K
          </button>
          <button onClick={newGame}>Game Baru</button>
        </div>
      </header>

      <main>
        <aside className="brand v">
          <div className="brand-name">INDOPARK</div>
          <div className="storefront">STORE</div>
          <div className="stat">
            Tarif
            <strong>{money(state?.tarif?.V)}</strong>
          </div>
          <div className="stat">
            Motor / Mobil
            <strong>
              {state ? `${state.quota.V.motor} / ${state.quota.V.mobil}` : "- / -"}
            </strong>
          </div>
        </aside>

        <section className="board-wrap">
          {state && <GameBoard state={state} onCellClick={onCellClick} />}
          <div id="status">{statusText}</div>
          {state?.terminal && (
            <div id="gameOver">
              <div>
                <h2>{winnerText}</h2>
                <button onClick={newGame}>Main Lagi</button>
              </div>
            </div>
          )}
        </section>

        <aside className="brand h">
          <div className="brand-name">ALFAPARK</div>
          <div className="storefront">STORE</div>
          <div className="stat">
            Tarif
            <strong>{money(state?.tarif?.H)}</strong>
          </div>
          <div className="stat">
            Motor / Mobil
            <strong>
              {state ? `${state.quota.H.motor} / ${state.quota.H.mobil}` : "- / -"}
            </strong>
          </div>
        </aside>
      </main>

      <p className="asset-note">
        Sprite kendaraan &amp; paving di atas masih placeholder prosedural -
        ganti dengan hasil export Aseprite final sesuai referensi di{" "}
        <code>/public/assets/vehicles.png</code> dan{" "}
        <code>/public/assets/paving.png</code>.
      </p>
    </div>
  );
}
