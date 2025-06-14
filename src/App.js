import React, { useState, useRef, useEffect, createContext, useContext, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, onSnapshot, updateDoc } from 'firebase/firestore';

// ==========================================================
// PENTING: Ubah konfigurasi Firebase Anda di bawah ini!
// ==========================================================
const firebaseConfig = {
  apiKey: "AIzaSyC2gp3HfULCYeFbNzAuMSNxH4TMuR-V3zg", // Gunakan API Key Anda
  authDomain: "photobooth-a2f3e.firebaseapp.com", // Gunakan Auth Domain Anda
  projectId: "photobooth-a2f3e", // Gunakan Project ID Anda
  storageBucket: "photobooth-a2f3e.firebasestorage.app", // Gunakan Storage Bucket Anda
  messagingSenderId: "240496851594", // Gunakan Messaging Sender ID Anda
  appId: "1:240496851594:web:5b9cc8827eba5e561d0b73", // Gunakan App ID Anda (penting untuk Firestore)
  measurementId: "G-6N8QGB4TGV" // Gunakan Measurement ID Anda (opsional)
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
      const authentication = getAuth(app); // Menginisialisasi Firebase Authentication

      setDb(firestore);
      setAuth(authentication);

      // PENTING: Jika Anda mendapatkan error 'auth/configuration-not-found',
      // pastikan Anda telah mengaktifkan Firebase Authentication di konsol Firebase Anda:
      // Kunjungi https://console.firebase.google.com/project/<YOUR_PROJECT_ID>/authentication
      // Lalu, klik 'Get started' dan aktifkan setidaknya metode 'Anonymous' atau 'Email/Password'.
      // Ganti <YOUR_PROJECT_ID> dengan project ID Anda (photobooth-a2f3e).

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
  }, [db, isAuthReady, appId, selectedFrame]);

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


