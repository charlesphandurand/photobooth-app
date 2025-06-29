# Photobooth App

Aplikasi photobooth modern yang menggunakan React untuk frontend dan SQLite untuk backend.

## Fitur

- 📸 Sesi foto dengan webcam
- 🖼️ Pilihan frame yang menarik
- 💾 Penyimpanan foto ke database SQLite
- 📧 Pengiriman foto via email
- 🎨 UI yang modern dan responsif
- ⏱️ Timer sesi foto

## Teknologi yang Digunakan

- **Frontend**: React 19, Tailwind CSS
- **Backend**: Node.js, Express.js
- **Database**: SQLite dengan better-sqlite3
- **Webcam**: react-webcam

## Instalasi

1. Clone repository ini
2. Install dependencies:
   ```bash
   npm install
   ```

## Menjalankan Aplikasi

### Cara 1: Menjalankan Server dan Aplikasi Secara Bersamaan
```bash
npm run dev
```

### Cara 2: Menjalankan Secara Terpisah

1. Jalankan server backend:
   ```bash
   npm run server
   ```

2. Di terminal terpisah, jalankan aplikasi React:
   ```bash
   npm start
   ```

## Struktur Aplikasi

- `server.js` - Server Express dengan SQLite
- `src/App.js` - Komponen utama React
- `src/db.js` - Fungsi untuk komunikasi dengan server
- `database.db` - Database SQLite
- `frames/` - Direktori frame gambar
- `photos/` - Direktori penyimpanan foto

## Endpoint API

- `GET /frames` - Mengambil daftar frame
- `POST /save-photos` - Menyimpan foto
- `POST /send-email` - Mengirim email
- `GET /health` - Health check server

## Troubleshooting

### Masalah "Tidak ada frame yang tersedia"

1. Pastikan server berjalan di port 3001
2. Cek apakah database terinisialisasi dengan benar
3. Pastikan file frame ada di direktori `frames/`
4. Restart server jika diperlukan

### Masalah Koneksi Database

1. Pastikan tidak ada proses lain yang menggunakan database
2. Hapus file `database.db` dan restart server untuk membuat ulang
3. Cek permission file dan direktori

## Pengembangan

Untuk pengembangan lebih lanjut:

1. Tambahkan frame baru di direktori `frames/`
2. Update data frame di `server.js`
3. Modifikasi UI di `src/App.js`
4. Tambahkan fitur baru sesuai kebutuhan

## Lisensi

MIT License
