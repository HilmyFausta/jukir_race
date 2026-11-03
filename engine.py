"""
Engine Jukir Race - normal play (pemain yang tidak bisa menaruh kendaraan kalah).

Diadaptasi dari ubin_simetri_lama.py (partner) agar bisa dipakai stateless lewat API:
  * Papan N x N, rintangan (ban) 1x1 acak, jumlahnya 1..N.
  * Bidak: motor 1x2 / 2x1 dan mobil 1x3 / 3x1, orientasi bebas, jumlah unlimited.
  * AI: negamax (= minimax) + alpha-beta + tabel transposisi + iterative deepening,
    ditambah batas waktu/simpul supaya aman di serverless, dan opsional strategi cermin.

Nilai simpul (sudut pandang pemain yang jalan):
  tidak ada langkah -> -1000 - d  (kalah; makin dangkal makin buruk)
  d == 0            -> 0          (belum diketahui)
  selain itu        -> max(-nilai(anak))
|nilai| >= 1000 berarti menang / kalah sudah pasti.
"""
import random
import time
from collections import namedtuple
from functools import lru_cache

PIECES = [(1, 2), (2, 1), (1, 3), (3, 1)]
Piece = namedtuple("Piece", "r c h w mask area")


class BudgetExceeded(Exception):
    pass


@lru_cache(maxsize=16)
def build_pieces(n):
    """Semua penempatan bidak yang mungkin di papan n x n (diurutkan: bidak besar dulu)."""
    out = []
    for h, w in PIECES:
        for r in range(n - h + 1):
            for c in range(n - w + 1):
                m = 0
                for i in range(h):
                    for j in range(w):
                        m |= 1 << ((r + i) * n + c + j)
                out.append(Piece(r, c, h, w, m, h * w))
    out.sort(key=lambda p: -p.area)
    lookup = {(p.h, p.w, p.r, p.c): p for p in out}
    return tuple(out), lookup


def rot180(m, n):
    """Rotasi 180 derajat: bit i -> bit (n*n-1-i)."""
    t = n * n
    return int(format(m, f"0{t}b")[::-1], 2)


def mask_of(n, obstacles, pieces):
    """Bitmask papan dari daftar obstacle (indeks) dan bidak ({r,c,h,w})."""
    mask = 0
    for i in obstacles:
        mask |= 1 << int(i)
    for p in pieces:
        for i in range(p["h"]):
            for j in range(p["w"]):
                mask |= 1 << ((p["r"] + i) * n + p["c"] + j)
    return mask


def generate_obstacles(n, symmetric=False, rng=None):
    """Obstacle 1x1 acak, jumlah 1..n (tidak melebihi n), dijamin masih ada langkah sah."""
    rng = rng or random.Random()
    all_pieces, _ = build_pieces(n)
    total = n * n
    while True:
        k = rng.randint(1, n)
        if symmetric and n % 2 == 0:
            k = 2 * ((k + 1) // 2)
        cells, guard = set(), 0
        while len(cells) < k and guard < 500:
            guard += 1
            i = rng.randrange(total)
            add = {i, total - 1 - i} if symmetric else {i}
            add -= cells
            if len(cells) + len(add) <= k:
                cells |= add
        mask = 0
        for i in cells:
            mask |= 1 << i
        if any(not (p.mask & mask) for p in all_pieces):
            return sorted(cells)


def legal_moves(n, mask):
    all_pieces, _ = build_pieces(n)
    return [p for p in all_pieces if not (p.mask & mask)]


class Solver:
    def __init__(self, n, budget=300_000, time_limit=3.5):
        self.n = n
        self.all, self.lookup = build_pieces(n)
        self.mirror = {p: self.lookup[(p.h, p.w, n - p.r - p.h, n - p.c - p.w)] for p in self.all}
        self.center = (1 << (((n - 1) // 2) * n + (n - 1) // 2)) if n % 2 else 0
        self.budget = budget
        self.time_limit = time_limit
        self.deadline = 0.0
        self.nodes = 0
        self.cuts = 0
        self.tt = {}

    def legal(self, mask):
        return [p for p in self.all if not (p.mask & mask)]

    def nega(self, mask, d, a, b):
        self.nodes += 1
        if self.nodes > self.budget or ((self.nodes & 1023) == 0 and time.perf_counter() > self.deadline):
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
            return -1000 - d
        if d == 0:
            return 0
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

    def choose(self, mask, last=None, depth=8, use_mirror=False):
        """Pilih langkah terbaik. `last` = bidak terakhir lawan (dict r,c,h,w) atau None."""
        t0 = time.perf_counter()
        self.deadline = t0 + self.time_limit
        self.nodes = self.cuts = 0
        self.tt = {}
        moves = self.legal(mask)
        if not moves:
            return None, {"strategy": "none", "depth": 0, "nodes": 0, "cuts": 0, "ms": 0,
                          "result": "tidak ada langkah"}

        # strategi cermin 180 derajat bila posisi sebelum langkah lawan simetris
        if use_mirror and last is not None:
            lp = self.lookup.get((last["h"], last["w"], last["r"], last["c"]))
            if lp is not None:
                before = mask ^ lp.mask
                ok = True if self.n % 2 == 0 else (before & self.center) != 0
                if ok and rot180(before, self.n) == before:
                    mm = self.mirror.get(lp)
                    if mm is not None and not (mm.mask & mask):
                        return mm, {"strategy": "mirror", "depth": 0, "nodes": 0, "cuts": 0, "ms": 0,
                                    "result": "cermin 180 derajat (strategi simetri)"}

        best, bv, done = moves[0], float("-inf"), 0
        order = list(moves)
        try:
            for d in range(1, depth + 1):
                a, cb, cv = float("-inf"), order[0], float("-inf")
                for m in order:
                    v = -self.nega(mask | m.mask, d - 1, float("-inf"), -a)
                    if v > cv:
                        cv, cb = v, m
                    if cv > a:
                        a = cv
                best, bv, done = cb, cv, d
                order.remove(cb)
                order.insert(0, cb)  # langkah terbaik iterasi ini dicoba duluan di iterasi berikutnya
                if abs(bv) >= 1000:
                    break
        except BudgetExceeded:
            pass

        if done and abs(bv) >= 1000:
            result = "menang dipaksa" if bv > 0 else "kalah dipaksa"
        else:
            result = "belum terselesaikan"
        return best, {"strategy": "minimax", "depth": done, "nodes": self.nodes, "cuts": self.cuts,
                      "ms": round((time.perf_counter() - t0) * 1000), "result": result}
