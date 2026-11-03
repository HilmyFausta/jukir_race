import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, jsonify, request
from flask_cors import CORS

from engine import Solver, generate_obstacles, legal_moves, mask_of

app = Flask(__name__)
CORS(app)

MIN_N, MAX_N = 3, 8


def clamp(v, lo, hi, default):
    try:
        return max(lo, min(hi, int(v)))
    except (TypeError, ValueError):
        return default


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"ok": True})


@app.route('/api/game/new', methods=['POST'])
def new_game():
    data = request.get_json(silent=True) or {}
    n = clamp(data.get('n', 6), MIN_N, MAX_N, 6)
    obstacles = generate_obstacles(n, bool(data.get('symmetric', False)))
    return jsonify({"n": n, "obstacles": obstacles, "pieces": [], "turn": 0})


@app.route('/api/game/ai-move', methods=['POST'])
def ai_move():
    """
    Body: {state: {n, obstacles:[idx], pieces:[{r,c,h,w,p}], turn}, depth, time_limit, mirror}
    Return: {move: {r,c,h,w}, info: {...}}
    """
    data = request.get_json(silent=True) or {}
    state = data.get('state') or {}
    n = clamp(state.get('n', 6), MIN_N, MAX_N, 6)
    obstacles = state.get('obstacles', [])
    pieces = state.get('pieces', [])
    depth = clamp(data.get('depth', 8), 1, 20, 8)
    try:
        time_limit = max(0.3, min(float(data.get('time_limit', 3.5)), 8.0))
    except (TypeError, ValueError):
        time_limit = 3.5

    mask = mask_of(n, obstacles, pieces)
    if not legal_moves(n, mask):
        return jsonify({"error": "Tidak ada langkah sah"}), 400

    solver = Solver(n, budget=400_000, time_limit=time_limit)
    last = pieces[-1] if pieces else None
    move, info = solver.choose(mask, last, depth, bool(data.get('mirror', False)))
    return jsonify({"move": {"r": move.r, "c": move.c, "h": move.h, "w": move.w}, "info": info})


if __name__ == '__main__':
    app.run(port=5328, debug=True)
