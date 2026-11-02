import unittest
from engine import JukirRaceEngine, alpha_beta

class TestJukirRace(unittest.TestCase):
    def test_initial_state(self):
        engine = JukirRaceEngine(6, 6)
        self.assertEqual(engine.width, 6)
        self.assertEqual(engine.height, 6)
        self.assertEqual(engine.turn, 'V')
        self.assertFalse(engine.is_terminal())

    def test_valid_moves(self):
        engine = JukirRaceEngine(6, 6)
        moves = engine.get_valid_moves('V')
        self.assertGreater(len(moves), 0)

    def test_ai_move(self):
        engine = JukirRaceEngine(4, 4)
        score, move = alpha_beta(engine, 2, float('-inf'), float('inf'), True)
        self.assertIsNotNone(move)

    def test_valid_move_updates_price_and_piece_count(self):
        engine = JukirRaceEngine(4, 4)
        moves = engine.get_valid_moves('V')
        self.assertGreater(len(moves), 0)
        move = moves[0]
        engine.apply_move('V', move[0], move[1], move[2])
        self.assertEqual(engine.tarif['V'], 2000)
        self.assertEqual(engine.piece_count['V'], 1)
        self.assertEqual(engine.turn, 'H')

    def test_terminal_when_board_stalls_both_players(self):
        engine = JukirRaceEngine(2, 2)
        engine.board = [['OBSTACLE', 'OBSTACLE'], ['OBSTACLE', None]]
        engine.quota['V']['motor'] = engine.quota['V']['mobil'] = 0
        engine.quota['H']['motor'] = engine.quota['H']['mobil'] = 0
        self.assertTrue(engine.is_terminal())

if __name__ == '__main__':
    unittest.main()
