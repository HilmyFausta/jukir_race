# PRD - Jukir Race (Final, 3 November 2026)
Proyek KKA - Implementasi Adversarial Search (Minimax + Alpha-Beta Pruning)

> Dokumen ini menggantikan seluruh PRD sebelumnya. Konsep lama (tarif/poin, jatah blok, orientasi tetap
> vertikal/horizontal per agent) sudah ditinggalkan. Aturan yang berlaku adalah normal play.

## 1. Ringkasan
Board game turn-based bertema parkiran. Dua jukir sekaligus maskot, **Indoapril (biru)** dan **Betamart (merah)**,
bergantian menaruh kendaraan di papan n x n. Jukir yang **tidak bisa menaruh kendaraan apa pun saat gilirannya kalah**.
Terinspirasi dari Domineering, dengan bidak berukuran beragam dan orientasi bebas.

## 2. Aturan Final
1. Papan **n x n** (kotak), n bebas dipilih pemain. Rentang yang didukung UI: 3 sampai 8 (default 6).
2. **Obstacle (ban bekas) 1x1** disebar acak di awal, jumlah 1 sampai n (tidak melebihi n). Obstacle tidak bisa ditimpa kendaraan.
   Awal permainan selalu dijamin masih ada langkah sah.
3. Bidak: **motor 1x2 / 2x1** dan **mobil 1x3 / 3x1**. Pemain bebas memilih ukuran dan orientasi (vertikal/horizontal) tiap giliran.
4. Jumlah bidak **unlimited** (boleh spam mobil 1x3 sejak awal). Tidak ada jatah, tidak ada tarif/poin.
5. Bidak tidak boleh tumpang tindih dan tidak boleh keluar papan.
6. Pemain bergantian. Indoapril (P1, biru) jalan duluan, Betamart (P2, merah) kedua.
7. **Kondisi kalah:** pemain yang pada gilirannya tidak bisa menaruh bidak apa pun kalah; lawannya menang. Tidak ada skip, tidak ada seri.
   (Karena mobil 1x3 selalu memuat 1x2, kondisi ini sama dengan "tidak ada dua petak kosong yang bersebelahan".)

## 3. Mode Permainan
| Mode | Keterangan |
|---|---|
| AI vs AI | Dua AI beradu, ada tombol Jeda/Lanjut. Cocok untuk demo dan melihat statistik pemangkasan. |
| Player vs AI | Pemain memilih jadi Indoapril (jalan duluan) atau Betamart. Ada level AI: Mudah / Sedang / Sulit. |
| Player vs Player | Dua manusia bergantian di satu device yang sama (bukan multiplayer online). |

## 4. Alur UI (HP dan laptop sama)
1. **Layar judul** - Logo Jukir Race, latar split biru vs merah bergaya pixel art dengan tulisan **VS**, maskot Indoapril (kiri) dan Betamart (kanan) muncul
   dengan animasi (.gif), tombol **PLAY**.
2. **Layar pilihan** - Pilih mode (AI vs AI / Player vs AI / Player vs Player), ukuran arena n x n (3-8), serta (jika ada AI) sisi yang dimainkan dan level AI.
3. **Layar game**
   - Papan paving (Phaser). Obstacle berupa ban, kendaraan berwarna sesuai pemilik: **Indoapril = biru, Betamart = merah**.
   - **Palet kendaraan** menampilkan keempat bentuk (motor 2x1, motor 1x2, mobil 3x1, mobil 1x3) dengan warna pemain yang sedang jalan.
   - **Preview bayangan abu-abu** saat menaruh (merah bila posisi tidak valid).
     - Laptop: arahkan kursor lalu klik. Tombol **R** memutar orientasi.
     - HP: tap petak untuk memunculkan bayangan, lalu tap bayangan itu lagi atau tombol **TARUH DI SINI** untuk konfirmasi.
   - Kartu pemain (maskot beranimasi saat gilirannya), jumlah kendaraan, dan panel statistik AI (kedalaman, jumlah node, pemangkasan, waktu).
4. **Layar menang** - Muncul "**X MENANG!**" beserta karakter pemenang, tombol Main Lagi dan Menu.

## 5. Asset
| Asset | File | Keterangan |
|---|---|---|
| Logo | `public/assets/logo.png` | 512x512 |
| Ban (obstacle) | `public/assets/ban.png` | 64x64 |
| Motor / Mobil | `public/assets/sprites/{motor,mobil}_{blue,red}_{v,h}.png` | 64 px per petak. Asli dari tim: biru vertikal dan merah horizontal. Varian lainnya dibuat dengan rotasi 90 derajat. |
| Bayangan | `public/assets/sprites/shadow_*_{ok,bad}.png` | Siluet abu-abu (valid) / merah (tidak valid), dibuat otomatis dari sprite |
| Maskot | `public/assets/char/{indoapril,betamart}.gif` dan `*_put.png` | gif 2 frame untuk animasi, png untuk pose diam |
| Paving | `public/assets/paving_tile.png` | Tile berulang, 1 tile = 2x2 petak |

Catatan: sprite varian rotasi bisa diganti kapan saja dengan hasil gambar ulang di Aseprite selama nama file dan ukurannya sama.

## 6. Algoritma Adversarial Search (Python)
Basis: `reference/ubin_simetri_lama.py` (partner), diadaptasi ke `engine.py` agar stateless lewat API.

