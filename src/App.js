import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, onSnapshot, updateDoc } from 'firebase/firestore';
// Perhatikan bahwa 'query' dan 'getDocs' telah dihapus dari import terakhir karena tidak digunakan langsung di AppProvider.

// ==========================================================
// PENTING: Ubah konfigurasi Firebase Anda di bawah ini!
// Ganti nilai PASTE_YOUR_... dengan detail proyek Firebase Anda.
// (Anda sudah mendapatkan ini dari Firebase Console)
// ==========================================================
const firebaseConfig = {
  apiKey: "AIzaSyC2gp3HfULCYeFbNzAuMSNxH4TMuR-V3zg",
  authDomain: "photobooth-a2f3e.firebaseapp.com",
  projectId: "photobooth-a2f3e",
  storageBucket: "photobooth-a2f3e.firebasestorage.app",
  messagingSenderId: "240496851594",
  appId: "1:240496851594:web:5b9cc8827eba5e561d0b73",
  measurementId: "G-6N8QGB4TGV"
};

// Gunakan projectId sebagai appId untuk Firestore path
const appId = firebaseConfig.projectId;
// initialAuthToken tidak diperlukan untuk development lokal biasa
const initialAuthToken = null;

// Context untuk menyediakan state aplikasi ke seluruh komponen
const AppContext = createContext();

const AppProvider = ({ children }) => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('boarding'); // boarding, tutorial, menu, frameSelection, photoSession, finalPreview
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionEndTime, setSessionEndTime] = useState(null);
  const [frames, setFrames] = useState([]);
  const [printCount, setPrintCount] = useState(0); // Untuk melacak jumlah cetak per sesi/pengguna
  const [emailSent, setEmailSent] = useState(false); // Untuk melacak apakah email sudah terkirim

  // Inisialisasi Firebase dan autentikasi
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const authentication = getAuth(app);

      setDb(firestore);
      setAuth(authentication);

      // Listener untuk perubahan status autentikasi
      const unsubscribe = onAuthStateChanged(authentication, async (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          // Jika tidak ada user, coba sign in dengan custom token atau secara anonim
          try {
            if (initialAuthToken) {
              await signInWithCustomToken(authentication, initialAuthToken);
            } else {
              await signInAnonymously(authentication);
            }
          } catch (error) {
            console.error("Error signing in:", error);
            // Fallback to random ID if authentication fails
            setUserId(crypto.randomUUID());
          }
        }
        setIsAuthReady(true); // Autentikasi siap
      });

      return () => unsubscribe(); // Cleanup listener
    } catch (error) {
      console.error("Failed to initialize Firebase:", error);
      setIsAuthReady(true); // Pastikan state siap meskipun ada error
      setUserId(crypto.randomUUID()); // Set ID acak sebagai fallback
    }
  }, []);

  // Memuat data frame dari Firestore setelah Firebase siap
  useEffect(() => {
    if (!db || !isAuthReady) return;

    // Path untuk data publik di Firestore: artifacts/{appId}/public/data/photobooth_frames
    const framesCollectionRef = collection(db, `artifacts/${appId}/public/data/photobooth_frames`);

    const unsubscribe = onSnapshot(framesCollectionRef, (snapshot) => {
      const loadedFrames = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFrames(loadedFrames);
      if (loadedFrames.length > 0 && !selectedFrame) {
        setSelectedFrame(loadedFrames[0]); // Pilih frame pertama secara default
      }
    }, (error) => {
      console.error("Error fetching frames:", error);
    });

    // Tambahkan data frame contoh jika tidak ada
    const addSampleFrames = async () => {
      const docRef1 = doc(framesCollectionRef, "frame-kpop");
      const docSnap1 = await getDoc(docRef1);
      if (!docSnap1.exists()) {
        await setDoc(docRef1, {
          name: "K-Pop Style",
          imageUrl: "https://placehold.co/800x600/FFC0CB/000000?text=KPOP+FRAME", // Placeholder image
          slots: [ // Posisi foto dalam frame (x, y, width, height dalam persentase)
            { x: 5, y: 5, width: 40, height: 40 },
            { x: 55, y: 5, width: 40, height: 40 },
            { x: 5, y: 55, width: 40, height: 40 },
            { x: 55, y: 55, width: 40, height: 40 }
          ]
        });
      }

      const docRef2 = doc(framesCollectionRef, "frame-anime");
      const docSnap2 = await getDoc(docRef2);
      if (!docSnap2.exists()) {
        await setDoc(docRef2, {
          name: "Anime Vibe",
          imageUrl: "https://placehold.co/800x600/87CEEB/000000?text=ANIME+FRAME", // Placeholder image
          slots: [
            { x: 10, y: 10, width: 80, height: 35 },
            { x: 10, y: 55, width: 80, height: 35 }
          ]
        });
      }

       const docRef3 = doc(framesCollectionRef, "frame-modern");
       const docSnap3 = await getDoc(docRef3);
       if (!docSnap3.exists()) {
         await setDoc(docRef3, {
           name: "Modern Minimal",
           imageUrl: "https://placehold.co/800x600/E0E0E0/000000?text=MODERN+FRAME", // Placeholder image
           slots: [
             { x: 5, y: 5, width: 90, height: 25 },
             { x: 5, y: 35, width: 90, height: 25 },
             { x: 5, y: 65, width: 90, height: 25 }
           ]
         });
       }
    };
    addSampleFrames(); // Panggil untuk menambahkan data contoh jika belum ada

    return () => unsubscribe();
  }, [db, isAuthReady, appId, selectedFrame]); // Tambahkan selectedFrame ke dependency array agar useEffect berjalan saat frame terpilih berubah

  // Fungsi untuk mengatur ulang sesi
  const resetSession = () => {
    setCapturedPhotos([]);
    setSessionActive(false);
    setSessionEndTime(null);
    setPrintCount(0);
    setEmailSent(false);
  };

  const contextValue = {
    db, auth, userId, isAuthReady,
    currentScreen, setCurrentScreen,
    capturedPhotos, setCapturedPhotos,
    selectedFrame, setSelectedFrame,
    sessionActive, setSessionActive,
    sessionEndTime, setSessionEndTime,
    frames, resetSession,
    printCount, setPrintCount,
    emailSent, setEmailSent
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

// Komponen Umum untuk tampilan pesan (pengganti alert)
const MessageModal = ({ message, onClose }) => {
  if (!message) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm text-center rounded-2xl">
        <p className="text-lg font-semibold mb-4">{message}</p>
        <button
          onClick={onClose}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md transition duration-300 rounded-lg shadow-md"
        >
          OK
        </button>
      </div>
    </div>
  );
};


