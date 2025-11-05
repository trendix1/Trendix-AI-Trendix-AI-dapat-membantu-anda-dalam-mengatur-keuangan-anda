AI Keuangan Advanced — Paket Static (Client-side Heavy)
=========================================================

Isi paket:
- index.html   -> Halaman utama
- style.css    -> Styling (Dark & Bright themes)
- ai.js        -> TensorFlow.js AI logic, training & persistence (IndexedDB)
- app.js       -> UI glue, charts (Chart.js), storage, wishlist, settings
- README.md    -> Berkas ini

Fitur utama:
- Dua tema: Dark Elegan + Bright Ceria (user dapat switch & simpan preferensi)
- Input penghasilan, tabungan, wishlist item (user bisa masukkan harga nyata)
- Transaksi: AI belajar dari transaksi yang ditambahkan; data disimpan lokal
- TensorFlow.js: model ringan yang dapat dilatih di browser dan disimpan ke IndexedDB
- Chart.js: visualisasi alokasi dan histori pengeluaran
- Pengaturan: auto-train, confidence threshold, default theme
- Dirancang untuk penggunaan publik (client-side). Jika butuh penyimpanan terpusat, perlu backend.

Deploy ke GitHub Pages:
1. Extract semua file ke folder repo. Pastikan index.html ada di root atau folder docs/.
2. Commit & push. Aktifkan GitHub Pages via Settings -> Pages.
3. Aplikasi akan dapat diakses publik (model tetap disimpan pada browser tiap user).

Catatan teknis & privasi:
- Semua data tersimpan lokal (LocalStorage/IndexedDB). Pengguna harus diberi pilihan ekspor/back-up.
- TensorFlow.js dimuat dari CDN. Pastikan koneksi internet waktu pertama load.
- Jika Anda ingin fitur sinkronisasi account & server, saya bisa bantu buatkan backend (Flask/Node + database).

