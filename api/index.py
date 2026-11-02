import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, request, jsonify
from flask_cors import CORS
from engine import JukirRaceEngine, alpha_beta

app = Flask(__name__)
CORS(app)


def state_to_dict(engine):
    return {
        "board": {"width": engine.width, "height": engine.height, "cells": engine.board},
        "turn": engine.turn,
        "quota": engine.quota,
        "tarif": engine.tarif,
        "consecutive_skips": engine.consecutive_skips,
        "pieceCount": engine.piece_count,
        "terminal": engine.is_terminal(),
        "winner": engine.winner() if engine.is_terminal() else None
    }


def dict_to_engine(data):
    b = data.get('board', {})
    engine = JukirRaceEngine(b.get('width', 6), b.get('height', 6))
    engine.board = b.get('cells', engine.board)
    engine.turn = data.get('turn', 'V')
    engine.quota = data.get('quota', engine.quota)
    engine.tarif = data.get('tarif', engine.tarif)
    engine.consecutive_skips = data.get('consecutive_skips', 0)
    engine.piece_count = data.get('pieceCount', {'V': 0, 'H': 0})
    return engine


@app.route('/api/game/new', methods=['POST'])
def new_game():
    data = request.json or {}
    engine = JukirRaceEngine(data.get('width', 6), data.get('height', 6))
    return jsonify(state_to_dict(engine))


@app.route('/api/game/move', methods=['POST'])
def player_move():
    data = request.json or {}
    engine = dict_to_engine(data.get('state', {}))
    ptype = data.get('pieceType')
    x = data.get('x')
    y = data.get('y')

    moves = engine.get_valid_moves(engine.turn)
    if (ptype, x, y) in moves:
        engine.apply_move(engine.turn, ptype, x, y)
    else:
        return jsonify({"error": "Invalid move"}), 400

    return jsonify(state_to_dict(engine))

@app.route('/api/game/skip', methods=['POST'])
def skip_turn():
    data = request.json or {}
    engine = dict_to_engine(data.get('state', {}))
    engine.consecutive_skips += 1
    engine.turn = 'H' if engine.turn == 'V' else 'V'
    return jsonify(state_to_dict(engine))


@app.route('/api/game/ai-move', methods=['POST'])
def ai_move():
    data = request.json or {}
    engine = dict_to_engine(data.get('state', {}))
    depth = data.get('depth', 4)

    moves = engine.get_valid_moves(engine.turn)
    if not moves:                       # <-- tambahan: cek dulu sebelum search
        engine.consecutive_skips += 1
        engine.turn = 'H' if engine.turn == 'V' else 'V'
        return jsonify({
            "move": None,
            "score": None,
            "nodesEvaluated": 0,
            "newState": state_to_dict(engine)
        })

    stats = {'nodes': 0}
    score, best_move = alpha_beta(
        engine, depth, float('-inf'), float('inf'), engine.turn == 'V', stats
    )

    if best_move:
        engine.apply_move(engine.turn, best_move[0], best_move[1], best_move[2])
    else:
        engine.consecutive_skips += 1
        engine.turn = 'H' if engine.turn == 'V' else 'V'

    return jsonify({
        "move": best_move,
        "score": score,
        "nodesEvaluated": stats['nodes'],
        "newState": state_to_dict(engine)
    })


if __name__ == '__main__':
    app.run(port=5328, debug=True)
