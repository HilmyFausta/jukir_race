import { useEffect, useMemo, useState } from "react";

const valueLabel = (value) => {
  if (value === null || value === undefined) return "…";
  if (value >= 1000) return "W";
  if (value <= -1000) return "K";
  return String(value);
};

const boundLabel = (value) => {
  if (value === null || value === undefined) return "−∞/∞";
  return String(value);
};

const moveLabel = (move) => (move ? `${move.h}×${move.w} · ${move.r + 1},${move.c + 1}` : "akar");

function TreeSvg({ root, step }) {
  const layout = useMemo(() => {
    let leaf = 0;
    const positions = new Map();
    const place = (node) => {
      if (!node.children.length) {
        positions.set(node.id, { x: leaf++ * 118 + 60, y: node.depth * 92 + 45 });
        return positions.get(node.id).x;
      }
      const xs = node.children.map(place);
      const x = (xs[0] + xs[xs.length - 1]) / 2;
      positions.set(node.id, { x, y: node.depth * 92 + 45 });
      return x;
    };
    place(root);
    return { positions, width: Math.max(720, leaf * 118 + 60), height: (root.depth + 1) * 92 + 65 };
  }, [root]);

  const edges = [];
  const nodes = [];
  const walk = (node) => {
    const position = layout.positions.get(node.id);
    if (!position || node.open > step) return;
    node.children.forEach((child) => {
      const childPosition = layout.positions.get(child.id);
      if (childPosition && child.open <= step) {
        edges.push(
          <line
            key={`${node.id}-${child.id}`}
            x1={position.x}
            y1={position.y}
            x2={childPosition.x}
            y2={childPosition.y}
            className={child.cut ? "tree-edge cut" : "tree-edge"}
          />
        );
      }
      walk(child);
    });

    const closed = node.close !== null && node.close <= step;
    const isMax = node.type === "max";
    nodes.push(
      <g key={node.id} className="tree-node">
        <title>
          {moveLabel(node.move)} | {isMax ? "MAX" : "MIN"} | α={boundLabel(node.alpha)} β={boundLabel(node.beta)}
          {closed ? ` | nilai ${valueLabel(node.value)}` : ""}
        </title>
        {isMax ? (
          <circle cx={position.x} cy={position.y} r="19" className={`tree-shape max ${node.cut ? "cut" : ""}`} />
        ) : (
          <rect x={position.x - 19} y={position.y - 19} width="38" height="38" rx="4" className={`tree-shape min ${node.cut ? "cut" : ""}`} />
        )}
        <text x={position.x} y={position.y + 1} className="tree-value">
          {closed ? valueLabel(node.value) : "…"}
        </text>
        {node.move && (
          <text x={position.x} y={position.y - 28} className="tree-move">
            {moveLabel(node.move)}
          </text>
        )}
        {node.cut && closed && <text className="tree-cut" x={position.x} y={position.y + 38}>✂{node.skipped}</text>}
        {node.hidden > 0 && closed && <text className="tree-hidden" x={position.x} y={position.y + 51}>…{node.hidden}</text>}
      </g>
    );
  };
  walk(root);

  return (
    <div className="tree-canvas">
      <svg className="tree-svg" viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label="Pohon pencarian AI">
        {edges}
        {nodes}
      </svg>
    </div>
  );
}

export default function TreeVisualizer({ state, engine }) {
  const [depth, setDepth] = useState(3);
  const [width, setWidth] = useState(4);
  const [data, setData] = useState(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null);
    setStep(0);
    setPlaying(false);
  }, [state, engine]);

  useEffect(() => {
    if (!playing || !data) return undefined;
    if (step >= data.events) {
      setPlaying(false);
      return undefined;
    }
    const timer = setTimeout(() => setStep((current) => current + 1), 120);
    return () => clearTimeout(timer);
  }, [playing, step, data]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setBusy(true);
      setError("");
      try {
        const response = await fetch("/api/game/visualize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state, depth, width, engine }),
        });
        if (!response.ok) throw new Error("Gagal memperbarui visualisasi.");
        const result = await response.json();
        if (cancelled) return;
        setData(result);
        setStep(0);
        setPlaying(true);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [state, depth, width, engine]);

  const resetPlayback = () => {
    if (!data) return;
    setStep(0);
    setPlaying(true);
  };

  return (
    <section className="tree-panel px-box">
      <div className="tree-heading">
        <div>
          <h2>VISUALISASI SEARCH TREE</h2>
          <p>Engine: {engine === "minimax" ? "Minimax murni" : "Minimax + Alpha-Beta"}</p>
        </div>
        <span className="tree-badge">EDUKASI</span>
      </div>

      <div className="tree-controls">
        <label>
          DEPTH
          <select value={depth} onChange={(e) => setDepth(Number(e.target.value))} disabled={busy}>
            {[2, 3, 4].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>
          CABANG DITAMPILKAN
          <select value={width} onChange={(e) => setWidth(Number(e.target.value))} disabled={busy}>
            {[3, 4, 5, 6].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        {data && (
          <button className="px-btn small" onClick={() => {
            if (playing) setPlaying(false);
            else if (step >= data.events) resetPlayback();
            else setPlaying(true);
          }}>
            {playing ? "JEDA" : "PUTAR LAGI"}
          </button>
        )}
        {busy && <span className="tree-loading">MEMPERBARUI...</span>}
      </div>

      {data && (
        <>
          <input className="tree-slider" type="range" min="0" max={data.events} value={step} onChange={(e) => {
            setPlaying(false);
            setStep(Number(e.target.value));
          }} aria-label="Langkah visualisasi tree" />
          <div className="tree-stats">
            {data.nodes.toLocaleString("id-ID")} node · {data.cuts.toLocaleString("id-ID")} pruning · {data.ms} ms
            {data.truncated ? " · tree dipotong karena batas node" : ""}
          </div>
          <TreeSvg root={data.root} step={step} />
          <div className="tree-legend">
            <span><i className="legend-dot max" /> MAX</span>
            <span><i className="legend-square min" /> MIN</span>
            <span><i className="legend-cut" /> PRUNING</span>
            <span>✂n = cabang dipangkas</span>
            <span>…n = cabang tidak digambar</span>
          </div>
        </>
      )}
      {!data && <p className="tree-empty">Visualisasi pencarian sedang disiapkan...</p>}
      {error && <p className="notice">{error}</p>}
    </section>
  );
}
