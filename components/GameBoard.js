import { useEffect, useRef } from "react";

const COLOR = {
  V: 0x2463eb,
  H: 0xd83a34,
  V_LIGHT: 0x70a0ff,
  H_LIGHT: 0xff8983,
  OBSTACLE: 0x2b2b2b,
  OBSTACLE_RING: 0x777777,
  GRID_LINE: 0x5c5440,
};

const CANVAS_SIZE = 560;

export default function GameBoard({ state, onCellClick }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const sceneRef = useRef(null);
  const stateRef = useRef(state);

  const width = state?.board?.width || 6;
  const height = state?.board?.height || 6;

  // (Re)create the Phaser game whenever board dimensions change.
  useEffect(() => {
    let destroyed = false;

    import("phaser").then((Phaser) => {
      if (destroyed || !containerRef.current) return;

      class BoardScene extends Phaser.Scene {
        constructor() {
          super("board");
        }

        preload() {
          this.load.image("paving", "/assets/paving_tile.png");
        }

        create() {
          const cell = CANVAS_SIZE / Math.max(width, height);
          this.cellSize = cell;

          // Paving background, tiled.
          this.add
            .tileSprite(0, 0, width * cell, height * cell, "paving")
            .setOrigin(0, 0)
            .setTileScale(cell / 128, cell / 128);

          // Grid lines + click zones.
          const gfxGrid = this.add.graphics();
          gfxGrid.lineStyle(1, COLOR.GRID_LINE, 0.5);
          for (let i = 0; i <= width; i++) {
            gfxGrid.moveTo(i * cell, 0);
            gfxGrid.lineTo(i * cell, height * cell);
          }
          for (let j = 0; j <= height; j++) {
            gfxGrid.moveTo(0, j * cell);
            gfxGrid.lineTo(width * cell, j * cell);
          }
          gfxGrid.strokePath();

          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const zone = this.add
                .zone(x * cell, y * cell, cell, cell)
                .setOrigin(0, 0)
                .setInteractive({ useHandCursor: true });
              zone.on("pointerdown", () => onCellClickRef.current(x, y));
            }
          }

          this.piecesLayer = this.add.graphics();
          sceneRef.current = this;
          this.syncState(stateRef.current);
        }

        syncState(s) {
          if (!s || !this.piecesLayer) return;
          const cell = this.cellSize;
          const g = this.piecesLayer;
          g.clear();

          const cells = s.board.cells;
          const drawn = new Set();

          for (let y = 0; y < s.board.height; y++) {
            for (let x = 0; x < s.board.width; x++) {
              const v = cells[y][x];
              if (v === "OBSTACLE") {
                const cx = x * cell + cell / 2;
                const cy = y * cell + cell / 2;
                g.fillStyle(COLOR.OBSTACLE, 1);
                g.fillCircle(cx, cy, cell * 0.32);
                g.lineStyle(3, COLOR.OBSTACLE_RING, 1);
                g.strokeCircle(cx, cy, cell * 0.32);
              } else if (v && typeof v === "object") {
                const key = `${v.owner}-${v.type}-${y}-${x}`;
                if (drawn.has(key)) continue;
                const size = v.type === "motor" ? 2 : 3;

                let isStart = true;
                if (v.owner === "V") {
                  const above = y > 0 ? cells[y - 1][x] : null;
                  if (above && typeof above === "object" && above.owner === v.owner && above.type === v.type) {
                    isStart = false;
                  }
                } else {
                  const left = x > 0 ? cells[y][x - 1] : null;
                  if (left && typeof left === "object" && left.owner === v.owner && left.type === v.type) {
                    isStart = false;
                  }
                }
                if (!isStart) continue;
                drawn.add(key);

                const w = v.owner === "H" ? size * cell : cell;
                const h = v.owner === "V" ? size * cell : cell;
                const px = x * cell + cell * 0.08;
                const py = y * cell + cell * 0.08;
                const pw = w - cell * 0.16;
                const ph = h - cell * 0.16;

                const main = v.owner === "V" ? COLOR.V : COLOR.H;
                const light = v.owner === "V" ? COLOR.V_LIGHT : COLOR.H_LIGHT;

                g.fillStyle(main, 1);
                g.fillRoundedRect(px, py, pw, ph, cell * 0.18);
                g.lineStyle(3, light, 1);
                g.strokeRoundedRect(px, py, pw, ph, cell * 0.18);

                // simple pixel-style headlight/window marks
                g.fillStyle(light, 1);
                if (v.owner === "V") {
                  g.fillRect(px + pw * 0.25, py + ph * 0.12, pw * 0.5, ph * 0.1);
                } else {
                  g.fillRect(px + pw * 0.12, py + ph * 0.25, pw * 0.1, ph * 0.5);
                }
              }
            }
          }
        }
      }

      const config = {
        type: Phaser.AUTO,
        width: width * (CANVAS_SIZE / Math.max(width, height)),
        height: height * (CANVAS_SIZE / Math.max(width, height)),
        parent: containerRef.current,
        backgroundColor: "#aaa58f",
        scene: BoardScene,
      };

      gameRef.current = new Phaser.Game(config);
    });

    return () => {
      destroyed = true;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
        sceneRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  // Keep latest onCellClick without forcing a scene rebuild.
  const onCellClickRef = useRef(onCellClick);
  useEffect(() => {
    onCellClickRef.current = onCellClick;
  }, [onCellClick]);

  // Push new state into the running scene whenever it changes.
  useEffect(() => {
    stateRef.current = state;
    if (sceneRef.current) {
      sceneRef.current.syncState(state);
    }
  }, [state]);

  return <div ref={containerRef} className="board-canvas" />;
}
