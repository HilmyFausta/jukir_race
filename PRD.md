# PRD - Jukir Race (Production Ready)
Proyek KKA - Implementasi Adversarial Search (Minimax + Alpha-Beta Pruning)
Progress deadline: Selasa, 3 November 2026

## 1. Overview
Board game turn-based bertema parkiran minimarket. Dua jukir (agent) bergantian menaruh kendaraan di papan grid custom a x b. Agent Vertikal menaruh blok vertikal, Agent Horizontal menaruh blok horizontal. Pemenang = total tarif parkir terbesar saat game berakhir.

> **Catatan penting:** gunakan nama parodi, bukan merek dagang asli, untuk menghindari isu hak cipta/merek saat di-deploy publik/dipresentasikan. Saran: **"IndoPark" (biru)** vs **"AlfaPark" (merah)**, terinspirasi dari minimarket umum tanpa memakai logo/nama asli.

## 2. Aturan Final
- Papan grid custom **a x b**. Default v1: **6 x 6**.
- Agent Vertikal (biru) vs Agent Horizontal (merah).
- Giliran bergantian; kalau tidak ada posisi valid, **skip** ke lawan.
- Game berakhir saat **kedua** agent tidak punya langkah valid sama sekali (cek setiap akhir giliran: apakah lawan berikutnya juga stuck).
- Pemenang = tarif total terbesar. Kalau tarif sama persis → **tie-break**: agent dengan jumlah unit kendaraan terpasang lebih banyak menang. Kalau masih sama → hasil dinyatakan seri (tie total elimination tidak digaransi matematis, tapi obstacle anti-tie di poin 6 meminimalkan kemungkinan ini).

## 3. Objek & Tarif (fix)
Tarif = **Rp1.000 per petak luas**.

| Objek | Ukuran | Tarif | Orientasi |
|---|---|---|---|
| Motor | 1x2 / 2x1 | Rp2.000 | Sesuai agent |
| Mobil | 1x3 / 3x1 | Rp3.000 | Sesuai agent |
| Ban bekas (obstacle) | 1x1 | - | Netral, tidak bisa ditimpa |

## 4. Jatah Blok Default (board 6x6 = 36 petak)
| Agent | Motor | Mobil | Potensi tarif maksimum |
|---|---|---|---|
| Vertikal | 3 | 2 | 3x2000 + 2x3000 = Rp12.000 |
| Horizontal | 3 | 2 | Rp12.000 |

- Total petak terpakai kalau semua blok termuat: (3x2 + 2x3) x 2 agent = 24 petak dari 36.
- Obstacle: **round(10% total petak), minimum 2** → 6x6 = 4 obstacle.
- Sisa 8 petak jadi buffer kosong/area yang mungkin tidak terjangkau karena constraint orientasi - ini bikin permainan tetap strategis (tidak semua kuota pasti termuat).
- Formula ini general untuk custom a x b: `jatah_motor = round(0.17 * total_petak)`, `jatah_mobil = round(0.11 * total_petak)` per agent (hasil pembulatan dari rasio 6x6 di atas), `obstacle = max(2, round(0.10 * total_petak))`.

## 5. Obstacle Anti-Tie
- Spawn random di petak kosong sebelum game mulai, sejumlah formula poin 4.
- Mekanisme pengurang kemungkinan tie: distribusi obstacle dibuat **tidak simetris** terhadap sumbu vertikal/horizontal papan (hindari placement yang mirror sempurna), supaya ruang gerak kedua agent tidak identik. Implementasi sederhana: setelah random placement, cek apakah pola obstacle simetris terhadap axis tengah - kalau ya, re-roll satu obstacle ke posisi lain.
- Tie-break rule di poin 2 adalah jaring pengaman kalau tetap terjadi tie.

## 6. Tema Visual
**Board/grid:** sistem paving (lihat referensi gambar 8x8 yang dikirim) - 1 tile paving dasar di-tile berulang sesuai ukuran a x b, bukan asset terpisah per ukuran papan. Render sebagai background layer terpisah dari layer piece.

**Vehicle sprites (placeholder, sesuai referensi gambar yang dikirim):**
| Asset | Warna Agent Vertikal | Warna Agent Horizontal |
|---|---|---|
| Motor | Biru | Merah |
| Mobil | Biru | Merah |
| Obstacle (ban bekas) | Abu-abu (netral, 1 sprite shared) | - |

- Sprite referensi digambar menghadap horizontal secara default → untuk Agent Vertikal, **rotasi 90 derajat saat render** (transform di layer game, bukan bikin asset terpisah per orientasi). Hemat produksi asset di tahap awal.