- **State**: bitmask papan (bit i = petak terisi, termasuk obstacle), kandidat langkah = semua penempatan bidak (h, w, r, c) yang tidak beririsan dengan mask.
- **Successor**: semua penempatan 1x2, 2x1, 1x3, 3x1 yang muat (bidak besar dicoba dulu untuk ordering).
- **Terminal**: pemain yang jalan tidak punya langkah -> kalah. Nilai `-1000 - d` (semakin dangkal semakin buruk bagi yang kalah).
- **Utility / evaluasi**: minimax dalam bentuk **negamax**; nilai posisi dari sudut pandang pemain yang jalan.
  Pada batas kedalaman (d = 0) nilai = 0 (belum diketahui). |nilai| >= 1000 berarti hasil sudah pasti (menang/kalah dipaksa).
- **Alpha-Beta Pruning** wajib dipakai.
- **Tabel transposisi** (kunci = bitmask) dengan flag exact / lower / upper.
- **Iterative deepening** dengan move ordering (langkah terbaik iterasi sebelumnya dicoba duluan).
- **Batas simpul dan waktu** (default 400.000 node, 1-4 detik sesuai level) agar aman di serverless; hasil iterasi terakhir yang selesai dipakai.
- **Strategi cermin 180 derajat** (opsional, `mirror=true` di API): bila papan sebelum langkah lawan simetris, balas dengan bayangannya.
- **Level AI**: Mudah (depth 2, 1 dtk), Sedang (depth 4, 2,5 dtk), Sulit (depth 10, 4 dtk).
- Pada papan kecil (sampai sekitar 5x5) pencarian bisa sampai akhir permainan; pada papan besar hasilnya "belum terselesaikan" dan memakai depth-limit.

Catatan hubungan ke materi: depth-limited search + nilai taksiran di batas kedalaman, alpha-beta pruning, move ordering, dan tabel transposisi
(menghindari penghitungan ulang posisi yang sama).

## 7. Arsitektur dan Tech Stack
- **Frontend:** Next.js (Pages Router) + React, papan dirender **Phaser 3** (pixel art, skala FIT agar responsif). Input papan memakai Pointer Events native
  (membedakan mouse dan sentuh dengan benar - menghindari bug mobile di mana tap sentuh ikut memicu event mouse).
- **Backend AI:** Python (Flask) sebagai serverless function di Vercel (`@vercel/python`), satu project dengan frontend lewat `vercel.json`.
- **Logika giliran** (validasi langkah manusia, deteksi menang/kalah) dijalankan di client agar instan; **AI dijalankan di server (Python)**.
  Bila backend tidak terjangkau, game tetap jalan dengan rintangan lokal dan langkah acak sementara untuk AI.

### API
| Endpoint | Body | Respons |
|---|---|---|
| `POST /api/game/new` | `{n, symmetric?}` | `{n, obstacles:[idx], pieces:[], turn:0}` |
| `POST /api/game/ai-move` | `{state:{n,obstacles,pieces,turn}, depth, time_limit, mirror?}` | `{move:{r,c,h,w}, info:{strategy,depth,nodes,cuts,ms,result}}` |
| `GET /api/health` | - | `{ok:true}` |

Format `pieces`: `[{r, c, h, w, p}]` dengan `p` = 0 (Indoapril) atau 1 (Betamart). Obstacle dikodekan sebagai indeks petak `r*n + c`.

## 8. Struktur Repo
```
engine.py              # solver + generator obstacle
api/index.py           # Flask API (Vercel Python function)
lib/game.js            # logika client (validasi, menang/kalah, fallback)
components/            # TitleScreen, SetupScreen, GameScreen, Board (Phaser)
pages/                 # index.js (title -> setup -> game), _app.js
styles/globals.css     # tema pixel
public/assets/         # logo, sprite, maskot, paving
tests/test_engine.py   # unit test engine
reference/             # ubin_simetri.py (poin), ubin_simetri_lama.py (normal play) dari partner
```

## 9. Status
- [x] Engine Python (negamax + alpha-beta + TT + iterative deepening + cermin) dan unit test
- [x] API Flask
- [x] Alur UI 4 layar, tiga mode, preview bayangan, layar menang dengan maskot
- [x] Perbaikan input mobile (Pointer Events)
- [ ] Gambar ulang sprite varian rotasi di Aseprite (opsional)
- [ ] Efek suara / musik (opsional)
- [ ] Papan non-persegi, multiplayer online (di luar scope)

## 10. Rencana Uji
- `python -m unittest tests/test_engine.py` (generator obstacle <= n, AI selalu memilih langkah sah, mirror, game selesai).
- Manual: tiga mode di laptop dan HP; pastikan tap pertama di HP hanya memunculkan bayangan, game berakhir dengan layar menang yang benar.
- Eksperimen laporan: bandingkan jumlah node dengan/tanpa pemangkasan (kolom `nodes` dan `cuts` pada `info`).

## 11. Daftar Pustaka
1. Russell, S., & Norvig, P. (2021). *Artificial Intelligence: A Modern Approach* (4th ed.), Bab Adversarial Search and Games. Pearson.
2. Materi kuliah Adversarial Search (slide mata kuliah KKA).
3. Referensi game Domineering (combinatorial game theory) sebagai basis konsep.