// 1. Boarding Screen
const BoardingScreen = () => {
  const videoRef = useRef(null);
  const { setCurrentScreen, isAuthReady, userId } = useContext(AppContext);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
        setMessage("Tidak dapat mengakses kamera. Pastikan kamera terhubung dan diizinkan.");
      }
    };

    startWebcam();

    // Pastikan webcam dimatikan saat komponen di-unmount
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  const handleAdminKeyClick = () => {
    // Simulasikan mode fullscreen/admin dengan menavigasi ke halaman lain
    // Di aplikasi nyata, ini akan meminta password admin atau otentikasi
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
      setMessage("Mode layar penuh diaktifkan. (Simulasi masuk admin)");
    } else {
      setMessage("Browser Anda tidak mendukung mode layar penuh.");
    }
  };

  if (!isAuthReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-400 to-indigo-600 text-white p-4">
        <h1 className="text-4xl font-extrabold mb-4 animate-pulse">Memuat...</h1>
        <p className="text-lg">Menunggu koneksi Firebase...</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-400 to-indigo-600 text-white p-4">
      <MessageModal message={message} onClose={() => setMessage('')} />

      {/* Admin Key Icon */}
      <button
        onClick={handleAdminKeyClick}
        className="absolute top-4 left-4 p-3 bg-gray-800 bg-opacity-70 rounded-full shadow-lg text-white hover:bg-gray-700 transition-all duration-300 transform hover:scale-105"
        title="Admin / Fullscreen"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2v5a2 2 0 01-2 2h-5a2 2 0 01-2-2V9a2 2 0 012-2h5z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12a2 2 0 002 2h2a2 2 0 002-2V9a2 2 0 00-2-2h-2a2 2 0 00-2 2v3z" />
        </svg>
      </button>

      <h1 className="text-5xl md:text-7xl font-extrabold mb-8 drop-shadow-lg text-center">
        Selamat Datang di Photobooth! 📸
      </h1>
      <p className="text-xl md:text-2xl mb-8 text-center px-4">
        Siapkan senyuman terbaikmu!
      </p>

      <div className="relative w-full max-w-2xl aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-2xl border-4 border-white mb-8">
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
        <div className="absolute inset-0 flex items-center justify-center text-white text-3xl font-bold bg-black bg-opacity-50"
             style={{ display: videoRef.current && videoRef.current.srcObject ? 'none' : 'flex' }}>
          Memuat Kamera...
        </div>
      </div>

      <button
        onClick={() => setCurrentScreen('tutorial')}
        className="bg-pink-500 hover:bg-pink-600 text-white font-extrabold py-4 px-8 rounded-full shadow-lg text-2xl animate-bounce transition-all duration-300 transform hover:scale-110"
      >
        Mulai Sesi
      </button>

      {userId && (
        <p className="absolute bottom-4 right-4 text-sm text-gray-200">
          ID Pengguna: {userId}
        </p>
      )}
    </div>
  );
};

// 2. Tutorial Screen
const TutorialScreen = () => {
  const { setCurrentScreen } = useContext(AppContext);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-green-400 to-teal-600 text-white p-4 text-center">
      <h1 className="text-4xl md:text-6xl font-extrabold mb-8 drop-shadow-lg">
        Cara Menggunakan Photobooth 🎉
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 max-w-5xl w-full">
        <div className="bg-white bg-opacity-20 p-6 rounded-xl shadow-lg flex flex-col items-center transform hover:scale-105 transition-transform duration-300">
          <span className="text-6xl mb-4">👆</span>
          <h2 className="text-2xl font-bold mb-2">Pilih Frame</h2>
          <p className="text-lg">Sesuaikan gayamu dengan berbagai pilihan frame menarik.</p>
        </div>
        <div className="bg-white bg-opacity-20 p-6 rounded-xl shadow-lg flex flex-col items-center transform hover:scale-105 transition-transform duration-300">
          <span className="text-6xl mb-4">📸</span>
          <h2 className="text-2xl font-bold mb-2">Ambil Foto</h2>
          <p className="text-lg">Siap-siap berpose! Ada hitung mundur sebelum setiap jepretan.</p>
        </div>
        <div className="bg-white bg-opacity-20 p-6 rounded-xl shadow-lg flex flex-col items-center transform hover:scale-105 transition-transform duration-300">
          <span className="text-6xl mb-4">🖨️</span>
          <h2 className="text-2xl font-bold mb-2">Cetak & Bagikan</h2>
          <p className="text-lg">Dapatkan hasil cetak dan kirimkan ke emailmu atau via QR Code!</p>
        </div>
      </div>
      <button
        onClick={() => setCurrentScreen('menu')}
        className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-extrabold py-4 px-8 rounded-full shadow-lg text-2xl transition-all duration-300 transform hover:scale-110"
      >
        Lanjut ke Menu
      </button>
    </div>
  );
};

