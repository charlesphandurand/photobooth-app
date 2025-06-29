// db.js - File untuk komunikasi dengan server SQLite
const API_URL = 'http://localhost:3001';

export const db = {
  async getFrames() {
    try {
      console.log('Mengambil frames dari server...');
      const response = await fetch(`${API_URL}/frames`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Berhasil mengambil ${data.length} frames`);
      return data;
    } catch (error) {
      console.error('Error fetching frames:', error);
      throw new Error(`Gagal mengambil frames: ${error.message}`);
    }
  },

  async savePhoto(userId, frameId, photos) {
    try {
      console.log('Menyimpan foto ke server...');
      const response = await fetch(`${API_URL}/save-photos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, frameId, photos }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Foto berhasil disimpan:', data);
      return data;
    } catch (error) {
      console.error('Error saving photo:', error);
      throw new Error(`Gagal menyimpan foto: ${error.message}`);
    }
  },

  async sendEmail(to, userId, photoDataUrl) {
    try {
      console.log('Mengirim email...');
      const response = await fetch(`${API_URL}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to, userId, photo: photoDataUrl }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Email berhasil dikirim:', data);
      return data;
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error(`Gagal mengirim email: ${error.message}`);
    }
  },

  async checkHealth() {
    try {
      const response = await fetch(`${API_URL}/health`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error checking server health:', error);
      throw new Error(`Server tidak tersedia: ${error.message}`);
    }
  }
};