import os
import random
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine import Solver, build_pieces, generate_obstacles, legal_moves, mask_of


class TestEngine(unittest.TestCase):
    def test_pieces_count(self):
        allp, _ = build_pieces(4)
        # 1x2: 4*3, 2x1: 3*4, 1x3: 4*2, 3x1: 2*4
        self.assertEqual(len(allp), 12 + 12 + 8 + 8)

    def test_obstacles_not_exceed_n(self):
        for n in range(3, 9):
            for seed in range(30):
                obs = generate_obstacles(n, rng=random.Random(seed))
                self.assertTrue(1 <= len(obs) <= n)
                self.assertTrue(legal_moves(n, mask_of(n, obs, [])))

    def test_symmetric_obstacles(self):
        n = 6
        obs = generate_obstacles(n, symmetric=True, rng=random.Random(1))
        self.assertEqual(set(obs), {n * n - 1 - i for i in obs})

    def test_ai_returns_legal_move(self):
        n = 5
        obs = generate_obstacles(n, rng=random.Random(3))
        mask = mask_of(n, obs, [])
        move, info = Solver(n, time_limit=2).choose(mask, None, depth=6)
        self.assertFalse(move.mask & mask)
        self.assertGreaterEqual(info["nodes"], 1)

    def test_ai_finds_forced_win_on_tiny_board(self):
        # 3x3 tanpa obstacle kecuali pojok-pojok -> cukup kecil untuk diselesaikan penuh
        n = 3
        mask = mask_of(n, [0, 2, 6, 8], [])
        move, info = Solver(n, time_limit=3).choose(mask, None, depth=20)
        self.assertIn(info["result"], ("menang dipaksa", "kalah dipaksa"))
        self.assertFalse(move.mask & mask)

    def test_mirror_strategy(self):
        n = 4
        solver = Solver(n)
        allp, lookup = build_pieces(n)
        first = lookup[(1, 2, 0, 0)]
        mask = first.mask
        move, info = solver.choose(mask, {"r": 0, "c": 0, "h": 1, "w": 2}, depth=4, use_mirror=True)
        self.assertEqual(info["strategy"], "mirror")
        self.assertEqual((move.r, move.c, move.h, move.w), (3, 2, 1, 2))

    def test_game_ends_with_loser(self):
        n = 3
        rng = random.Random(7)
        mask = mask_of(n, generate_obstacles(n, rng=rng), [])
        turn, solver = 0, Solver(n, time_limit=1)
        while legal_moves(n, mask):
            m, _ = solver.choose(mask, None, depth=10)
            mask |= m.mask
            turn ^= 1
        self.assertFalse(legal_moves(n, mask))  # pemain `turn` kalah


if __name__ == '__main__':
    unittest.main()
