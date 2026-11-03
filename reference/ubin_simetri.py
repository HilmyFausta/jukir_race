#!/usr/bin/env python3
"""
Ubin Simetri - Minimax Alpha-Beta (sistem poin), versi Python / terminal.

Aturan:
  * Papan N x N dimulai dengan rintangan 1x1 acak (1 .. N-2 buah).
  * Pemain bergantian menaruh mobil 1x2 / 2x1 (3.000 poin) atau 1x3 / 3x1 (5.000 poin).
  * Permainan selesai saat tidak ada lagi bidak yang muat. Skor tertinggi menang.

AI: negamax + alpha-beta + tabel transposisi + iterative deepening.
Nilai simpul = (skor masa depan pemain yang jalan) - (skor masa depan lawan).

Contoh:
  python ubin_simetri.py                       # Anda (P1) lawan AI, papan 5x5
  python ubin_simetri.py --mode aivai --n 6    # AI lawan AI
  python ubin_simetri.py --mode pvp            # dua pemain manusia
  python ubin_simetri.py --human 2 --depth 10  # Anda sebagai P2, AI kedalaman 10

Cara memasukkan langkah:  <tinggi>x<lebar> <baris> <kolom>   (baris/kolom mulai dari 1)
  contoh:  1x3 2 1   -> bidak 1 baris x 3 kolom, pojok kiri-atas di baris 2, kolom 1
  perintah lain: "?" daftar langkah sah, "q" keluar.
"""
import argparse
import random
import re
import sys
import time
from collections import namedtuple

PIECES = [(1, 2), (2, 1), (1, 3), (3, 1)]
Piece = namedtuple("Piece", "r c h w mask pts")


def fmt(v: int) -> str:
    """Format angka dengan pemisah ribuan gaya Indonesia: 3.000"""
    return f"{v:,}".replace(",", ".")


class BudgetExceeded(Exception):
    pass


class Game:
    def __init__(self, n, sym_obstacles=False, rng=None, budget=600_000):
        self.n = n
        self.rng = rng or random.Random()
        self.budget = budget
        self.all = self._build_pieces()
        self.lookup = {(p.h, p.w, p.r, p.c): p for p in self.all}
        self.nodes = 0
        self.cuts = 0
        self.tt = {}
        # status permainan
        self.obstacles = []
        self.mask = 0
        self.turn = 0
        self.scores = [0, 0]
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
                    out.append(Piece(r, c, h, w, m, 3000 if h * w == 2 else 5000))
        out.sort(key=lambda p: -p.pts)   # urutan langkah: poin besar dulu (pemangkasan lebih baik)
        return out

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

    # ------------------------------------------------------------- minimax AI
    def nega(self, mask, d, a, b):
        """Nilai posisi bagi pemain yang jalan: selisih skor masa depan."""
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
        if not moves or d == 0:
            return 0                       # papan penuh / batas kedalaman
        a0, best = a, float("-inf")
        for m in moves:
            g = m.pts
            v = g - self.nega(mask | m.mask, d - 1, g - b, g - a)
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

    def ai_choose(self, depth):
        t0 = time.perf_counter()
        self.nodes = self.cuts = 0
        self.tt = {}
        mask = self.mask
        moves = self.legal(mask)
        max_ply = (self.n * self.n - bin(mask).count("1")) // 2   # batas atas sisa langkah
        best, bv, done = moves[0], 0, 0
        try:
            for d in range(1, depth + 1):
                a, cb, cv = float("-inf"), moves[0], float("-inf")
                for m in moves:
                    g = m.pts
                    v = g - self.nega(mask | m.mask, d - 1, float("-inf"), g - a)
                    if v > cv:
                        cv, cb = v, m
                    if cv > a:
                        a = cv
                best, bv, done = cb, cv, d
                if d >= max_ply:           # sudah sampai akhir permainan: hasil pasti
                    break
        except BudgetExceeded:
            pass
        sg = "+" if bv > 0 else ""
        if done >= max_ply:
            tag = f"sampai akhir permainan, selisih skor {sg}{fmt(int(bv))}"
        else:
            tag = f"kedalaman {done}, perkiraan selisih skor {sg}{fmt(int(bv))}"
        ms = round((time.perf_counter() - t0) * 1000)
        return best, f"{tag} | {self.nodes:,} node, {self.cuts:,} pemangkasan, {ms} ms"

    # --------------------------------------------------------------- jalannya
    def play(self, p: Piece):
        self.mask |= p.mask
        self.scores[self.turn] += p.pts
        self.history.append((self.turn, p))
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
        head = "    " + " ".join(f"{c + 1:>2}" for c in range(n))
        lines = [head]
        for r in range(n):
            lines.append(f"{r + 1:>3} " + " ".join(f"{x:>2}" for x in grid[r]))
        lines.append("    (# rintangan, huruf kecil = P1, HURUF BESAR = P2)")
        return "\n".join(lines)

    def scoreboard(self):
        return f"Skor  P1: {fmt(self.scores[0])}   P2: {fmt(self.scores[1])}"