// 3. Menu/Payment Screen
const MenuScreen = () => {
  const { setCurrentScreen, setSessionActive, setSessionEndTime, resetSession } = useContext(AppContext);
  const [voucherCode, setVoucherCode] = useState('');
  const [message, setMessage] = useState('');
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);

  const handleVoucherApply = () => {
    // Simulasi validasi voucher
    if (voucherCode === 'GRATISFOTO') {
      setMessage("Voucher berhasil diterapkan! Sesi akan dimulai.");
      startSession();
    } else {
      setMessage("Voucher tidak valid. Silakan coba lagi atau lanjutkan dengan pembayaran.");
    }
  };

  const startSession = () => {
    const sessionDuration = 5 * 60 * 1000; // 5 menit dalam milidetik
    setSessionEndTime(Date.now() + sessionDuration);
    setSessionActive(true);
    setCurrentScreen('frameSelection'); // Langsung ke pemilihan frame setelah pembayaran/voucher
  };

  const handlePayment = () => {
    // Simulasi pembayaran dengan Xendit. Di aplikasi nyata, ini akan mengarahkan ke gateway Xendit.
    setMessage("Pembayaran sukses! Sesi akan dimulai.");
    startSession();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-indigo-700 text-white p-4 text-center">
      <MessageModal message={message} onClose={() => setMessage('')} />
      <h1 className="text-4xl md:text-6xl font-extrabold mb-8 drop-shadow-lg">
        Pilih Mode Foto Anda
      </h1>

      <div className="flex flex-col md:flex-row gap-6 mb-12 w-full max-w-4xl">
        <button
          onClick={() => setShowPaymentOptions(true)}
          className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-extrabold py-5 px-8 rounded-xl shadow-lg text-3xl transition-all duration-300 transform hover:scale-105"
        >
          📸 Mode Foto Biasa
        </button>
        <button
          className="flex-1 bg-gray-400 text-gray-800 font-extrabold py-5 px-8 rounded-xl shadow-lg text-3xl cursor-not-allowed opacity-70"
          disabled
        >
          Pilihan Akan Datang (Segera!) ✨
        </button>
      </div>

      {showPaymentOptions && (
        <div className="bg-white p-8 rounded-xl shadow-2xl max-w-2xl w-full text-gray-800">
          <h2 className="text-3xl font-bold mb-6 text-center text-indigo-700">Lanjutkan Pembayaran atau Voucher</h2>

          <div className="mb-6">
            <input
              type="text"
              placeholder="Masukkan Kode Voucher"
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value)}
              className="w-full p-4 rounded-lg border-2 border-gray-300 focus:ring-2 focus:ring-blue-500 text-lg"
            />
            <button
              onClick={handleVoucherApply}
              className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg text-xl transition duration-300 shadow-md"
            >
              Gunakan Voucher
            </button>
          </div>

          <div className="relative flex items-center justify-center my-8">
            <div className="absolute border-t-2 border-gray-300 w-full"></div>
            <span className="relative bg-white px-4 text-gray-500 text-lg font-semibold">ATAU</span>
          </div>

          <button
            onClick={handlePayment}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-4 rounded-xl text-2xl transition duration-300 shadow-lg flex items-center justify-center"
          >
            Bayar dengan Xendit 💳
          </button>

          <button
            onClick={() => { resetSession(); setCurrentScreen('boarding'); }}
            className="mt-6 w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl text-lg transition duration-300"
          >
            Batal & Kembali
          </button>
        </div>
      )}
    </div>
  );
};