// ----------------------------------------------------------------------------------------------1. Boarding Screen
const BoardingScreen = () => {
  const { setCurrentScreen } = useContext(AppContext);
  const videoRef = useRef(null);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(false);
  const [message, setMessage] = useState('');
  const streamRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 detik

  const releaseCamera = async () => {
    try {
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        tracks.forEach(track => {
          track.stop();
          console.log('Track stopped:', track.kind);
        });
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.load(); // Force video element to reset
      }

      // Tunggu lebih lama untuk memastikan kamera benar-benar dilepas
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error('Error releasing camera:', err);
    }
  };

  const startWebcam = async () => {
    try {
      setCameraLoading(true);
      setCameraError(false);

      // Pastikan kamera dilepas terlebih dahulu
      await releaseCamera();

      // Reset retry count if this is a fresh start
      if (retryCount >= MAX_RETRIES) {
        setRetryCount(0);
      }

      // Coba akses kamera dengan konfigurasi yang lebih stabil
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
          frameRate: { ideal: 30 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Tunggu video siap dengan timeout
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Timeout waiting for video to be ready'));
          }, 5000);

          videoRef.current.onloadedmetadata = () => {
            clearTimeout(timeoutId);
            if (videoRef.current) {
              videoRef.current.play()
                .then(() => {
                  setCameraLoading(false);
                  setRetryCount(0);
                  console.log('Video started playing');
                  resolve();
                })
                .catch(err => {
                  console.error('Error playing video:', err);
                  reject(err);
                });
            } else {
              reject(new Error('Video element is null'));
            }
          };

          videoRef.current.onerror = (err) => {
            clearTimeout(timeoutId);
            console.error('Video error:', err);
            reject(err);
          };
        });
      } else {
        throw new Error('Video element not found');
      }
    } catch (err) {
      console.error("Error mengakses webcam:", err);
      handleCameraError(err);
    }
  };

  const handleCameraError = async (err) => {
    setCameraError(true);
    setCameraLoading(false);
    
    let errorMessage = 'Tidak dapat mengakses kamera: ';
    switch(err.name) {
      case 'NotAllowedError':
        errorMessage += 'Izin kamera ditolak. Klik ikon kamera di address bar untuk mengizinkan.';
        break;
      case 'NotFoundError':
        errorMessage += 'Kamera tidak ditemukan. Pastikan kamera terhubung.';
        break;
      case 'NotReadableError':
        errorMessage += 'Kamera sedang digunakan. Silakan:\n1. Tutup semua aplikasi yang menggunakan kamera\n2. Refresh halaman ini\n3. Jika masih bermasalah, restart browser';
        break;
      case 'Timeout':
        errorMessage += 'Waktu tunggu kamera habis. Silakan refresh halaman.';
        break;
      default:
        errorMessage += err.message;
    }
    setMessage(errorMessage);

    // Coba lepaskan kamera
    await releaseCamera();

    // Retry logic dengan delay yang lebih lama
    if (retryCount < MAX_RETRIES) {
      setRetryCount(prev => prev + 1);
      retryTimeoutRef.current = setTimeout(() => {
        console.log(`Retrying camera access (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        startWebcam();
      }, RETRY_DELAY * (retryCount + 1));
    } else {
      setMessage('Gagal mengakses kamera setelah beberapa percobaan. Silakan refresh halaman.');
    }
  };

  useEffect(() => {
    startWebcam();
    return () => {
      releaseCamera();
    };
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-red-500 to-orange-700 text-white overflow-hidden">
      <MessageModal message={message} onClose={() => setMessage('')} />
      
      <div className="relative w-full h-full flex flex-col items-center justify-center">
        {/* Background Video */}
        <div className="absolute inset-0 w-full h-full">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }} // Mirror video
          />
          {cameraLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="text-2xl font-bold">Memuat Kamera...</div>
            </div>
          )}
          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="text-2xl font-bold text-red-500">Kamera Tidak Tersedia</div>
            </div>
          )}
        </div>

        {/* Content Overlay */}
        <div className="relative z-10 text-center px-4">
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 drop-shadow-lg">
            Selamat Datang di Photobooth! 📸
          </h1>
          <p className="text-xl md:text-2xl mb-8 drop-shadow-md">
            Siap untuk berfoto? Pilih frame favoritmu dan mulai sesi foto!
          </p>
          <button
            onClick={() => setCurrentScreen('frameSelection')}
            disabled={cameraError}
            className={`bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-8 rounded-full text-2xl shadow-lg transition-all duration-300 transform hover:scale-105
              ${cameraError ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Mulai Foto
          </button>
        </div>
      </div>
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
          setCurrentScreen('boarding');
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
  const { setCurrentScreen, selectedFrame, setCapturedPhotos, capturedPhotos, sessionEndTime, sessionActive } = useContext(AppContext);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const frameCanvasRef = useRef(null);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState(false);
  const [message, setMessage] = useState('');
  const [countdown, setCountdown] = useState(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [retakeIndex, setRetakeIndex] = useState(null);
  const [showFlash, setShowFlash] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const streamRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const isAllPhotosTaken = photoCount >= selectedFrame?.slots?.length;

  const handleRetake = (index) => {
    setRetakeIndex(index);
    setCountdown(5);
  };

  const handleConfirm = () => {
    if (isAllPhotosTaken) {
      setCurrentScreen('finalPreview');
    }
  };

  const releaseCamera = async () => {
    try {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        tracks.forEach(track => {
          track.stop();
          console.log('Track stopped:', track.kind);
        });
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.load();
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error('Error releasing camera:', err);
    }
  };

  const startWebcam = useCallback(async () => {
    try {
      setCameraLoading(true);
      setCameraError(false);

      if (retryCount >= MAX_RETRIES) {
        setRetryCount(0);
      }

      await releaseCamera();

      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
          frameRate: { ideal: 30 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Timeout waiting for video to be ready'));
          }, 5000);

          videoRef.current.onloadedmetadata = () => {
            clearTimeout(timeoutId);
            if (videoRef.current) {
              videoRef.current.play()
                .then(() => {
                  setCameraLoading(false);
                  setRetryCount(0);
                  console.log('Video started playing');
                  resolve();
                })
                .catch(err => {
                  console.error('Error playing video:', err);
                  reject(err);
                });
            } else {
              reject(new Error('Video element is null'));
            }
          };

          videoRef.current.onerror = (err) => {
            clearTimeout(timeoutId);
            console.error('Video error:', err);
            reject(err);
          };
        });
      } else {
        throw new Error('Video element not found');
      }
    } catch (err) {
      console.error("Error mengakses webcam:", err);
      handleCameraError(err);
    }
  }, [retryCount]);

  const handleCameraError = async (err) => {
    setCameraError(true);
    setCameraLoading(false);
    setMessage('Gagal mengakses kamera. Silakan refresh halaman.');
    await releaseCamera();

    if (retryCount < MAX_RETRIES) {
      setRetryCount(prev => prev + 1);
      retryTimeoutRef.current = setTimeout(() => {
        console.log(`Retrying camera access (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        startWebcam();
      }, RETRY_DELAY * (retryCount + 1));
    }
  };

  // Timer sesi
  useEffect(() => {
    let timer;
    if (sessionActive && sessionEndTime) {
      timer = setInterval(() => {
        const remaining = sessionEndTime - Date.now();
        if (remaining <= 0) {
          clearInterval(timer);
          setMessage("Waktu sesi habis. Silakan mulai sesi baru.");
          setCurrentScreen('boarding');
        } else {
          setTimeLeft(remaining);
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [sessionActive, sessionEndTime, setCurrentScreen]);

  useEffect(() => {
    startWebcam();
    return () => {
      releaseCamera();
    };
  }, [startWebcam]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64
    const photoData = canvas.toDataURL('image/jpeg');
    
    // Update captured photos
    setCapturedPhotos(prev => {
      const newPhotos = [...prev];
      if (retakeIndex !== null) {
        newPhotos[retakeIndex] = photoData;
      } else {
        newPhotos.push(photoData);
      }
      return newPhotos;
    });

    if (retakeIndex === null) {
      setPhotoCount(prev => prev + 1);
    }

    // Setelah mengambil foto, set countdown lagi jika masih ada slot
    if (retakeIndex === null && photoCount + 1 < selectedFrame.slots.length) {
      setTimeout(() => setCountdown(5), 1000);
    }
  }, [setCapturedPhotos, retakeIndex, photoCount, selectedFrame]);

  useEffect(() => {
    if (countdown === 0) {
      capturePhoto();
    }
  }, [countdown, capturePhoto]);

  return (
    <div className="fixed inset-0 flex flex-col items-center bg-gradient-to-br from-red-500 to-orange-700 text-white overflow-hidden">
      <MessageModal message={message} onClose={() => setMessage('')} />

      <h1 className="text-4xl md:text-6xl font-extrabold mb-6 drop-shadow-lg text-center mt-4">
        Sesi Foto! 📸
      </h1>

      {sessionActive && sessionEndTime && (
        <div className="bg-blue-500 text-white text-xl font-bold py-2 px-4 rounded-full mb-6 shadow-lg">
          Sisa Waktu Sesi: {formatTime(timeLeft)}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6 w-full max-w-7xl flex-1 p-4">
        {/* Kotak Kiri: Live Preview & Countdown */}
        <div className="relative flex-1 bg-gray-900 rounded-xl overflow-hidden shadow-2xl border-4 border-white flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          <canvas ref={canvasRef} className="hidden"></canvas>

          {/* Countdown Overlay */}
          {countdown > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
              <span className="text-8xl md:text-9xl font-extrabold text-white animate-pulse">
                {countdown}
              </span>
            </div>
          )}

          {/* Flash Overlay */}
          {showFlash && (
            <div className="absolute inset-0 bg-white animate-flash"></div>
          )}

          {/* Jepret Text */}
          {countdown === 0 && !isAllPhotosTaken && retakeIndex === null && !showFlash && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 animate-flash">
              <span className="text-6xl md:text-7xl font-extrabold text-gray-900">JEP-RET!</span>
            </div>
          )}

          {/* Retake Text */}
          {retakeIndex !== null && countdown === 0 && !showFlash && (
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

      <div className="mb-4">
        <button
          onClick={handleConfirm}
          disabled={!isAllPhotosTaken || countdown > 0 || retakeIndex !== null}
          className={`bg-green-500 hover:bg-green-600 text-white font-extrabold py-4 px-10 rounded-full shadow-lg text-2xl transition-all duration-300 transform hover:scale-105
            ${!isAllPhotosTaken || countdown > 0 || retakeIndex !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Konfirmasi Foto ✅
        </button>
      </div>
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
      const ctx = canvas.getContext('2d');
      const frameImage = new Image();
      frameImage.src = selectedFrame.imageUrl;

      frameImage.onload = () => {
        canvas.width = frameImage.width;
        canvas.height = frameImage.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);

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

              // Gambar ulang frame setelah foto untuk memastikan foto berada di bawah frame
              ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
            };
          }
        });
        setFramedPhotoUrl(canvas.toDataURL('image/png'));
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
      const placeholderGif = await createPlaceholderGif(capturedPhotos);
      setLivePhotoUrl(placeholderGif);
      gifPreviewRef.current.src = placeholderGif; // Tampilkan di elemen <img>

      // 4. QR Code ke Cloud (Simulasi)
      // Link akan mengarah ke blob URL dari hasil foto yang sudah diframe
      const finalBlob = await new Promise(resolve => finalCanvasRef.current.toBlob(resolve, 'image/png'));
      const finalBlobUrl = URL.createObjectURL(finalBlob);
      // Di aplikasi nyata, Anda akan mengunggah ini ke Google Drive/Cloudinary dan mendapatkan URL publik
      // Untuk demo ini, QR code akan menunjuk ke blob URL ini.
      generateQRCode(finalBlobUrl);

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
  }, [capturedPhotos, selectedFrame, db, userId]);

  // Fungsi untuk membuat placeholder GIF sederhana dari array gambar
  const createPlaceholderGif = async (images) => {
    // Ini adalah fungsi placeholder untuk membuat GIF dari gambar-gambar yang ditangkap
    // Dalam implementasi nyata, Anda akan menggunakan library GIF seperti gif.js
    // atau mengirim gambar ke backend untuk diproses menjadi GIF.
    // Untuk tujuan demo, ini akan membuat animasi sederhana di canvas atau mengambil gambar pertama
    // Jika Anda ingin implementasi GIF yang lebih realistis, Anda perlu mengimpor library GIF
    // yang kompatibel dengan browser, seperti `gif.js` atau `jsgif`.
    // Contoh sederhana:

    if (images.length === 0) return '';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Tentukan ukuran canvas berdasarkan gambar pertama atau ukuran frame
    const img = new Image();
    img.src = images[0];
    await new Promise(resolve => img.onload = resolve);
    canvas.width = img.width;
    canvas.height = img.height;

    // Untuk simulasi "Live Photo", kita akan buat GIF kecil yang melingkar
    // Kita bisa gambar setiap foto ke canvas dan ambil frame-nya
    let frames = [];
    for (let i = 0; i < images.length; i++) {
      const currentImg = new Image();
      currentImg.src = images[i];
      await new Promise(resolve => currentImg.onload = resolve);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(currentImg, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL('image/png'));
    }

    // Ini adalah representasi sangat sederhana dan bukan GIF sebenarnya.
    // Browser akan menampilkan gambar pertama, atau Anda bisa membuat GIF dari ini
    // dengan library yang sebenarnya.
    // Untuk demo ini, saya akan kembalikan gambar pertama sebagai fallback
    return images[0] || ''; // Mengembalikan gambar pertama sebagai fallback
  };


  const generateQRCode = async (dataUrl) => {
    try {
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
            <img src={framedPhotoUrl} alt="Hasil akhir" className="w-full h-auto object-contain rounded-lg max-h-96" />
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
            <img ref={gifPreviewRef} src={livePhotoUrl} alt="Hasil bergerak" className="w-full h-auto object-contain rounded-lg max-h-96" />
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
            <img src={plainPhotoUrl} alt="Hasil polos" className="w-full h-auto object-contain rounded-lg max-h-96" />
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
          <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full text-gray-800 text-center">
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
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-5 rounded-md transition duration-300"
              >
                Kirim
              </button>
              <button
                onClick={() => setShowEmailModal(false)}
                className="bg-gray-400 hover:bg-gray-500 text-gray-800 font-bold py-2 px-5 rounded-md transition duration-300"
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

// Tambahkan SuccessScreen
const SuccessScreen = () => {
  const { setCurrentScreen } = useContext(AppContext);
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-red-500 to-orange-700 text-white p-4">
      <div className="text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold mb-6 drop-shadow-lg">
          Foto Berhasil Disimpan! 🎉
        </h1>
        <p className="text-xl md:text-2xl mb-8">
          Foto Anda telah berhasil disimpan dan dapat diakses di galeri.
        </p>
        <button
          onClick={() => setCurrentScreen('boarding')}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full text-xl shadow-lg transition-all duration-300 transform hover:scale-105"
        >
          Kembali ke Awal
        </button>
      </div>
    </div>
  );
};

// Main App Component
function App() {
  const { currentScreen } = useContext(AppContext);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-500 to-orange-700">
      {currentScreen === 'boarding' && <BoardingScreen />}
      {currentScreen === 'frameSelection' && <FrameSelectionScreen />}
      {currentScreen === 'photoSession' && <PhotoSessionScreen />}
      {currentScreen === 'finalPreview' && <FinalPreviewScreen />}
      {/* PaymentScreen dinonaktifkan sementara
      {currentScreen === 'payment' && <PaymentScreen />}
      */}
      {currentScreen === 'payment' && <BoardingScreen />}
      {currentScreen === 'success' && <SuccessScreen />}
    </div>
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

