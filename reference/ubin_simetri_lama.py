#!/usr/bin/env python3
"""
Ubin Simetri - Minimax Alpha-Beta, versi ASLI (sebelum sistem poin), Python / terminal.

Aturan:
  * Papan N x N dimulai dengan rintangan 1x1 acak (1 .. N-2 buah).
  * Pemain bergantian menaruh bidak 1x2, 2x1, 1x3, atau 3x1 tanpa tumpang tindih.
  * Pemain yang tidak bisa menaruh bidak KALAH (normal play).

AI: negamax + alpha-beta + tabel transposisi + iterative deepening,
ditambah jalan pintas strategi cermin 180 derajat bila berlaku.

Nilai simpul (dari sudut pandang pemain yang jalan):
  tidak ada langkah  -> -1000 - d   (kalah; makin dangkal makin buruk)
  d == 0             -> 0           (belum diketahui)
  selain itu         -> max( -nilai(anak) )
Nilai |v| >= 1000 berarti menang / kalah sudah pasti.

Contoh:
  python ubin_simetri_lama.py                        # Anda (P1) lawan AI, papan 5x5
  python ubin_simetri_lama.py --mode aivai --n 6     # AI lawan AI
  python ubin_simetri_lama.py --no-mirror            # matikan strategi cermin
  python ubin_simetri_lama.py --sym                  # rintangan awal simetris

Cara memasukkan langkah:  <tinggi>x<lebar> <baris> <kolom>   (baris/kolom mulai dari 1)
  contoh:  1x3 2 1.  Perintah lain: "?" daftar langkah sah, "q" keluar.
"""
import argparse
import random
import re
import sys
import time
from collections import namedtuple

PIECES = [(1, 2), (2, 1), (1, 3), (3, 1)]
Piece = namedtuple("Piece", "r c h w mask area")


class BudgetExceeded(Exception):
    pass


