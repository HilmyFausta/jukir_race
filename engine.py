import random
import copy

class JukirRaceEngine:
    def __init__(self, width=6, height=6):
        self.width = width
        self.height = height
        self.board = [[None for _ in range(width)] for _ in range(height)]
        
        # Jatah default berdasarkan PRD (6x6)
        total_petak = width * height
        self.quota = {
            'V': {'motor': round(0.17 * total_petak), 'mobil': round(0.11 * total_petak)},
            'H': {'motor': round(0.17 * total_petak), 'mobil': round(0.11 * total_petak)}
        }
        self.tarif = {'V': 0, 'H': 0}
        self.turn = 'V'
        self.consecutive_skips = 0
        self.piece_count = {'V': 0, 'H': 0}
        
        self._spawn_obstacles(total_petak)

    def _spawn_obstacles(self, total_petak):
        num_obs = max(2, round(0.10 * total_petak))
        placed = 0
        while placed < num_obs:
            x = random.randint(0, self.width - 1)
            y = random.randint(0, self.height - 1)
            if self.board[y][x] is None:
                self.board[y][x] = 'OBSTACLE'
                placed += 1
        
        # Hindari pola obstacle yang identik terhadap sumbu vertikal maupun horizontal.
        if self._is_symmetric():
            obstacle_positions = [(x, y) for y in range(self.height)
                                  for x in range(self.width)
                                  if self.board[y][x] == 'OBSTACLE']
            for x, y in obstacle_positions:
                new_x = (x + 1) % self.width
                new_y = (y + 1) % self.height
                if self.board[new_y][new_x] is None:
                    self.board[y][x] = None
                    self.board[new_y][new_x] = 'OBSTACLE'
                    if not self._is_symmetric():
                        break
                    self.board[new_y][new_x] = None
                    self.board[y][x] = 'OBSTACLE'

    def _is_symmetric(self):
        vertical = all(
            (self.board[y][x] == 'OBSTACLE') ==
            (self.board[y][self.width - 1 - x] == 'OBSTACLE')
            for y in range(self.height) for x in range(self.width)
        )
        horizontal = all(
            (self.board[y][x] == 'OBSTACLE') ==
            (self.board[self.height - 1 - y][x] == 'OBSTACLE')
            for y in range(self.height) for x in range(self.width)
        )
        return vertical or horizontal

    def get_valid_moves(self, player):
        moves = []
        for y in range(self.height):
            for x in range(self.width):
                for ptype in ['motor', 'mobil']:
                    if self.quota[player][ptype] > 0:
                        size = 2 if ptype == 'motor' else 3
                        if player == 'V':
                            if y + size <= self.height and all(self.board[y+i][x] is None for i in range(size)):
                                moves.append((ptype, x, y))
                        else:
                            if x + size <= self.width and all(self.board[y][x+i] is None for i in range(size)):
                                moves.append((ptype, x, y))
        return moves

    def apply_move(self, player, ptype, x, y):
        size = 2 if ptype == 'motor' else 3
        cost = 2000 if ptype == 'motor' else 3000
        
        if player == 'V':
            for i in range(size):
                self.board[y+i][x] = {'type': ptype, 'owner': player}
        else:
            for i in range(size):
                self.board[y][x+i] = {'type': ptype, 'owner': player}
                
        self.quota[player][ptype] -= 1
        self.tarif[player] += cost
        self.piece_count[player] += 1
        self.turn = 'H' if player == 'V' else 'V'
        self.consecutive_skips = 0

    def is_terminal(self):
        return (self.consecutive_skips >= 2 or
                (not self.get_valid_moves('V') and not self.get_valid_moves('H')))

    def winner(self):
        if self.tarif['V'] != self.tarif['H']:
            return 'V' if self.tarif['V'] > self.tarif['H'] else 'H'
        if self.piece_count['V'] != self.piece_count['H']:
            return 'V' if self.piece_count['V'] > self.piece_count['H'] else 'H'
        return 'TIE'

def evaluate(state):
    # Heuristik: selisih tarif + bobot sisa potensi
    potensi_v = state.quota['V']['motor'] * 2000 + state.quota['V']['mobil'] * 3000
    potensi_h = state.quota['H']['motor'] * 2000 + state.quota['H']['mobil'] * 3000
    return (state.tarif['V'] - state.tarif['H']) + 0.5 * (potensi_v - potensi_h)

def alpha_beta(state, depth, alpha, beta, maximizing, stats=None):
    if stats is None:
        stats = {'nodes': 0}
    stats['nodes'] += 1

    if depth == 0 or state.is_terminal():
        return evaluate(state), None

    moves = state.get_valid_moves(state.turn)
    if not moves:
        skipped = copy.deepcopy(state)
        skipped.consecutive_skips += 1
        skipped.turn = 'H' if skipped.turn == 'V' else 'V'
        if skipped.is_terminal():
            return evaluate(skipped), None
        return alpha_beta(skipped, depth - 1, alpha, beta, not maximizing, stats)

    best_move = None
    if maximizing:
        max_eval = float('-inf')
        for m in moves:
            s = copy.deepcopy(state)
            s.apply_move(state.turn, m[0], m[1], m[2])
            eval, _ = alpha_beta(s, depth - 1, alpha, beta, False, stats)
            if eval > max_eval:
                max_eval = eval
                best_move = m
            alpha = max(alpha, eval)
            if beta <= alpha:
                break
        return max_eval, best_move
    else:
        min_eval = float('inf')
        for m in moves:
            s = copy.deepcopy(state)
            s.apply_move(state.turn, m[0], m[1], m[2])
            eval, _ = alpha_beta(s, depth - 1, alpha, beta, True, stats)
            if eval < min_eval:
                min_eval = eval
                best_move = m
            beta = min(beta, eval)
            if beta <= alpha:
                break
        return min_eval, best_move
