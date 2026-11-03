import { useEffect, useRef } from "react";
import { SIDES, pieceKind } from "../lib/game";

const SIZE = 640; // resolusi logis canvas; di-scale otomatis oleh Phaser (FIT)

export default function Board({ state, preview, onHover, onTap }) {
  const hostRef = useRef(null);
  const sceneRef = useRef(null);
  const stateRef = useRef(state);
  const previewRef = useRef(preview);
  const cbRef = useRef({ onHover, onTap });

  stateRef.current = state;
  previewRef.current = preview;
  cbRef.current = { onHover, onTap };

  const n = state.n;

  useEffect(() => {
    let destroyed = false;
    let game = null;

    import("phaser").then((Phaser) => {
      if (destroyed || !hostRef.current) return;

      class BoardScene extends Phaser.Scene {
        constructor() {
          super("board");
        }

        preload() {
          this.load.image("paving", "/assets/paving_tile.png");
          this.load.image("ban", "/assets/ban.png");
          ["motor", "mobil"].forEach((t) => {
            ["blue", "red"].forEach((col) =>
              ["v", "h"].forEach((o) => this.load.image(`${t}_${col}_${o}`, `/assets/sprites/${t}_${col}_${o}.png`))
            );
            ["v", "h"].forEach((o) =>
              ["ok", "bad"].forEach((tag) =>
                this.load.image(`shadow_${t}_${o}_${tag}`, `/assets/sprites/shadow_${t}_${o}_${tag}.png`)
              )
            );
          });
        }

        create() {
          this.cell = SIZE / n;
          this.add.tileSprite(0, 0, SIZE, SIZE, "paving").setOrigin(0, 0).setTileScale(this.cell / 64);

          const g = this.add.graphics();
          g.lineStyle(3, 0x2a271d, 0.9);
          for (let i = 1; i < n; i++) {
            g.lineBetween(i * this.cell, 0, i * this.cell, SIZE);
            g.lineBetween(0, i * this.cell, SIZE, i * this.cell);
          }

          this.objs = new Map(); // key -> image
          this.shadow = this.add.image(0, 0, "shadow_motor_h_ok").setOrigin(0, 0).setVisible(false).setDepth(50);

          sceneRef.current = this;
          this.sync(stateRef.current, true);
          this.setPreview(previewRef.current);
        }

        sync(s, first) {
          if (!this.objs) return;
          const cell = this.cell;
          const want = new Set();

          s.obstacles.forEach((i) => {
            const key = `ob${i}`;
            want.add(key);
            if (!this.objs.has(key)) {
              const r = Math.floor(i / s.n);
              const c = i % s.n;
              const im = this.add.image(c * cell, r * cell, "ban").setOrigin(0, 0).setDisplaySize(cell, cell);
              this.objs.set(key, im);
            }
          });

          s.pieces.forEach((p) => {
            const key = `p${p.r}-${p.c}-${p.h}-${p.w}`;
            want.add(key);
            if (!this.objs.has(key)) {
              const { type, o } = pieceKind(p);
              const im = this.add
                .image(p.c * cell, p.r * cell, `${type}_${SIDES[p.p].color}_${o}`)
                .setOrigin(0, 0)
                .setDisplaySize(p.w * cell, p.h * cell);
              this.objs.set(key, im);
              if (!first) {
                const sx = im.scaleX;
                const sy = im.scaleY;
                im.setScale(sx * 0.6, sy * 0.6).setAlpha(0.2);
                im.x += (p.w * cell * 0.4) / 2;
                im.y += (p.h * cell * 0.4) / 2;
                this.tweens.add({
                  targets: im,
                  scaleX: sx,
                  scaleY: sy,
                  alpha: 1,
                  x: p.c * cell,
                  y: p.r * cell,
                  duration: 160,
                  ease: "Back.Out",
                });
              }
            }
          });

          for (const [key, im] of this.objs) {
            if (!want.has(key)) {
              im.destroy();
              this.objs.delete(key);
            }
          }
        }

        setPreview(pv) {
          if (!this.shadow) return;
          if (!pv) {
            this.shadow.setVisible(false);
            return;
          }
          const type = pv.h * pv.w === 2 ? "motor" : "mobil";
          const o = pv.h > pv.w ? "v" : "h";
          this.shadow
            .setTexture(`shadow_${type}_${o}_${pv.valid ? "ok" : "bad"}`)
            .setPosition(pv.c * this.cell, pv.r * this.cell)
            .setDisplaySize(pv.w * this.cell, pv.h * this.cell)
            .setAlpha(pv.valid ? 0.6 : 0.5)
            .setVisible(true);
        }
      }

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: hostRef.current,
        width: SIZE,
        height: SIZE,
        pixelArt: true,
        backgroundColor: "#9b957f",
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        input: { mouse: false, touch: false, keyboard: false }, // input ditangani Pointer Events native
        scene: BoardScene,
      });
    });

    return () => {
      destroyed = true;
      sceneRef.current = null;
      if (game) game.destroy(true);
    };
  }, [n]);

  useEffect(() => {
    if (sceneRef.current) sceneRef.current.sync(state, false);
  }, [state]);

  useEffect(() => {
    if (sceneRef.current) sceneRef.current.setPreview(preview);
  }, [preview]);

  // Input lewat Pointer Events native: mouse vs sentuh dibedakan jelas (tidak ada event mouse "bayangan" setelah tap).
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const cellAt = (e) => {
      const cv = el.querySelector("canvas") || el;
      const rect = cv.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      if (x < 0 || y < 0 || x >= 1 || y >= 1) return null;
      return { r: Math.floor(y * n), c: Math.floor(x * n) };
    };
    let down = null;
    const onDown = (e) => {
      if (e.pointerType === "touch") {
        down = { x: e.clientX, y: e.clientY };
      } else {
        const cell = cellAt(e);
        if (cell) cbRef.current.onTap(cell, "mouse");
      }
    };
    const onUp = (e) => {
      if (e.pointerType !== "touch" || !down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 12) return; // geser/scroll, bukan tap
      const cell = cellAt(e);
      if (cell) cbRef.current.onTap(cell, "touch");
    };
    const onCancel = () => {
      down = null;
    };
    const onMove = (e) => {
      if (e.pointerType === "touch") return;
      cbRef.current.onHover(cellAt(e));
    };
    const onLeave = (e) => {
      if (e.pointerType !== "touch") cbRef.current.onHover(null);
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [n]);

  return <div ref={hostRef} className="board-host" />;
}