class Game:
    def __init__(self, n, sym_obstacles=False, rng=None, budget=600_000):
        self.n = n
        self.rng = rng or random.Random()
        self.budget = budget
        self.all = self._build_pieces()
        self.lookup = {(p.h, p.w, p.r, p.c): p for p in self.all}
        # pasangan cermin: bayangan hasil rotasi 180 derajat
        self.mirror = {p: self.lookup[(p.h, p.w, n - p.r - p.h, n - p.c - p.w)] for p in self.all}
        self.center = (1 << (((n - 1) // 2) * n + (n - 1) // 2)) if n % 2 else 0
        self.nodes = 0
        self.cuts = 0
        self.tt = {}
        self.obstacles = []
        self.mask = 0
        self.turn = 0
        self.last = None
        self.history = []          # (pemain, Piece)
        self._gen_obstacles(sym_obstacles)

    # ------------------------------------------------------------------ papan
    def _build_pieces(self):
        n, out = self.n, []
        for h, w in PIECES:
            for r in range(n - h + 1):
                for c in range(n - w + 1):
                    m = 0
                    for i in range(h):
                        for j in range(w):
                            m |= 1 << ((r + i) * n + c + j)
                    out.append(Piece(r, c, h, w, m, h * w))
        out.sort(key=lambda p: -p.area)   # bidak besar dulu (pemangkasan lebih baik)
        return out

    def rot(self, m):
        """Rotasi 180 derajat: bit i -> bit (N*N-1-i)."""
        t = self.n * self.n
        return int(format(m, f"0{t}b")[::-1], 2)

    def legal(self, mask):
        return [p for p in self.all if not (p.mask & mask)]

    def _gen_obstacles(self, sym):
        n = self.n
        total = n * n
        while True:
            k = self.rng.randint(1, max(1, n - 2))
            if sym and n % 2 == 0:
                k = 2 * ((k + 1) // 2)
            cells, guard = set(), 0
            while len(cells) < k and guard < 500:
                guard += 1
                i = self.rng.randrange(total)
                add = {i, total - 1 - i} if sym else {i}
                add -= cells
                if len(cells) + len(add) <= k:
                    cells |= add
            mask = 0
            for i in cells:
                mask |= 1 << i
            if self.legal(mask):
                self.obstacles = sorted(cells)
                self.mask = mask
                return

    def start_info(self):
        sym_ok = self.rot(self.mask) == self.mask and (self.n % 2 == 0 or (self.mask & self.center) != 0)
        if sym_ok:
            return "Posisi awal simetris dan titik pusat aman, jadi Pemain 2 menang dengan strategi cermin 180 derajat."
        return "Posisi awal tidak simetris, hasilnya tergantung letak rintangan. Minimax yang menentukan."

    # ------------------------------------------------------------- minimax AI
    def nega(self, mask, d, a, b):
        self.nodes += 1
        if self.nodes > self.budget:
            raise BudgetExceeded
        e = self.tt.get(mask)
        if e and e[0] >= d:
            _, v, f = e
            if f == 0:
                return v
            if f == 1 and v >= b:
                return v
            if f == 2 and v <= a:
                return v
        moves = self.legal(mask)
        if not moves:
            return -1000 - d           # pemain yang jalan tidak bisa bergerak: kalah
        if d == 0:
            return 0                   # batas kedalaman: nilai tak diketahui
        a0, best = a, float("-inf")
        for m in moves:
            v = -self.nega(mask | m.mask, d - 1, -b, -a)
            if v > best:
                best = v
            if best > a:
                a = best
            if a >= b:
                self.cuts += 1
                break
        flag = 2 if best <= a0 else (1 if best >= b else 0)
        self.tt[mask] = (d, best, flag)
        return best

    def ai_choose(self, depth, use_mirror=True):
        t0 = time.perf_counter()
        self.nodes = self.cuts = 0
        self.tt = {}
        mask, last = self.mask, self.last
        moves = self.legal(mask)

        # strategi cermin: bila papan sebelum langkah lawan simetris, balas dengan bayangannya
        if use_mirror and last is not None:
            before = mask ^ last.mask
            ok = True if self.n % 2 == 0 else (before & self.center) != 0
            if ok and self.rot(before) == before:
                mm = self.mirror.get(last)
                if mm is not None and not (mm.mask & mask):
                    return mm, "cermin 180 derajat (strategi simetri)"

        best, bv, done = moves[0], float("-inf"), 0
        try:
            for d in range(1, depth + 1):
                a, cb, cv = float("-inf"), moves[0], float("-inf")
                for m in moves:
                    v = -self.nega(mask | m.mask, d - 1, float("-inf"), -a)
                    if v > cv:
                        cv, cb = v, m
                    if cv > a:
                        a = cv
                best, bv, done = cb, cv, d
                if abs(bv) >= 1000:    # sudah terselesaikan penuh
                    break
        except BudgetExceeded:
            pass
        if abs(bv) >= 1000:
            res = "menang dipaksa" if bv > 0 else "kalah dipaksa"
        else:
            res = "belum terselesaikan"
        ms = round((time.perf_counter() - t0) * 1000)
        return best, (f"minimax alpha-beta, kedalaman {done}: {res} | "
                      f"{self.nodes:,} node, {self.cuts:,} pemangkasan, {ms} ms")

    # --------------------------------------------------------------- jalannya
    def play(self, p):
        self.mask |= p.mask
        self.history.append((self.turn, p))
        self.last = p
        self.turn ^= 1

    def over(self):
        return not self.legal(self.mask)

    def render(self):
        n = self.n
        grid = [["." for _ in range(n)] for _ in range(n)]
        for i in self.obstacles:
            grid[i // n][i % n] = "#"
        for idx, (pl, p) in enumerate(self.history):
            ch = chr(ord("a") + idx % 26)
            ch = ch if pl == 0 else ch.upper()      # huruf kecil = P1, besar = P2
            for i in range(p.h):
                for j in range(p.w):
                    grid[p.r + i][p.c + j] = ch
        lines = ["    " + " ".join(f"{c + 1:>2}" for c in range(n))]
        for r in range(n):
            lines.append(f"{r + 1:>3} " + " ".join(f"{x:>2}" for x in grid[r]))
        lines.append("    (# rintangan, huruf kecil = P1, HURUF BESAR = P2)")
        return "\n".join(lines)


# ------------------------------------------------------------------ antarmuka
MOVE_RE = re.compile(r"^\s*(\d)\s*[x×*]\s*(\d)\s+(\d+)\s+(\d+)\s*$", re.I)


def ask_human(game):
    while True:
        try:
            s = input(f"P{game.turn + 1}> ").strip()
        except EOFError:
            return None
        if s.lower() in ("q", "quit", "keluar"):
            return None
        if s == "?":
            mv = game.legal(game.mask)
            print(f"{len(mv)} langkah sah:")
            print("  " + ", ".join(f"{p.h}x{p.w} {p.r + 1} {p.c + 1}" for p in mv))
            continue
        m = MOVE_RE.match(s)
        if not m:
            print("Format: <tinggi>x<lebar> <baris> <kolom>, contoh: 1x3 2 1")
            continue
        h, w, r, c = (int(x) for x in m.groups())
        p = game.lookup.get((h, w, r - 1, c - 1))
        if p is None:
            print("Bidak keluar papan atau ukuran tidak dikenal (1x2, 2x1, 1x3, 3x1).")
        elif p.mask & game.mask:
            print("Petak sudah terisi, coba lagi.")
        else:
            return p


def main(argv=None):
    ap = argparse.ArgumentParser(description="Ubin Simetri (versi asli) - minimax alpha-beta")
    ap.add_argument("--n", type=int, default=5, choices=range(3, 8), metavar="3..7", help="ukuran papan")
    ap.add_argument("--mode", choices=["pvp", "pvai", "aivai"], default="pvai")
    ap.add_argument("--human", type=int, choices=[1, 2], default=1, help="Anda sebagai pemain ke-berapa (mode pvai)")
    ap.add_argument("--depth", type=int, default=8, help="kedalaman AI (default untuk kedua AI)")
    ap.add_argument("--depth1", type=int, help="kedalaman AI P1")
    ap.add_argument("--depth2", type=int, help="kedalaman AI P2")
    ap.add_argument("--budget", type=int, default=600_000, help="batas simpul per langkah AI")
    ap.add_argument("--no-mirror", action="store_true", help="matikan strategi cermin")
    ap.add_argument("--sym", action="store_true", help="rintangan awal simetris (rotasi 180 derajat)")
    ap.add_argument("--seed", type=int, help="seed acak untuk papan yang bisa diulang")
    args = ap.parse_args(argv)

    depths = [args.depth1 or args.depth, args.depth2 or args.depth]
    g = Game(args.n, args.sym, random.Random(args.seed), args.budget)

    def is_ai(p):
        return args.mode == "aivai" or (args.mode == "pvai" and p != args.human - 1)

    print(f"Rintangan: {len(g.obstacles)}. {g.start_info()}")
    while not g.over():
        print()
        print(g.render())
        if is_ai(g.turn):
            print(f"Giliran P{g.turn + 1} (AI berpikir...)")
            p, info = g.ai_choose(depths[g.turn], not args.no_mirror)
            note = f"  [{info}]"
        else:
            p = ask_human(g)
            if p is None:
                print("Permainan dihentikan.")
                return 1
            note = ""
        who = g.turn + 1
        g.play(p)
        print(f"P{who}: {p.h}x{p.w} di baris {p.r + 1}, kolom {p.c + 1}{note}")

    print()
    print(g.render())
    loser = g.turn + 1
    print(f"Pemain {3 - loser} menang. Pemain {loser} tidak bisa meletakkan bidak.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
