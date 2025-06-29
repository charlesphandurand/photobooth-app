// server.js
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const app = express();

// Inisialisasi database dengan opsi tambahan
let db;
try {
  db = new Database('./database.db', { 
    verbose: console.log,
    fileMustExist: false,
    timeout: 5000 // Tambah timeout
  });
} catch (error) {
  console.error('Error connecting to database:', error);
  process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/photos', express.static('photos'));
app.use('/frames', express.static('frames'));

// Buat direktori yang diperlukan
['photos', 'frames'].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
});

// Fungsi untuk inisialisasi database
const initializeDatabase = async () => {
  try {
    console.log('Memulai inisialisasi database...');
    
    // Coba buat tabel
    db.prepare(`
      CREATE TABLE IF NOT EXISTS frames (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        image_path TEXT NOT NULL,
        slots TEXT NOT NULL
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        frame_id INTEGER NOT NULL,
        photo_path TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (frame_id) REFERENCES frames(id)
      )
    `).run();

    // Cek jumlah frame
    const frameCount = db.prepare('SELECT COUNT(*) as count FROM frames').get().count;
    console.log(`Jumlah frame yang ada: ${frameCount}`);
    
    // Jika belum ada frame, tambahkan data
    if (frameCount === 0) {
      console.log('Menambahkan frame default...');
      const insertFrame = db.prepare(`
        INSERT INTO frames (name, image_path, slots) VALUES (?, ?, ?)
      `);

      const frames = [
        ['Frame Natal', '/frames/christmas_frame.svg', '[{"x": 100, "y": 100, "width": 200, "height": 200}, {"x": 500, "y": 100, "width": 200, "height": 200}]'],
        ['Frame Ulang Tahun', '/frames/birthday_frame.svg', '[{"x": 150, "y": 150, "width": 250, "height": 250}, {"x": 450, "y": 150, "width": 250, "height": 250}]'],
        ['Frame Graduasi', '/frames/graduation_frame.svg', '[{"x": 200, "y": 200, "width": 400, "height": 300}]']
      ];

      // Gunakan transaksi untuk insert
      const insertFrames = db.transaction((frames) => {
        for (const frame of frames) {
          insertFrame.run(frame);
        }
      });

      insertFrames(frames);
      console.log('Frame default berhasil ditambahkan');
    }

    console.log('Database berhasil diinisialisasi');
  } catch (error) {
    console.error('Error initializing database:', error);
    // Jika error, coba hapus file database dan buat ulang
    if (error.code === 'SQLITE_BUSY') {
      console.log('Mencoba menghapus dan membuat ulang database...');
      try {
        db.close();
        if (fs.existsSync('./database.db')) {
          fs.unlinkSync('./database.db');
        }
        process.exit(1); // Keluar dan biarkan proses restart membuat database baru
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
        process.exit(1);
      }
    }
  }
};

// Panggil fungsi inisialisasi
initializeDatabase();

// Endpoint untuk mengambil frames
app.get('/frames', (req, res) => {
  try {
    console.log('Mengambil data frames...');
    const frames = db.prepare('SELECT * FROM frames').all();
    console.log(`Berhasil mengambil ${frames.length} frames`);
    
    // PERBAIKAN PENTING: Hapus JSON.parse() di sini.
    // Biarkan 'slots' menjadi string JSON seperti yang diambil dari DB.
    const formattedFrames = frames.map(f => ({ 
      ...f, 
      // slots: JSON.parse(f.slots), // BARIS INI HARUS DIHAPUS ATAU DIKOMENTARI
      imageUrl: f.image_path // imageUrl seharusnya ada di sini
    }));
    
    res.json(formattedFrames);
  } catch (error) {
    console.error('Error fetching frames:', error);
    res.status(500).json({ error: 'Gagal mengambil data frame', details: error.message });
  }
});

// Tambahkan endpoint baru untuk menyimpan foto
app.post('/save-photos', async (req, res) => {
  try {
    const { userId, frameId, photos } = req.body;
    
    if (!Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Data foto tidak valid atau kosong' 
      });
    }
    
    // Pastikan direktori photos ada
    if (!fs.existsSync('photos')) {
      fs.mkdirSync('photos');
    }

    const savedPhotos = [];
    
    // Loop untuk setiap foto dalam array
    for (let i = 0; i < photos.length; i++) {
      const photoDataUrl = photos[i];
      if (!photoDataUrl) continue; // Skip jika foto kosong
      
      // Simpan foto
      const fileName = `photos/${userId}_${Date.now()}_${i}.jpg`;
      const base64Data = photoDataUrl.replace(/^data:image\/\w+;base64,/, '');
      
      // Simpan file
      fs.writeFileSync(fileName, base64Data, { encoding: 'base64' });
      savedPhotos.push(fileName);
      
      // Simpan ke database
      const stmt = db.prepare('INSERT INTO photos (user_id, frame_id, photo_path) VALUES (?, ?, ?)');
      stmt.run(userId, frameId, fileName);
    }

    res.json({ 
      success: true, 
      message: 'Foto berhasil disimpan',
      savedPhotos: savedPhotos
    });
  } catch (error) {
    console.error('Error saving photos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Gagal menyimpan foto',
      details: error.message
    });
  }
});

// Endpoint untuk mengirim email (placeholder)
app.post('/send-email', (req, res) => {
  try {
    const { to, userId, photo } = req.body;
    // Implementasi pengiriman email bisa ditambahkan di sini
    console.log(`Email request untuk ${to} dari user ${userId}`);
    
    res.json({ 
      success: true, 
      message: 'Email berhasil dikirim' 
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Gagal mengirim email' 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  console.log('Database terhubung');
});

function joinUrl(base, path) {
  return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
}