// 4. Frame Selection Screen
const FrameSelectionScreen = () => {
  const { setCurrentScreen, frames, selectedFrame, setSelectedFrame, sessionEndTime, sessionActive, resetSession } = useContext(AppContext);
  const [timeLeft, setTimeLeft] = useState(0);
  const [message, setMessage] = useState('');

  // Timer sesi
  useEffect(() => {
    let timer;
    if (sessionActive && sessionEndTime) {
      timer = setInterval(() => {
        const remaining = sessionEndTime - Date.now();
        if (remaining <= 0) {
          clearInterval(timer);
          setMessage("Waktu sesi habis. Silakan mulai sesi baru.");
          resetSession();
          setCurrentScreen('boarding'); // Kembali ke boarding screen
        } else {
          setTimeLeft(remaining);
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [sessionActive, sessionEndTime, setCurrentScreen, resetSession]);

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleFrameSelect = (frame) => {
    setSelectedFrame(frame);
  };

  const handleNext = () => {
    if (selectedFrame) {
      setCurrentScreen('photoSession');
    } else {
      setMessage("Mohon pilih setidaknya satu frame!");
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-br from-indigo-500 to-purple-700 text-white p-4">
      <MessageModal message={message} onClose={() => setMessage('')} />

      <h1 className="text-4xl md:text-6xl font-extrabold mb-6 drop-shadow-lg text-center">
        Pilih Frame Fotomu! 🎨
      </h1>

      {sessionActive && sessionEndTime && (
        <div className="bg-pink-500 text-white text-xl font-bold py-2 px-4 rounded-full mb-6 shadow-lg">
          Sisa Waktu Sesi: {formatTime(timeLeft)}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full max-w-6xl mb-12">
        {frames.length > 0 ? (
          frames.map((frame) => (
            <div
              key={frame.id}
              className={`relative cursor-pointer rounded-xl overflow-hidden shadow-lg border-4 transition-all duration-300 transform hover:scale-105
                ${selectedFrame && selectedFrame.id === frame.id ? 'border-yellow-400 ring-4 ring-yellow-400' : 'border-transparent hover:border-blue-400'}`}
              onClick={() => handleFrameSelect(frame)}
            >
              <img
                src={frame.imageUrl}
                alt={frame.name}
                className="w-full h-48 object-cover rounded-t-lg"
                onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/800x600/CCCCCC/000000?text=Gambar+Rusak"; }}
              />
              <div className="p-4 bg-white text-gray-800">
                <h3 className="font-bold text-lg">{frame.name}</h3>
                <p className="text-sm text-gray-600">{frame.slots.length} foto</p>
              </div>
              {selectedFrame && selectedFrame.id === frame.id && (
                <div className="absolute top-2 right-2 bg-yellow-400 text-gray-800 rounded-full p-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="text-center text-xl col-span-full">Memuat frame atau tidak ada frame tersedia. Pastikan koneksi Firestore benar.</p>
        )}
      </div>

      <button
        onClick={handleNext}
        disabled={!selectedFrame}
        className={`bg-orange-500 hover:bg-orange-600 text-white font-extrabold py-4 px-8 rounded-full shadow-lg text-2xl transition-all duration-300 transform hover:scale-110
          ${!selectedFrame ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        Selanjutnya {'>>'}
      </button>
    </div>
  );
};

// 5. Photo Session Screen
const PhotoSessionScreen = () => {
  const { setCurrentScreen, selectedFrame, setCapturedPhotos, capturedPhotos, sessionEndTime, sessionActive, resetSession } = useContext(AppContext);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const frameCanvasRef = useRef(null);
  const [countdown, setCountdown] = useState(0); // 5, 4, 3, 2, 1, JEP-RET!
  const [photoCount, setPhotoCount] = useState(0); // Jumlah foto yang sudah diambil
  const [retakeIndex, setRetakeIndex] = useState(null); // Indeks foto yang akan diretake
  const [message, setMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);

  // Timer sesi
  useEffect(() => {
    let timer;
    if (sessionActive && sessionEndTime) {
      timer = setInterval(() => {
        const remaining = sessionEndTime - Date.now();
        if (remaining <= 0) {
          clearInterval(timer);
          setMessage("Waktu sesi habis. Silakan mulai sesi baru.");
          resetSession();
          setCurrentScreen('boarding'); // Kembali ke boarding screen
        } else {
          setTimeLeft(remaining);
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [sessionActive, sessionEndTime, setCurrentScreen, resetSession]);

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };


  useEffect(() => {
    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Set canvas dimensions based on video stream
          videoRef.current.onloadedmetadata = () => {
            if (canvasRef.current) {
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;
            }
          };
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
        setMessage("Tidak dapat mengakses kamera. Pastikan kamera terhubung dan diizinkan.");
      }
    };

    startWebcam();

    // Pastikan webcam dimatikan saat komponen di-unmount
    return () => {
      const videoElement = videoRef.current; // Copy ref value
      if (videoElement && videoElement.srcObject) {
        const tracks = videoElement.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  // Memulai pengambilan foto
  useEffect(() => {
    if (!selectedFrame || !videoRef.current || !videoRef.current.srcObject) {
      return;
    }

    const totalSlots = selectedFrame.slots.length;
    const allPhotosTaken = capturedPhotos.length === totalSlots;

    if (photoCount < totalSlots && countdown === 0 && retakeIndex === null) {
      // Tunggu sebentar sebelum memulai hitung mundur pertama atau setelah retake
      const initialDelay = photoCount === 0 ? 1000 : 0;
      setTimeout(() => setCountdown(5), initialDelay);
    } else if (countdown === 0 && allPhotosTaken && retakeIndex === null) {
      // Semua foto sudah diambil, siap untuk konfirmasi
      setMessage("Semua foto berhasil diambil! Silakan konfirmasi.");
    }
  }, [photoCount, selectedFrame, countdown, retakeIndex, capturedPhotos.length]); // Tambahkan capturedPhotos.length sebagai dependency

  // Logic hitung mundur
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && selectedFrame && (photoCount < selectedFrame.slots.length || retakeIndex !== null)) {
      // Ambil atau retake foto setelah hitung mundur selesai
      if (videoRef.current && videoRef.current.readyState === 4) { // Pastikan video siap
        const indexToCapture = retakeIndex !== null ? retakeIndex : photoCount;
        capturePhoto(indexToCapture);
        setRetakeIndex(null); // Reset retake index setelah capture
      } else {
        console.warn("Video stream not ready for capture. Waiting...");
        // Mungkin perlu delay atau coba lagi. Biarkan useEffect ini berjalan lagi.
      }
    }
  }, [countdown, photoCount, selectedFrame, retakeIndex]); // Tambahkan capturePhoto sebagai dependency (meskipun ESLint warning, untuk fungsionalitas)

  // Fungsi capturePhoto dipindahkan keluar dari useEffect agar tidak menimbulkan warning dependency
  const capturePhoto = (indexToUpdate) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      console.error("Video has no dimensions or not ready, cannot capture.");
      setMessage("Error kamera: Video tidak siap. Coba muat ulang halaman.");
      return;
    }

    // Set canvas dimensions if they weren't set on metadata load
    if (canvas.width === 0 || canvas.height === 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    }

    // Gambar frame video ke canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const photoDataUrl = canvas.toDataURL('image/png');

    setCapturedPhotos(prevPhotos => {
      const newPhotos = [...prevPhotos];
      if (indexToUpdate < newPhotos.length) {
        newPhotos[indexToUpdate] = photoDataUrl; // Update foto yang diretake
      } else {
        newPhotos.push(photoDataUrl); // Tambahkan foto baru
      }
      return newPhotos;
    });

    if (retakeIndex === null) { // Hanya tingkatkan photoCount jika bukan retake
      setPhotoCount(prev => prev + 1);
    }

    // Setelah mengambil foto, set countdown lagi jika masih ada slot yang perlu diambil
    if (retakeIndex === null && (photoCount + 1 < selectedFrame.slots.length)) {
      setTimeout(() => setCountdown(5), 1000); // Tunggu 1 detik sebelum hitung mundur berikutnya
    }
  };


  // Menggambar frame dan foto yang sudah diambil ke canvas preview kanan
  useEffect(() => {
    if (!selectedFrame || !frameCanvasRef.current) return;

    const canvas = frameCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const frameImage = new Image();
    frameImage.src = selectedFrame.imageUrl;

    frameImage.onload = () => {
      // Pastikan canvas memiliki ukuran yang sesuai dengan frame
      canvas.width = frameImage.width;
      canvas.height = frameImage.height;

      // Gambar frame terlebih dahulu
      ctx.clearRect(0, 0, canvas.width, canvas.height); // Bersihkan canvas
      ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);

      // Gambar setiap foto yang diambil ke slot yang sesuai
      capturedPhotos.forEach((photoDataUrl, index) => {
        if (selectedFrame.slots[index]) {
          const photoImage = new Image();
          photoImage.src = photoDataUrl;
          photoImage.onload = () => {
            const slot = selectedFrame.slots[index];
            // Konversi persentase ke piksel
            const x = (slot.x / 100) * canvas.width;
            const y = (slot.y / 100) * canvas.height;
            const width = (slot.width / 100) * canvas.width;
            const height = (slot.height / 100) * canvas.height;
            ctx.drawImage(photoImage, x, y, width, height);

            // Gambar ulang frame setelah foto untuk memastikan foto berada di bawah frame
            ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height); // Redraw frame to overlay photos
          };
        }
      });
    };
  }, [selectedFrame, capturedPhotos]);


  const handleConfirm = () => {
    if (capturedPhotos.length === selectedFrame.slots.length) {
      setCurrentScreen('finalPreview');
    } else {
      setMessage(`Anda harus mengambil ${selectedFrame.slots.length} foto sebelum konfirmasi.`);
    }
  };

  const handleRetake = (index) => {
    setRetakeIndex(index);
    setCountdown(5); // Mulai hitung mundur untuk retake
    setMessage(`Mengulang foto ke-${index + 1}.`);
  };

  const isAllPhotosTaken = capturedPhotos.length === selectedFrame?.slots.length;

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-br from-red-500 to-orange-700 text-white p-4">
      <MessageModal message={message} onClose={() => setMessage('')} />

      <h1 className="text-4xl md:text-6xl font-extrabold mb-6 drop-shadow-lg text-center">
        Sesi Foto! 📸
      </h1>

      {sessionActive && sessionEndTime && (
        <div className="bg-blue-500 text-white text-xl font-bold py-2 px-4 rounded-full mb-6 shadow-lg">
          Sisa Waktu Sesi: {formatTime(timeLeft)}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6 w-full max-w-7xl h-[60vh] mb-8">
        {/* Kotak Kiri: Live Preview & Countdown */}
        <div className="relative flex-1 bg-gray-900 rounded-xl overflow-hidden shadow-2xl border-4 border-white flex items-center justify-center">
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover transform scaleX(-1)"></video> {/* Mirror video */}
          <canvas ref={canvasRef} className="hidden"></canvas> {/* Hidden canvas for capturing */}

          {countdown > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
              <span className="text-8xl md:text-9xl font-extrabold text-white animate-pulse">
                {countdown}
              </span>
            </div>
          )}
          {countdown === 0 && !isAllPhotosTaken && retakeIndex === null && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 animate-flash">
              <span className="text-6xl md:text-7xl font-extrabold text-gray-900">JEP-RET!</span>
            </div>
          )}
          {retakeIndex !== null && countdown === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 animate-flash">
              <span className="text-6xl md:text-7xl font-extrabold text-gray-900">RETAKE!</span>
            </div>
          )}
        </div>

        {/* Kotak Kanan: Frame Preview dengan Foto */}
        <div className="flex-1 bg-gray-800 rounded-xl shadow-2xl border-4 border-white flex items-center justify-center p-2 relative">
          {selectedFrame ? (
            <canvas ref={frameCanvasRef} className="w-full h-full object-contain rounded-lg"></canvas>
          ) : (
            <p className="text-white text-xl">Pilih frame terlebih dahulu.</p>
          )}

          {/* Retake buttons */}
          {capturedPhotos.length > 0 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 flex-wrap px-4">
              {capturedPhotos.map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleRetake(index)}
                  className={`bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold py-2 px-4 rounded-full shadow-md transition duration-300
                    ${retakeIndex === index ? 'ring-4 ring-yellow-400' : ''}`}
                >
                  Retake #{index + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleConfirm}
        disabled={!isAllPhotosTaken || countdown > 0 || retakeIndex !== null}
        className={`bg-green-500 hover:bg-green-600 text-white font-extrabold py-4 px-10 rounded-full shadow-lg text-2xl transition-all duration-300 transform hover:scale-105
          ${!isAllPhotosTaken || countdown > 0 || retakeIndex !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        Konfirmasi Foto ✅
      </button>
    </div>
  );
};

// 6. Final Preview Screen
const FinalPreviewScreen = () => {
  const { setCurrentScreen, capturedPhotos, selectedFrame, db, userId, resetSession, printCount, setPrintCount, emailSent, setEmailSent, sessionEndTime, sessionActive } = useContext(AppContext);
  const finalCanvasRef = useRef(null);
  const gifPreviewRef = useRef(null);
  const [framedPhotoUrl, setFramedPhotoUrl] = useState('');
  const [plainPhotoUrl, setPlainPhotoUrl] = useState('');
  const [livePhotoUrl, setLivePhotoUrl] = useState(''); // Untuk simulasi Live Photo (GIF)
  const [message, setMessage] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [canPrint, setCanPrint] = useState(false); // State untuk mengontrol tombol cetak
  const [timeLeft, setTimeLeft] = useState(0);

  // Timer sesi
  useEffect(() => {
    let timer;
    if (sessionActive && sessionEndTime) {
      timer = setInterval(() => {
        const remaining = sessionEndTime - Date.now();
        if (remaining <= 0) {
          clearInterval(timer);
          setMessage("Waktu sesi habis. Silakan mulai sesi baru.");
          resetSession();
          setCurrentScreen('boarding'); // Kembali ke boarding screen
        } else {
          setTimeLeft(remaining);
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [sessionActive, sessionEndTime, setCurrentScreen, resetSession]);

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!selectedFrame || capturedPhotos.length === 0) {
      setMessage("Tidak ada foto atau frame yang dipilih.");
      return;
    }

    const generateFinalOutputs = async () => {
      // 1. Generate Foto Fix dalam Frame
      const canvas = finalCanvasRef.current;
      if (!canvas) return; // Pastikan canvas ada
      const ctx = canvas.getContext('2d');
      const frameImage = new Image();
      frameImage.src = selectedFrame.imageUrl;

      frameImage.onload = () => {
        canvas.width = frameImage.width;
        canvas.height = frameImage.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);

        let loadedImages = 0;
        capturedPhotos.forEach((photoDataUrl, index) => {
          if (selectedFrame.slots[index]) {
            const photoImage = new Image();
            photoImage.src = photoDataUrl;
            photoImage.onload = () => {
              const slot = selectedFrame.slots[index];
              const x = (slot.x / 100) * canvas.width;
              const y = (slot.y / 100) * canvas.height;
              const width = (slot.width / 100) * canvas.width;
              const height = (slot.height / 100) * canvas.height;
              ctx.drawImage(photoImage, x, y, width, height);

              loadedImages++;
              if (loadedImages === capturedPhotos.length) {
                // Gambar ulang frame setelah semua foto dimuat untuk memastikan foto berada di bawah frame
                ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
                setFramedPhotoUrl(canvas.toDataURL('image/png'));
              }
            };
          }
        });
      };

      // 2. Generate Foto Polosan (ambil foto pertama atau gabungkan)
      // Untuk kesederhanaan, ambil foto pertama sebagai "polosan"
      setPlainPhotoUrl(capturedPhotos[0]);

      // 3. Generate GIF (Campuran dari semua foto)
      // Menggunakan placeholder GIF karena gif.js membutuhkan script eksternal
      // Di dunia nyata, Anda akan menggunakan library seperti gif.js atau jsgif
      // Contoh:
      // const gif = new GIF({ workers: 2, quality: 10, width: 600, height: 400 });
      // capturedPhotos.forEach(photoDataUrl => gif.addFrame(photoDataUrl, { delay: 200 }));
      // gif.on('finished', (blob) => setLivePhotoUrl(URL.createObjectURL(blob)));
      // gif.render();

      // Placeholder GIF:
      // Untuk tujuan demo ini, kita akan membuat animasi sederhana dari gambar-gambar yang diambil
      // Anda perlu library GIF sungguhan untuk ini, seperti 'gif.js'
      const placeholderGif = await createPlaceholderGif(capturedPhotos);
      setLivePhotoUrl(placeholderGif);
      if (gifPreviewRef.current) {
        gifPreviewRef.current.src = placeholderGif; // Tampilkan di elemen <img>
      }

      // 4. QR Code ke Cloud (Simulasi)
      // Link akan mengarah ke blob URL dari hasil foto yang sudah diframe
      // Di aplikasi nyata, Anda akan mengunggah ini ke Google Drive/Cloudinary dan mendapatkan URL publik
      // Untuk demo ini, QR code akan menunjuk ke blob URL ini.
      const finalBlob = await new Promise(resolve => {
        if (finalCanvasRef.current) {
          finalCanvasRef.current.toBlob(resolve, 'image/png');
        } else {
          resolve(null);
        }
      });
      if (finalBlob) {
        const finalBlobUrl = URL.createObjectURL(finalBlob);
        generateQRCode(finalBlobUrl);
      }


      // Cek status cetak dari Firestore
      if (db && userId) {
        const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/photobooth_settings/print_status`);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          setPrintCount(docSnap.data().count || 0);
          setCanPrint(docSnap.data().count < 1); // Hanya bisa cetak jika count < 1
        } else {
          // Jika belum ada data, izinkan cetak dan inisialisasi count
          setPrintCount(0);
          setCanPrint(true);
          await setDoc(userDocRef, { count: 0 }, { merge: true });
        }
      }
    };

    generateFinalOutputs();
  }, [capturedPhotos, selectedFrame, db, userId, appId, setPrintCount]); // Tambahkan setPrintCount ke dependency array


  // Fungsi untuk membuat placeholder GIF sederhana dari array gambar
  const createPlaceholderGif = async (images) => {
    // Ini adalah fungsi placeholder untuk membuat GIF dari gambar-gambar yang ditangkap
    // Dalam implementasi nyata, Anda akan menggunakan library GIF seperti gif.js
    // atau mengirim gambar ke backend untuk diproses menjadi GIF.
    // Untuk tujuan demo, ini akan membuat animasi sederhana di canvas atau mengambil gambar pertama
    // Jika Anda ingin implementasi GIF yang lebih realistis, Anda perlu mengimpor library GIF
    // yang kompatibel dengan browser, seperti `gif.js` atau `jsgif`.
    // Untuk demo ini, saya akan kembalikan gambar pertama dan menjelaskan bahwa GIF memerlukan library.
    // Jika Anda memiliki beberapa gambar, Anda dapat mengimplementasikan logika GIF di sini
    // menggunakan canvas untuk menggambar frame secara berurutan dan mengambil data URL.
    if (images.length === 0) return '';

    // Simulate a simple animation by quickly cycling through images
    // Note: This is NOT a real GIF, just a visual simulation.
    return images[0] || ''; // Mengembalikan gambar pertama sebagai fallback visual
  };


  const generateQRCode = async (dataUrl) => {
    try {
      // Menggunakan API QR Server. Ini adalah layanan eksternal.
      const response = await fetch('https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent(dataUrl));
      if (response.ok) {
        const blob = await response.blob();
        setQrCodeUrl(URL.createObjectURL(blob));
      } else {
        console.error("Failed to generate QR code:", response.statusText);
        setMessage("Gagal membuat QR Code.");
      }
    } catch (error) {
      console.error("Error generating QR code:", error);
      setMessage("Error membuat QR Code.");
    }
  };

  const handlePrint = async () => {
    if (!canPrint) {
      setMessage("Anda hanya dapat mencetak 1x per sesi.");
      return;
    }

    // Simulasi proses cetak
    setMessage("Mencetak foto Anda... Mohon tunggu.");
    // Di aplikasi nyata, ini akan mengirim perintah cetak ke mesin cetak lokal
    // Misalnya, dengan WebUSB, Electron, atau aplikasi server cetak
    console.log("Mencetak foto:", framedPhotoUrl);

    // Update print count di Firestore
    if (db && userId) {
      const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/photobooth_settings/print_status`);
      await updateDoc(userDocRef, { count: printCount + 1 })
        .then(() => {
          setPrintCount(prev => prev + 1);
          setCanPrint(false); // Setelah cetak, tidak bisa cetak lagi
          setMessage("Foto berhasil dicetak!");
        })
        .catch(error => {
          console.error("Error updating print count:", error);
          setMessage("Gagal memperbarui status cetak.");
        });
    }

    // Setelah cetak (simulasi), kembali ke boarding screen
    setTimeout(() => {
      resetSession();
      setCurrentScreen('boarding');
    }, 3000);
  };

  const handleSendEmail = async () => {
    if (!recipientEmail) {
      setMessage("Mohon masukkan alamat email penerima.");
      return;
    }
    setEmailSent(true);
    // Simulasi pengiriman email. Di aplikasi nyata, ini akan memanggil API backend untuk mengirim email.
    // Konten email dapat diambil dari pengaturan admin di Firestore.
    setMessage(`Foto akan dikirim ke ${recipientEmail}.`);
    console.log(`Mengirim foto ke ${recipientEmail}.`);
    setShowEmailModal(false); // Tutup modal
    // Setelah email terkirim (simulasi), reset sesi atau kembali ke boarding screen
    setTimeout(() => {
        resetSession();
        setCurrentScreen('boarding');
    }, 2000);
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-br from-teal-500 to-cyan-700 text-white p-4">
      <MessageModal message={message} onClose={() => setMessage('')} />

      <h1 className="text-4xl md:text-6xl font-extrabold mb-6 drop-shadow-lg text-center">
        Hasil Akhirmu! ✨
      </h1>

      {sessionActive && sessionEndTime && (
        <div className="bg-yellow-500 text-gray-900 text-xl font-bold py-2 px-4 rounded-full mb-6 shadow-lg">
          Sisa Waktu Sesi: {formatTime(timeLeft)}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-6xl mb-8">
        {/* Foto dalam Frame */}
        <div className="flex flex-col items-center bg-gray-800 rounded-xl shadow-2xl p-4 border-4 border-white">
          <h2 className="text-2xl font-bold mb-4">Foto Dalam Frame</h2>
          {framedPhotoUrl ? (
            <img src={framedPhotoUrl} alt="Final Framed Photo" className="w-full h-auto object-contain rounded-lg max-h-96" />
          ) : (
            <div className="w-full h-80 bg-gray-700 flex items-center justify-center text-gray-400 rounded-lg">
              Memproses foto...
            </div>
          )}
          <canvas ref={finalCanvasRef} className="hidden"></canvas>
        </div>

        {/* Live Photo (GIF) */}
        <div className="flex flex-col items-center bg-gray-800 rounded-xl shadow-2xl p-4 border-4 border-white">
          <h2 className="text-2xl font-bold mb-4">Foto Bergerak (GIF)</h2>
          {livePhotoUrl ? (
            <img ref={gifPreviewRef} src={livePhotoUrl} alt="Live Photo GIF" className="w-full h-auto object-contain rounded-lg max-h-96" />
          ) : (
            <div className="w-full h-80 bg-gray-700 flex items-center justify-center text-gray-400 rounded-lg">
              Memproses GIF...
            </div>
          )}
        </div>

        {/* Foto Polosan */}
        <div className="flex flex-col items-center bg-gray-800 rounded-xl shadow-2xl p-4 border-4 border-white">
          <h2 className="text-2xl font-bold mb-4">Foto Polosan</h2>
          {plainPhotoUrl ? (
            <img src={plainPhotoUrl} alt="Plain Photo" className="w-full h-auto object-contain rounded-lg max-h-96" />
          ) : (
            <div className="w-full h-80 bg-gray-700 flex items-center justify-center text-gray-400 rounded-lg">
              Memproses foto...
            </div>
          )}
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center bg-gray-800 rounded-xl shadow-2xl p-4 border-4 border-white">
          <h2 className="text-2xl font-bold mb-4">Scan untuk Unduh!</h2>
          {qrCodeUrl ? (
            <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 md:w-64 md:h-64 object-contain rounded-lg border border-gray-600 p-2" />
          ) : (
            <div className="w-48 h-48 md:w-64 md:h-64 bg-gray-700 flex items-center justify-center text-gray-400 rounded-lg">
              Membuat QR Code...
            </div>
          )}
          <p className="text-sm mt-4 text-center">Arahkan kamera ponsel Anda untuk mengunduh semua hasil foto.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 w-full max-w-lg">
        <button
          onClick={handlePrint}
          disabled={!framedPhotoUrl || !canPrint}
          className={`flex-1 bg-purple-600 hover:bg-purple-700 text-white font-extrabold py-4 px-8 rounded-full shadow-lg text-2xl transition-all duration-300 transform hover:scale-105
            ${!framedPhotoUrl || !canPrint ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Cetak Foto 🖨️
        </button>
        <button
          onClick={() => setShowEmailModal(true)}
          disabled={!framedPhotoUrl || emailSent}
          className={`flex-1 bg-sky-500 hover:bg-sky-600 text-white font-extrabold py-4 px-8 rounded-full shadow-lg text-2xl transition-all duration-300 transform hover:scale-105
            ${!framedPhotoUrl || emailSent ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Kirim Email 📧
        </button>
      </div>

      <button
        onClick={() => { resetSession(); setCurrentScreen('boarding'); }}
        className="mt-8 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-full shadow-md text-lg transition duration-300"
      >
        Kembali ke Boarding
      </button>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full text-gray-800 text-center rounded-2xl">
            <h2 className="text-2xl font-bold mb-4">Kirim Foto ke Email</h2>
            <p className="mb-4">Masukkan alamat email tujuan:</p>
            <input
              type="email"
              placeholder="contoh@email.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full p-3 rounded-lg border-2 border-gray-300 focus:ring-2 focus:ring-blue-500 text-lg mb-4"
            />
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleSendEmail}
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-5 rounded-md transition duration-300 rounded-lg shadow-md"
              >
                Kirim
              </button>
              <button
                onClick={() => setShowEmailModal(false)}
                className="bg-gray-400 hover:bg-gray-500 text-gray-800 font-bold py-2 px-5 rounded-md transition duration-300 rounded-lg shadow-md"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// Main App Component
function App() {
  const { currentScreen } = useContext(AppContext);

  // Note: For local deployment, it's generally better to include the Tailwind CSS CDN
  // script directly in your public/index.html file's <head> section,
  // to ensure it loads before your React app.
  // Example: <script src="https://cdn.tailwindcss.com"></script>
  // This approach is for self-contained immersive code.

  return (
    <>
      {/* Script Tailwind CSS CDN - Harap pindahkan ini ke public/index.html untuk deployment lokal */}
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        {`
        /* Pastikan HTML dan Body mengisi seluruh viewport */
        html, body {
          height: 100%;
          margin: 0;
          padding: 0;
        }

        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        body {
          font-family: 'Inter', sans-serif;
          overflow: hidden; /* Hide scrollbars if content overflows during transitions */
        }
        .animate-bounce {
          animation: bounce 1s infinite;
        }
        @keyframes bounce {
          0%, 100% {
            transform: translateY(-25%);
            animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
          }
          50% {
            transform: none;
            animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
          }
        }
        .animate-flash {
          animation: flash 0.3s forwards;
        }
        @keyframes flash {
          0% { opacity: 0; }
          50% { opacity: 1; }
          100% { opacity: 0; }
        }
        `}
      </style>
      <div className="min-h-screen flex items-center justify-center">
        {currentScreen === 'boarding' && <BoardingScreen />}
        {currentScreen === 'tutorial' && <TutorialScreen />}
        {currentScreen === 'menu' && <MenuScreen />}
        {currentScreen === 'frameSelection' && <FrameSelectionScreen />}
        {currentScreen === 'photoSession' && <PhotoSessionScreen />}
        {currentScreen === 'finalPreview' && <FinalPreviewScreen />}
      </div>
    </>
  );
}

// Wrap the App component with AppProvider
export default function ProvidedApp() {
  return (
    <AppProvider>
      <App />
    </AppProvider>
  );
}