**Latar luar grid:** tema minimarket parodi (IndoPark vs AlfaPark), masing-masing sisi papan dikasih elemen dekoratif warna brand (biru/merah) sebagai storefront kecil di kiri-kanan papan.

## 7. State Model (contoh struktur data)
```json
{
  "board": {
    "width": 6,
    "height": 6,
    "cells": [
      "EMPTY",
      "OBSTACLE",
      {"type": "MOTOR", "owner": "V", "pieceId": "v-motor-1"}
    ]
  },
  "turn": "V",
  "quota": {
    "V": {"motor": 3, "mobil": 2},
    "H": {"motor": 3, "mobil": 2}
  },
  "tarif": {"V": 0, "H": 0},
  "consecutiveSkips": 0
}
```
`consecutiveSkips == 2` berturut-turut = game over (kedua sisi stuck).

## 8. Algoritma Adversarial Search
**Successor function:** kombinasi (tipe blok dgn jatah > 0) x (posisi valid sesuai orientasi agent, cek bounds + cell kosong semua).

**Terminal state:** `consecutiveSkips >= 2`.

**Utility function:** `tarif[V] - tarif[H]`, V maksimalkan, H minimalkan.

**Kebutuhan depth-limit (wajib, bukan opsional):** branching factor di awal game besar (motor+mobil x puluhan posisi valid, bisa 40-60+ pilihan di giliran pertama pada board 6x6). Dengan total piece ~24-28 ply, full minimax **tidak feasible** real-time. Jadi:
- **Alpha-Beta Pruning wajib dipakai dari awal**, bukan opsi tambahan belakangan.
- **Depth-limited search**, default depth = 4 ply (2 giliran penuh ke depan), configurable.
- **Evaluation function** untuk non-terminal node di batas depth:
  ```
  eval(state) = (tarif[V] - tarif[H]) + 0.5 * (potensi[V] - potensi[H])
  potensi[agent] = quota[agent].motor * 2000 + quota[agent].mobil * 3000
  ```
  (0.5 = weight, karena potensi belum tentu semua termuat - bisa di-tuning saat playtest).
- **Opsional/nice-to-have untuk laporan:** move ordering (coba posisi/blok bernilai tarif besar duluan) dan iterative deepening dengan time-cutoff (relevan untuk mode real-time/responsif saat lawan Agent vs Agent).

## 9. API Contract (Python serverless di Vercel)
| Endpoint | Method | Body | Return |
|---|---|---|---|
| `/api/game/new` | POST | `{width, height, mode}` | initial state (poin 7) |
| `/api/game/move` | POST | `{state, pieceType, x, y}` | state baru (validasi manual oleh human player) |
| `/api/game/ai-move` | POST | `{state, depth?}` | `{move, newState, nodesEvaluated}` (nodesEvaluated berguna buat data di laporan efek pruning) |

## 10. Tech Stack
- Frontend: Next.js (React) + Phaser untuk render board paving, sprite, animasi, responsive HP/laptop.
- Backend AI: Python sebagai serverless function (`@vercel/python`), satu project deploy dengan frontend.
- Asset production: Aseprite (pixel art final), Canva (moodboard), Figma (wireframe, export SVG).

## 11. Sprint Plan
1. **Core logic (Python):** state model, successor function, minimax+alpha-beta+depth-limit+eval function, test via script/CLI.
2. **Wireframe + scaffold:** Figma wireframe → scaffold Next.js+Phaser, board placeholder (bisa pakai sprite referensi dari gambar yang sudah dikirim), wiring ke API Python end-to-end.
3. **Asset integrasi:** sprite Aseprite final (gantikan placeholder) + paving tile board.
4. **Polish:** homescreen, judul, animasi, tema IndoPark vs AlfaPark, testing responsive.
5. **Balancing & playtest:** tuning weight evaluation function, depth default, jatah blok, obstacle anti-tie, ambil data nodesEvaluated (minimax polos vs alpha-beta) untuk laporan.

## 12. Sisa Open Question (minor)
- Nilai depth default final (4 sebagai starting point, perlu dites performa).
- Weight 0.5 di evaluation function (perlu playtest-tuning).
- Ukuran tile paving (px) final mengikuti asset Aseprite final.

## 13. Daftar Pustaka
1. Russell, S., & Norvig, P. (2021). *Artificial Intelligence: A Modern Approach* (4th ed.), Bab Adversarial Search and Games - Pearson.
2. Materi kuliah Adversarial Search (slide mata kuliah KKA).
3. Referensi game Domineering (combinatorial game theory) sebagai basis konsep.
