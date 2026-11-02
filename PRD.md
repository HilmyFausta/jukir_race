# PRD - Jukir Race (Production Ready)
Proyek KKA - Implementasi Adversarial Search (Minimax + Alpha-Beta Pruning)
Progress deadline: Selasa, 3 November 2026

## 1. Overview
Board game turn-based bertema parkiran minimarket. Dua jukir (agent) bergantian menaruh kendaraan di papan grid custom a x b. Agent Vertikal menaruh blok vertikal, Agent Horizontal menaruh blok horizontal. Pemenang = total tarif parkir terbesar saat game berakhir.

> Nama brand yang dipakai ("IndoPark"/"AlfaPark") adalah parodi, bukan merek dagang asli, untuk menghindari isu hak cipta/merek saat di-deploy publik/dipresentasikan.

## 2. Aturan Final
- Papan grid custom a x b. Default v1: 6 x 6.
- Agent Vertikal (biru) vs Agent Horizontal (merah).
- Giliran bergantian; kalau tidak ada posisi valid, skip ke lawan.
- Game berakhir saat kedua agent tidak punya langkah valid sama sekali.
- Pemenang = tarif total terbesar. Tie-break: jumlah unit kendaraan terpasang lebih banyak. Kalau masih sama, hasil seri.

## 3. Objek & Tarif
Tarif = Rp1.000 per petak luas.

| Objek | Ukuran | Tarif | Orientasi |
|---|---|---|---|
| Motor | 1x2 / 2x1 | Rp2.000 | Sesuai agent |
| Mobil | 1x3 / 3x1 | Rp3.000 | Sesuai agent |
| Ban bekas (obstacle) | 1x1 | - | Netral, tidak bisa ditimpa |

## 4. Jatah Blok Default
Formula umum (per agent): `jatah_motor = round(0.17 * total_petak)`, `jatah_mobil = round(0.11 * total_petak)`, `obstacle = max(2, round(0.10 * total_petak))`.
Untuk 6x6 (36 petak): motor 6, mobil 4 per agent, obstacle 4.

## 5. Obstacle Anti-Tie
Spawn random di petak kosong, lalu dicek simetri terhadap sumbu vertikal/horizontal papan - kalau simetris, satu obstacle di-reroll ke posisi lain. Tie-break rule di poin 2 jadi jaring pengaman terakhir.

## 6. Algoritma Adversarial Search
- State: board cells (kosong/obstacle/terisi+owner+type), sisa jatah blok per agent, giliran.
- Successor function: kombinasi (tipe blok berjatah > 0) x (posisi valid sesuai orientasi).
- Terminal: dua skip berturut-turut (kedua sisi stuck).
- Utility: `tarif[V] - tarif[H]`, V maksimalkan, H minimalkan.
- Alpha-Beta Pruning wajib dipakai (branching factor terlalu besar untuk full minimax polos). Depth-limited, default depth 4 (3 untuk board >= 9x9).
- Evaluation function: `(tarif[V]-tarif[H]) + 0.5 * (potensi[V]-potensi[H])`, potensi = sisa jatah x tarif per tipe.

## 7. Tech Stack
- Frontend: Next.js (React) + Phaser untuk render board paving + sprite, responsive HP/laptop.
- Backend AI: Python (Flask) sebagai serverless function di Vercel (`@vercel/python`), satu project deploy dengan frontend lewat `vercel.json`.
- Asset: pixel art final rencana pakai Aseprite; placeholder saat ini ada di `/public/assets`.

## 8. Mode Permainan
- Player vs Agent, Agent vs Agent (prioritas saat ini)
- Player vs Player - lokal satu device (bukan multiplayer online)

## 9. Status Implementasi (baseline ini)
- [x] Engine Python (minimax + alpha-beta + evaluation function) - `engine.py`
- [x] API Flask (`/api/game/new`, `/api/game/move`, `/api/game/ai-move`) - `api/index.py`
- [x] Frontend Next.js + Phaser (board paving + piece rendering, 3 mode, panel tarif/jatah)
- [ ] Asset pixel art final (Aseprite) - masih placeholder prosedural
- [ ] Playtest & balancing (depth, weight evaluation function, jumlah obstacle)

## 10. Daftar Pustaka
1. Russell, S., & Norvig, P. (2021). *Artificial Intelligence: A Modern Approach* (4th ed.), Bab Adversarial Search and Games - Pearson.
2. Materi kuliah Adversarial Search (slide mata kuliah KKA).
3. Referensi game Domineering (combinatorial game theory) sebagai basis konsep.
