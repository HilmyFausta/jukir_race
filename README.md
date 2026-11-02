# Jukir Race

Baseline implementasi (Next.js + Phaser + Python/Flask) sesuai PRD.md.
Logic AI (engine.py) dipakai dari repo tim, tidak diubah - hanya dibungkus
ulang dengan frontend Next.js+Phaser dan dirapikan untuk deploy Vercel.

## Jalankan lokal (disarankan: Vercel CLI, biar frontend+backend jalan bareng)
```
npm install -g vercel   # kalau belum ada
npm install
pip install -r requirements.txt
vercel dev
```
Buka http://localhost:3000

## Jalankan manual (alternatif, 2 terminal terpisah)
Terminal 1 (frontend):
```
npm install
npm run dev
```
Terminal 2 (backend, untuk endpoint /api/*):
```
pip install -r requirements.txt
python api/index.py
```
Lalu set proxy di next.config.js (rewrites ke http://localhost:5328) kalau mau
kedua server jalan terpisah - atau langsung pakai `vercel dev` saja (lebih simpel).

## Deploy ke Vercel
Push ke GitHub lalu import project di Vercel seperti biasa. `vercel.json` sudah
mengatur build Next.js + Python API dalam satu project.

## Struktur
- `engine.py`, `test_engine.py` - logic game & AI (Minimax + Alpha-Beta), tidak berubah dari versi tim.
- `api/index.py` - Flask API, jadi serverless function Python di Vercel.
- `pages/`, `components/`, `styles/` - frontend Next.js + Phaser.
- `public/assets/` - placeholder sprite (vehicles.png, paving.png/paving_tile.png) dari referensi desain; ganti dengan hasil export Aseprite final.

## Yang masih placeholder
- Vehicle/obstacle di board digambar prosedural pakai Phaser Graphics (warna + bentuk sederhana), bukan sprite final. Begitu asset Aseprite jadi, tinggal load sebagai texture di `components/GameBoard.js` (ganti bagian `piecesLayer` graphics jadi `this.add.image(...)`).
- Tarif, jatah blok, formula obstacle sudah sesuai PRD tapi tetap kandidat untuk di-tuning saat playtest (lihat PRD.md poin 9).
