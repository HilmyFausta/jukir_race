// Logika game murni di sisi client (validasi, deteksi menang/kalah, fallback).
// AI (minimax + alpha-beta) tetap dijalankan di backend Python.

export const SIDES = [
  { key: "indoapril", name: "Indoapril", color: "blue", hex: "#3b6df0" },
  { key: "betamart", name: "Betamart", color: "red", hex: "#e2403b" },
];

export const SHAPES = [
  { type: "motor", o: "v", h: 2, w: 1, label: "Motor" },
  { type: "motor", o: "h", h: 1, w: 2, label: "Motor" },
  { type: "mobil", o: "v", h: 3, w: 1, label: "Mobil" },
  { type: "mobil", o: "h", h: 1, w: 3, label: "Mobil" },
];

export const LEVELS = {
  mudah: { label: "Mudah", depth: 2, time: 1.0 },
  sedang: { label: "Sedang", depth: 4, time: 2.5 },
  sulit: { label: "Sulit", depth: 10, time: 4.0 },
};

export const shapeOf = (type, o) => SHAPES.find((s) => s.type === type && s.o === o);

export const spriteUrl = (type, color, o) => `/assets/sprites/${type}_${color}_${o}.png`;

export function pieceKind(p) {
  return { type: p.h * p.w === 2 ? "motor" : "mobil", o: p.h > p.w ? "v" : "h" };
}

export function occupancy(state) {
  const { n } = state;
  const occ = Array.from({ length: n }, () => Array(n).fill(false));
  state.obstacles.forEach((i) => {
    occ[Math.floor(i / n)][i % n] = true;
  });
  state.pieces.forEach((p) => {
    for (let i = 0; i < p.h; i++) for (let j = 0; j < p.w; j++) occ[p.r + i][p.c + j] = true;
  });
  return occ;
}

export function canPlace(occ, n, r, c, h, w) {
  if (r < 0 || c < 0 || r + h > n || c + w > n) return false;
  for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) if (occ[r + i][c + j]) return false;
  return true;
}

export function allMoves(state) {
  const occ = occupancy(state);
  const out = [];
  for (const s of SHAPES)
    for (let r = 0; r <= state.n - s.h; r++)
      for (let c = 0; c <= state.n - s.w; c++)
        if (canPlace(occ, state.n, r, c, s.h, s.w)) out.push({ r, c, h: s.h, w: s.w });
  return out;
}

// Titik sentuh -> pojok kiri-atas bidak (bidak "berpusat" di petak yang disentuh, dijepit ke papan)
export function anchor(cell, shape, n) {
  if (!cell) return null;
  let r = cell.r - Math.floor((shape.h - 1) / 2);
  let c = cell.c - Math.floor((shape.w - 1) / 2);
  r = Math.max(0, Math.min(n - shape.h, r));
  c = Math.max(0, Math.min(n - shape.w, c));
  return { r, c, h: shape.h, w: shape.w };
}

// Terapkan langkah; kalau lawan tidak punya langkah lagi -> game selesai, penaruh menang.
export function applyMove(state, move) {
  const mover = state.turn;
  const next = {
    ...state,
    pieces: [...state.pieces, { r: move.r, c: move.c, h: move.h, w: move.w, p: mover }],
    turn: 1 - mover,
  };
  if (allMoves(next).length === 0) {
    next.over = true;
    next.winner = mover;
  }
  return next;
}

// Fallback kalau backend tidak bisa dihubungi: langkah acak (condong bidak besar).
export function randomMove(state) {
  const moves = allMoves(state);
  if (!moves.length) return null;
  const big = moves.filter((m) => m.h * m.w === 3);
  const pool = big.length && Math.random() < 0.6 ? big : moves;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function localObstacles(n) {
  const k = 1 + Math.floor(Math.random() * n);
  for (let guard = 0; guard < 200; guard++) {
    const s = new Set();
    while (s.size < k) s.add(Math.floor(Math.random() * n * n));
    const st = { n, obstacles: [...s], pieces: [] };
    if (allMoves(st).length) return st.obstacles.sort((a, b) => a - b);
  }
  return [0];
}
