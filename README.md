# Jukir Race

Game KKA (Adversarial Search): Indoapril vs Betamart. Next.js + Phaser (frontend), Python/Flask (AI minimax + alpha-beta) di Vercel.
Aturan dan arsitektur lengkap ada di `PRD.md`.

## Jalankan lokal
Cara paling gampang (frontend + backend jalan bareng seperti di production):
```
npm install
pip install -r requirements.txt      # aktifkan .venv dulu
npm install -g vercel                # sekali saja
vercel dev                           # buka http://localhost:3000
```
Alternatif 2 terminal:
```
# terminal 1
pip install -r requirements.txt && python api/index.py     # Flask di :5328
# terminal 2
npm install && npm run dev                                  # /api/* otomatis di-proxy ke :5328 (lihat next.config.js)
```

## Tes engine
```
python -m unittest tests/test_engine.py
```

## Deploy
Push ke GitHub; project Vercel yang sudah tersambung akan build otomatis (`vercel.json` mengatur Next.js + Python).

## Catatan migrasi dari versi sebelumnya
File yang sudah tidak dipakai dan boleh dihapus dari repo: `konsep_game.md`, `index.html` (lama), `public/assets/vehicles.png`, `public/assets/paving.png`.
