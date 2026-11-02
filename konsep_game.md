# PRD - Parking Domineering (Working Title)
Proyek KKA - Implementasi Adversarial Search (Minimax + Alpha-Beta Pruning)
Progress deadline: Selasa, 3 November 2026

## 1. Konsep Dasar
Board game turn-based di papan grid n x n, terinspirasi dari **Domineering**, dengan dua agent yang bergantian menaruh blok kendaraan di papan. Agent 1 wajib menaruh blok secara **vertikal**, Agent 2 wajib **horizontal**. Game berakhir ketika kedua agent sudah tidak punya langkah valid, dan pemenang ditentukan dari total tarif terbesar.

## 2. Mode Permainan
- Player vs Agent (prioritas progress saat ini)
- Agent vs Agent (prioritas progress saat ini)
- Player vs Player (pengembangan lanjutan, belum sekarang)

## 3. Papan & Aturan Dasar
- Papan grid n x n (ukuran final TBD, perlu dites biar seimbang antara kompleksitas game tree vs performa minimax).
- Giliran bergantian, Agent 1 = vertikal, Agent 2 = horizontal.
- Kalau giliran seorang agent tidak ada posisi valid untuk ditaruh, giliran **skip** ke agent lawan (bukan game over).
- Game berakhir saat **kedua agent** sudah tidak bisa menaruh blok sama sekali.
- Pemenang = agent dengan **total tarif kendaraan yang berhasil ditaruh** terbesar.

## 4. Tipe Blok/Objek
| Objek | Ukuran | Sifat | Tarif |
|---|---|---|---|
| Motor | 1x2 / 2x1 | Ditaruh sesuai orientasi agent | TBD |
| Mobil | 1x3 / 3x1 | Ditaruh sesuai orientasi agent | TBD |
| Ban bekas (obstacle) | 1x1 | Spawn random di awal, **tidak bisa ditaruh kendaraan di atasnya**, bukan milik agent manapun | - |

Catatan: ukuran blok tambahan (mis. bus 2x3/3x2) bisa ditambahkan sebagai pengembangan v2 setelah mode dasar (motor+mobil) stabil - supaya scope progress sekarang tidak melebar dulu.

## 5. Pembagian Blok (Draft System)
- Setiap agent mendapat jatah total blok yang **sama rata** per tipe (jumlah persis per tipe: TBD, perlu disepakati tim).
- Agent/player bebas memilih urutan pemakaian blok dari jatahnya sendiri (tidak harus pakai yang kecil dulu atau besar dulu).
- Jatah blok ditampilkan di UI (sisa stok per tipe) selama permainan.

## 6. Obstacle (Ban Bekas)
- Spawn random di papan sebelum game dimulai.
- Fungsi ganda: menghalangi penempatan blok di sel tersebut, dan **dirancang agar mengurangi kemungkinan hasil akhir seri (tie)** - misal lewat jumlah/posisi yang membuat luas area efektif kedua sisi tidak simetris.
- Detail algoritma penempatan obstacle (full random vs random-dengan-constraint anti-tie): perlu dirancang & diuji, bisa jadi bagian eksperimen di laporan.

## 7. Desain Algoritma (Adversarial Search)
**State representation:**
- Status papan (kosong/terisi/obstacle, dan milik agent mana kalau terisi)
- Sisa jatah blok per tipe untuk masing-masing agent
- Giliran (vertikal/horizontal)

**Successor function:**
Kombinasi (tipe blok yang jatahnya masih ada) x (semua posisi valid di papan sesuai orientasi agent). Kalau tidak ada kombinasi valid -> skip giliran.

**Terminal state:**
Kedua agent sama-sama tidak punya langkah valid.

**Utility function:**
`total tarif Agent 1 (vertikal) - total tarif Agent 2 (horizontal)`
Agent 1 memaksimalkan nilai ini, Agent 2 meminimalkan (zero-sum, standar minimax).

**Algoritma:**
- Minimax sebagai basis.
- Alpha-Beta Pruning untuk efisiensi pencarian.
- Karena jatah blok terbatas & papan finite, game tree pada dasarnya terbatas - perlu dites apakah full-depth search ke terminal state masih feasible untuk ukuran papan yang dipilih. Kalau papan terlalu besar/branching factor terlalu tinggi, baru ditambahkan depth-limited search + evaluation function (heuristik: proyeksi sisa tarif yang masih bisa diraih, dsb).
- Opsional (nilai tambah laporan): move ordering untuk memaksimalkan efektivitas pruning.

## 8. Tech Stack
- **Algoritma AI**: Python (wajib, sesuai arahan dosen).
- **Deploy**: Web, rencana via Vercel.
- **Asset**: pixel art custom, dibuat pakai Aseprite.
- Arsitektur backend-frontend (Python API <-> web frontend) menyesuaikan setelah detail lebih lanjut.

## 9. Open Questions (perlu disepakati tim)
- Tema final: parkir (motor/mobil/ban bekas + tarif rupiah) vs tema board game lain - keputusan tim.
- Ukuran papan (n x n) final.
- Jumlah jatah tiap tipe blok per agent.
- Nilai tarif tiap tipe kendaraan.
- Mekanisme & constraint penempatan obstacle anti-tie.
- Apakah perlu depth-limit + evaluation function, atau full search cukup (tergantung hasil tes ukuran papan).

## 10. Daftar Pustaka (draft)
1. Russell, S., & Norvig, P. (2021). *Artificial Intelligence: A Modern Approach* (4th ed.), Bab Adversarial Search and Games - Pearson.
2. Materi kuliah Adversarial Search (slide mata kuliah KKA).
3. Referensi game Domineering (combinatorial game theory) sebagai basis konsep.