# ------------------------------------------------------------------ antarmuka
MOVE_RE = re.compile(r"^\s*(\d)\s*[x×*]\s*(\d)\s+(\d+)\s+(\d+)\s*$", re.I)


def ask_human(game: Game):
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
    ap = argparse.ArgumentParser(description="Ubin Simetri (sistem poin) - minimax alpha-beta")
    ap.add_argument("--n", type=int, default=5, choices=range(3, 8), metavar="3..7", help="ukuran papan")
    ap.add_argument("--mode", choices=["pvp", "pvai", "aivai"], default="pvai")
    ap.add_argument("--human", type=int, choices=[1, 2], default=1, help="Anda sebagai pemain ke-berapa (mode pvai)")
    ap.add_argument("--depth", type=int, default=8, help="kedalaman AI (default untuk kedua AI)")
    ap.add_argument("--depth1", type=int, help="kedalaman AI P1")
    ap.add_argument("--depth2", type=int, help="kedalaman AI P2")
    ap.add_argument("--budget", type=int, default=600_000, help="batas simpul per langkah AI")
    ap.add_argument("--sym", action="store_true", help="rintangan awal simetris (rotasi 180 derajat)")
    ap.add_argument("--seed", type=int, help="seed acak untuk papan yang bisa diulang")
    args = ap.parse_args(argv)

    depths = [args.depth1 or args.depth, args.depth2 or args.depth]
    g = Game(args.n, args.sym, random.Random(args.seed), args.budget)

    def is_ai(p):
        return args.mode == "aivai" or (args.mode == "pvai" and p != args.human - 1)

    print(f"Rintangan: {len(g.obstacles)}. Mobil 1x2/2x1 = 3.000, 1x3/3x1 = 5.000.")
    while not g.over():
        print()
        print(g.render())
        print(g.scoreboard())
        if is_ai(g.turn):
            print(f"Giliran P{g.turn + 1} (AI berpikir...)")
            p, info = g.ai_choose(depths[g.turn])
            note = f"  [{info}]"
        else:
            p = ask_human(g)
            if p is None:
                print("Permainan dihentikan.")
                return 1
            note = ""
        who = g.turn + 1
        g.play(p)
        print(f"P{who}: {p.h}x{p.w} di baris {p.r + 1}, kolom {p.c + 1} (+{fmt(p.pts)}){note}")

    print()
    print(g.render())
    print(g.scoreboard())
    x, y = g.scores
    if x == y:
        print(f"Seri {fmt(x)} - {fmt(y)}. Tidak ada lagi petak yang bisa ditempati.")
    else:
        print(f"Pemain {1 if x > y else 2} menang {fmt(max(x, y))} - {fmt(min(x, y))}. "
              "Tidak ada lagi petak yang bisa ditempati.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
