import React, { useState, useRef, useEffect, createContext, useContext, useCallback } from 'react';
import { db } from './db';

// Context untuk menyediakan state aplikasi ke seluruh komponen
const AppContext = createContext();

const AppProvider = ({ children }) => {
  const [currentScreen, setCurrentScreen] = useState('boarding');
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionEndTime, setSessionEndTime] = useState(null);
  const [frames, setFrames] = useState([]);
  const [printCount, setPrintCount] = useState(0);
  const [emailSent, setEmailSent] = useState(false);
  const [userId, setUserId] = useState('user_' + Math.floor(Math.random() * 1000000));
  const [loadingFrames, setLoadingFrames] = useState(true);
  const [framesError, setFramesError] = useState(null);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);

  // Load frames dari SQLite
  useEffect(() => {
    const loadFrames = async () => {
      try {
        setLoadingFrames(true);
        setFramesError(null);
        
        // Cek kesehatan server terlebih dahulu
        await db.checkHealth();
        
        // Ambil frames
        const data = await db.getFrames();
        setFrames(data);
        console.log('Frames loaded successfully:', data);
      } catch (error) {
        console.error('Error loading frames:', error);
        setFramesError(error.message);
        setFrames([]); // Set empty array jika gagal
      } finally {
        setLoadingFrames(false);
      }
    };

    loadFrames();
  }, []); // Dependensi kosong karena loadFrames hanya perlu berjalan sekali saat komponen mount

  // Fungsi untuk mengatur ulang sesi, dibungkus dengan useCallback
  const resetSession = useCallback(() => {
    setCapturedPhotos([]);
    setSessionActive(false);
    setSelectedFrame(null);
    setSessionEndTime(null);
    setEmailSent(false);
    setPrintCount(0); // Tambahkan ini jika ingin printCount direset
    setCurrentScreen('boarding');
  }, [setCapturedPhotos, setSessionActive, setSelectedFrame, setSessionEndTime, setEmailSent, setPrintCount, setCurrentScreen]); // Sertakan semua fungsi setState sebagai dependensi

  const contextValue = {
    currentScreen, setCurrentScreen,
    capturedPhotos, setCapturedPhotos,
    selectedFrame, setSelectedFrame,
    sessionActive, setSessionActive,
    sessionEndTime, setSessionEndTime,
    frames,
    resetSession,
    emailSent, setEmailSent,
    userId, setUserId,
    printCount, setPrintCount,
    loadingFrames,
    framesError,
    videoDevices, setVideoDevices,
    selectedDeviceId, setSelectedDeviceId
  };

  useEffect(() => {
    const getDevices = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videos = devices.filter(device => device.kind === 'videoinput');
      setVideoDevices(videos);
      if (videos.length > 0) setSelectedDeviceId(videos[0].deviceId);
    };
    getDevices();
  }, []);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

// --- Komponen Screen ---

const BoardingScreen = () => {
  const { setCurrentScreen, resetSession } = useContext(AppContext);

  useEffect(() => {
    resetSession(); // Pastikan sesi direset saat kembali ke boarding
  }, [resetSession]); // Dependensi resetSession sekarang stabil

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-600 to-indigo-800 text-white p-4">
      <div className="text-center">
        <h1 className="text-5xl md:text-7xl font-extrabold mb-6 drop-shadow-lg animate-fade-in-down">
          Selamat Datang di Photobooth Kami!
        </h1>
        <p className="text-xl md:text-2xl mb-8 animate-fade-in-up">
          Abadikan momen tak terlupakan dengan berbagai pilihan frame menarik.
        </p>
        <button
          onClick={() => setCurrentScreen('frameSelection')}
          className="bg-yellow-400 hover:bg-yellow-500 text-purple-900 font-bold py-3 px-8 rounded-full text-xl shadow-lg transition-all duration-300 transform hover:scale-105 animate-bounce-in"
        >
          Mulai Sesi Foto 🎉
        </button>
      </div>
    </div>
  );
};

const FrameSelectionScreen = () => {
  const { setCurrentScreen, setSelectedFrame, frames, loadingFrames, framesError } = useContext(AppContext);

  const handleSelectFrame = (frame) => {
    setSelectedFrame(frame);
    setCurrentScreen('photoSession');
  };

  if (loadingFrames) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-600 to-teal-800 text-white p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold mb-4">Memuat Frame...</h1>
          <p className="text-lg">Mohon tunggu sebentar</p>
        </div>
      </div>
    );
  }

  if (framesError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-red-600 to-pink-800 text-white p-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">⚠️ Error Memuat Frame</h1>
          <p className="text-lg mb-6">{framesError}</p>
          <div className="space-y-4">
            <p className="text-sm">Kemungkinan penyebab:</p>
            <ul className="text-sm text-left max-w-md mx-auto">
              <li>• Server tidak berjalan di port 3001</li>
              <li>• Database belum terinisialisasi</li>
              <li>• Masalah koneksi jaringan</li>
            </ul>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 bg-white text-red-600 font-bold py-2 px-6 rounded-full shadow-lg transition-all duration-300 hover:bg-gray-100"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-br from-blue-600 to-teal-800 text-white p-6">
      <h1 className="text-4xl md:text-5xl font-extrabold mb-8 drop-shadow-lg">Pilih Frame Favoritmu</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-6xl">
        {frames.length > 0 ? (
          frames.map(frame => (
            <div
              key={frame.id}
              onClick={() => handleSelectFrame(frame)}
              className="bg-white rounded-lg shadow-xl overflow-hidden cursor-pointer transform transition-transform duration-300 hover:scale-105 flex flex-col"
            >
              <img
                src={`http://localhost:3001${frame.image_path}`}
                alt={frame.name}
                className="w-full h-48 object-cover"
                onError={(e) => {
                  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4=';
                }}
              />
              <div className="p-4 flex-grow flex items-center justify-center">
                <h2 className="text-2xl font-semibold text-gray-800 text-center">{frame.name}</h2>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center">
            <p className="text-xl mb-4">Tidak ada frame yang tersedia.</p>
            <p className="text-sm text-gray-300">Silakan cek koneksi server atau hubungi administrator.</p>
          </div>
        )}
      </div>
      <button
        onClick={() => setCurrentScreen('boarding')}
        className="mt-10 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-8 rounded-full text-xl shadow-lg transition-all duration-300 transform hover:scale-105"
      >
        Kembali
      </button>
    </div>
  );
};

const PhotoSessionScreen = () => {
  const {
    selectedFrame,
    capturedPhotos,
    setCapturedPhotos,
    setCurrentScreen,
    setSessionEndTime,
    setSessionActive,
    videoDevices,
    selectedDeviceId,
    setSelectedDeviceId
  } = useContext(AppContext);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraError, setCameraError] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);

  const slots = typeof selectedFrame?.slots === 'string' ? JSON.parse(selectedFrame.slots) : selectedFrame?.slots || [];
  const photosPerFrame = slots.length;

  // State untuk slot yang sedang aktif
  const [activeSlot, setActiveSlot] = useState(0);
  
  // Inisialisasi capturedPhotos jika belum ada
  useEffect(() => {
    if (capturedPhotos.length !== photosPerFrame) {
      setCapturedPhotos(Array(photosPerFrame).fill(null));
    }
    // eslint-disable-next-line
  }, [photosPerFrame]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Pastikan video sudah siap
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        alert('Kamera belum siap. Mohon tunggu sebentar.');
        return;
      }
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      
      // Gambar video ke canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Cek apakah gambar tidak hitam
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let totalBrightness = 0;
      
      // Hitung rata-rata brightness
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        totalBrightness += (r + g + b) / 3;
      }
      
      const avgBrightness = totalBrightness / (data.length / 4);
      
      if (avgBrightness < 10) {
        alert('Gambar terlalu gelap. Pastikan ada cahaya yang cukup dan kamera tidak tertutup.');
        return;
      }

      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedPhotos(prev => {
        const updated = [...prev];
        updated[activeSlot] = photoDataUrl;
        return updated;
      });
    }
  };

  // Cek apakah semua slot sudah terisi
  const allFilled = capturedPhotos.every(photo => !!photo);

  const goToFinalPreview = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setSessionEndTime(Date.now() + 600000);
    setSessionActive(true);
    setCurrentScreen('finalPreview');
  };

  // useEffect untuk webcam dengan error handling yang lebih baik
  useEffect(() => {
    let stream = null;
    
    const checkCameraAvailability = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length === 0) {
          setCameraError('Tidak ada kamera yang terdeteksi. Pastikan kamera terhubung.');
          setIsCameraLoading(false);
          return false;
        }
        
        console.log('Kamera yang tersedia:', videoDevices.length);
        return true;
      } catch (error) {
        console.error('Error checking camera availability:', error);
        setCameraError('Tidak dapat mengecek ketersediaan kamera.');
        setIsCameraLoading(false);
        return false;
      }
    };
    
    const startWebcam = async () => {
      try {
        setIsCameraLoading(true);
        setCameraError(null);
        
        // Cek ketersediaan kamera terlebih dahulu
        const cameraAvailable = await checkCameraAvailability();
        if (!cameraAvailable) return;
        
        // Coba dapatkan stream dengan berbagai constraint
        const constraints = {
          video: {
            deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            frameRate: { ideal: 30, min: 15 }
          },
          audio: false
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          // Tunggu video siap
          videoRef.current.onloadedmetadata = () => {
            setIsCameraLoading(false);
            console.log('Kamera siap:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
          };
          
          videoRef.current.onerror = (error) => {
            console.error('Error video:', error);
            setCameraError('Error memuat video stream');
            setIsCameraLoading(false);
          };
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        setIsCameraLoading(false);
        
        if (err.name === 'NotAllowedError') {
          setCameraError('Akses kamera ditolak. Silakan izinkan akses kamera di browser Anda.');
        } else if (err.name === 'NotFoundError') {
          setCameraError('Kamera tidak ditemukan. Pastikan kamera terhubung.');
        } else if (err.name === 'NotReadableError') {
          setCameraError('Kamera sedang digunakan aplikasi lain. Tutup aplikasi lain yang menggunakan kamera.');
        } else if (err.name === 'OverconstrainedError') {
          setCameraError('Kamera tidak mendukung resolusi yang diminta. Coba refresh halaman.');
        } else {
          setCameraError(`Error kamera: ${err.message}`);
        }
      }
    };

    startWebcam();

    // Cleanup: stop stream saat keluar dari komponen
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('Track stopped:', track.kind);
        });
      }
    };
  }, [selectedDeviceId]);

  // Tampilkan error jika ada
  if (cameraError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-6">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-bold mb-6">⚠️ Error Kamera</h1>
          <p className="text-lg mb-6">{cameraError}</p>
          
          <div className="space-y-4 mb-8">
            <h3 className="text-xl font-semibold">Solusi:</h3>
            <ul className="text-left space-y-2">
              <li>• Pastikan kamera terhubung dan tidak rusak</li>
              <li>• Izinkan akses kamera di browser</li>
              <li>• Tutup aplikasi lain yang menggunakan kamera</li>
              <li>• Refresh halaman ini</li>
              <li>• Coba browser lain</li>
            </ul>
          </div>
          
          <div className="space-x-4">
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-full"
            >
              Refresh Halaman
            </button>
            <button
              onClick={() => setCurrentScreen('frameSelection')}
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-full"
            >
              Kembali
            </button>
            <button
              onClick={() => {
                // Gunakan foto placeholder untuk testing
                const placeholderPhoto = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjNjY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkZvdG8gUGxhY2Vob2xkZXI8L3RleHQ+PC9zdmc+';
                setCapturedPhotos(Array(photosPerFrame).fill(placeholderPhoto));
                setCurrentScreen('finalPreview');
              }}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full"
            >
              Gunakan Foto Test
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-4xl font-extrabold mb-8">Sesi Foto</h1>
      
      {/* Webcam */}
      <div className="w-full max-w-2xl mb-4 relative">
        {isCameraLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-2"></div>
              <p>Memuat kamera...</p>
            </div>
          </div>
        )}
        
        {/* {videoDevices.length > 1 && (
          <select
            value={selectedDeviceId}
            onChange={e => setSelectedDeviceId(e.target.value)}
            className="mb-4 p-2 rounded bg-gray-700 text-white"
          >
            {videoDevices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Kamera ${device.deviceId}`}
              </option>
            ))}
          </select>
        )} */}
        
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-full rounded-lg shadow-lg"
          style={{ 
            transform: 'scaleX(-1)', // Mirror effect
            filter: 'brightness(1.1) contrast(1.1)' // Improve visibility
          }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
      
      {/* Preview slot */}
      <div className="flex gap-4 mb-6">
        {slots.map((slot, idx) => (
          <div
            key={idx}
            className={`border-4 rounded-lg w-32 h-32 flex items-center justify-center cursor-pointer ${activeSlot === idx ? 'border-yellow-400' : 'border-gray-500'}`}
            onClick={() => setActiveSlot(idx)}
            style={{ background: '#222' }}
          >
            {capturedPhotos[idx] ? (
              <img src={capturedPhotos[idx]} alt={`Slot ${idx + 1}`} className="w-full h-full object-cover rounded" />
            ) : (
              <span className="text-gray-400">Slot {idx + 1}</span>
            )}
          </div>
        ))}
      </div>
      
      {/* Tombol ambil foto */}
      <button
        onClick={capturePhoto}
        className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-full text-xl shadow-lg mb-4"
        disabled={isCameraLoading}
      >
        {capturedPhotos[activeSlot] ? 'Ulangi Foto' : 'Ambil Foto'}
      </button>
      
      {/* Tombol lanjut */}
      <button
        onClick={goToFinalPreview}
        className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-8 rounded-full text-xl shadow-lg"
        disabled={!allFilled || isCameraLoading}
      >
        Lanjut ke Pratinjau Akhir
      </button>
      
      {/* Tips kamera */}
      <div className="mt-6 p-4 bg-gray-800 rounded-lg max-w-md text-center">
        <h3 className="font-semibold mb-2">💡 Tips Foto yang Baik:</h3>
        <ul className="text-sm space-y-1">
          <li>• Pastikan ada cahaya yang cukup</li>
          <li>• Posisikan wajah di tengah frame</li>
          <li>• Jangan terlalu dekat atau jauh dari kamera</li>
        </ul>
      </div>
    </div>
  );
};

const FinalPreviewScreen = () => {
  const { capturedPhotos, selectedFrame, setCurrentScreen, setCapturedPhotos, userId, sessionEndTime, resetSession } = useContext(AppContext);
  const [timeLeft, setTimeLeft] = useState(null); // Gunakan useState untuk timeLeft
  const intervalRef = useRef(null); // Untuk menyimpan ID interval
  const [savingPhotos, setSavingPhotos] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [emailInput, setEmailInput] = useState('');
  const [emailSentStatus, setEmailSentStatus] = useState(''); // Added state for email sending status

  const slots = typeof selectedFrame?.slots === 'string'
    ? JSON.parse(selectedFrame.slots)
    : selectedFrame?.slots || [];

  // Kombinasikan foto yang diambil dengan frame
  const finalImageRef = useRef(null);

  useEffect(() => {
    const drawFinalImage = async () => {
      if (!selectedFrame || capturedPhotos.length === 0) return;

      const frameImage = new window.Image();
      frameImage.crossOrigin = 'Anonymous';
      frameImage.src = `http://localhost:3001${selectedFrame.image_path}`;

      frameImage.onload = async () => {
        const canvas = finalImageRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = frameImage.width;
        canvas.height = frameImage.height;
        ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);

        // Tunggu semua foto slot selesai di-load
        await Promise.all(slots.map((slot, index) => {
          return new Promise(resolve => {
            if (capturedPhotos[index]) {
              const photoImage = new window.Image();
              photoImage.crossOrigin = 'Anonymous';
              photoImage.src = capturedPhotos[index];
              photoImage.onload = () => {
                // Hitung rasio untuk menyesuaikan foto ke slot tanpa distorsi
                const slotWidth = slot.width;
                const slotHeight = slot.height;
                const photoAspectRatio = photoImage.width / photoImage.height;
                const slotAspectRatio = slotWidth / slotHeight;

                let drawWidth = slotWidth;
                let drawHeight = slotHeight;
                let drawX = slot.x;
                let drawY = slot.y;

                if (photoAspectRatio > slotAspectRatio) {
                  drawWidth = slotHeight * photoAspectRatio;
                  drawX = slot.x + (slotWidth - drawWidth) / 2;
                } else {
                  drawHeight = slotWidth / photoAspectRatio;
                  drawY = slot.y + (slotHeight - drawHeight) / 2;
                }

                ctx.drawImage(photoImage, drawX, drawY, drawWidth, drawHeight);
                resolve();
              };
            } else {
              resolve();
            }
          });
        }));
      };
    };

    drawFinalImage();
  }, [capturedPhotos, selectedFrame, slots]);

  const retakePhoto = (indexToRetake) => {
    const updatedPhotos = capturedPhotos.filter((_, index) => index !== indexToRetake);
    setCapturedPhotos(updatedPhotos);
    setCurrentScreen('photoSession');
    // Mungkin perlu memuat ulang webcam di PhotoSessionScreen jika sudah dimatikan
  };

  const savePhotos = async () => {
    setSavingPhotos(true);
    setSaveError(null);
    try {
      if (!finalImageRef.current) {
        throw new Error("Final image not ready.");
      }
      // Ambil hasil canvas (gabungan frame + foto)
      const finalPhotoDataUrl = finalImageRef.current.toDataURL('image/jpeg', 0.9);
      // Gabungkan polosan dan hasil frame
      const allPhotos = [...capturedPhotos, finalPhotoDataUrl];
      // Kirim ke backend
      const response = await db.savePhoto(userId, selectedFrame.id, allPhotos);
      if (response.success) {
        console.log('Foto berhasil disimpan:', response.savedPhotos);
        setCurrentScreen('success');
      } else {
        throw new Error(response.message || 'Gagal menyimpan foto');
      }
    } catch (error) {
      console.error('Error saving photos:', error);
      setSaveError('Gagal menyimpan foto. Coba lagi.');
    } finally {
      setSavingPhotos(false);
    }
  };

  const sendEmail = async () => {
    setEmailSentStatus('sending');
    try {
      if (!emailInput || !finalImageRef.current) {
        throw new Error("Email dan/atau gambar tidak tersedia.");
      }
      const finalPhotoDataUrl = finalImageRef.current.toDataURL('image/jpeg', 0.9);

      const response = await db.sendEmail(emailInput, userId, finalPhotoDataUrl);
      if (response.success) {
        setEmailSentStatus('success');
        console.log('Email sent successfully!');
      } else {
        throw new Error(response.message || 'Gagal mengirim email.');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      setEmailSentStatus('error');
      setSaveError('Gagal mengirim email. Pastikan alamat email benar.'); // Use saveError state
    }
  };

  // Timer untuk Final Preview
  useEffect(() => {
    if (sessionEndTime) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, sessionEndTime - now);
        setTimeLeft(remaining);

        if (remaining <= 0) {
          clearInterval(intervalRef.current);
          resetSession(); // Kembali ke boarding setelah waktu habis
        }
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [sessionEndTime, resetSession]);

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-4xl md:text-5xl font-extrabold mb-8 drop-shadow-lg">Pratinjau Akhir</h1>

      {timeLeft !== null && (
        <p className="text-xl mb-4">Waktu Tersisa: <span className="font-bold text-yellow-400">{formatTime(timeLeft)}</span></p>
      )}

      <div className="relative w-full max-w-4xl aspect-video bg-black rounded-lg shadow-2xl overflow-hidden mb-6">
        <canvas ref={finalImageRef} className="w-full h-full object-contain"></canvas>
      </div>

      <div className="flex flex-wrap justify-center gap-4 mb-8">
        {capturedPhotos.map((photo, index) => (
          <div key={index} className="relative group">
            <img
              src={photo}
              alt={`Captured ${index + 1}`}
              className="w-24 h-24 object-cover rounded-lg border-2 border-purple-500 shadow-md transition-transform duration-200 group-hover:scale-110"
            />
            <button
              onClick={() => retakePhoto(index)}
              className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg text-sm font-bold"
            >
              Ulangi
            </button>
          </div>
        ))}
      </div>

      <div className="flex space-x-4">
        <button
          onClick={savePhotos}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-full text-xl shadow-lg transition-all duration-300 transform hover:scale-105"
          disabled={savingPhotos}
        >
          {savingPhotos ? 'Menyimpan...' : 'Simpan Foto'}
        </button>

        <button
          onClick={() => setCurrentScreen('boarding')}
          className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-8 rounded-full text-xl shadow-lg transition-all duration-300 transform hover:scale-105"
        >
          Kembali ke Awal
        </button>
      </div>
      {saveError && <p className="text-red-500 mt-4 text-center">{saveError}</p>}

      {/* Bagian pengiriman email */}
      <div className="mt-8 p-4 bg-gray-800 rounded-lg shadow-inner w-full max-w-md text-center">
        <h2 className="text-2xl font-bold mb-4">Kirim Foto ke Email</h2>
        <input
          type="email"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="Masukkan alamat email Anda"
          className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
        />
        <button
          onClick={sendEmail}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg transition-all duration-300 transform hover:scale-105"
          disabled={emailSentStatus === 'sending'}
        >
          {emailSentStatus === 'sending' ? 'Mengirim...' : 'Kirim Email'}
        </button>
        {emailSentStatus === 'success' && <p className="text-green-500 mt-2">Email berhasil dikirim! 🎉</p>}
        {emailSentStatus === 'error' && <p className="text-red-500 mt-2">Gagal mengirim email. Coba lagi.</p>}
      </div>
    </div>
  );
};

const SuccessScreen = () => {
  const { resetSession } = useContext(AppContext);
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-500 to-lime-700 text-white p-4">
      <div className="text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold mb-6 drop-shadow-lg">
          Foto Berhasil Disimpan! 🎉
        </h1>
        <p className="text-xl md:text-2xl mb-8">
          Foto Anda telah berhasil disimpan dan dapat diakses di galeri.
        </p>
        <button
          onClick={resetSession} // Menggunakan resetSession untuk kembali ke awal
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full text-xl shadow-lg transition-all duration-300 transform hover:scale-105"
        >
          Kembali ke Awal
        </button>
      </div>
    </div>
  );
};

// --- Komponen Admin ---
const AdminScreen = () => {
  const [frames, setFrames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newFrame, setNewFrame] = useState({ name: '', image_path: '', slots: '[]' });
  const [refresh, setRefresh] = useState(false);

  useEffect(() => {
    const fetchFrames = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await db.getFrames();
        setFrames(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchFrames();
  }, [refresh]);

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin hapus frame ini?')) return;
    try {
      await fetch(`http://localhost:3001/frames/${id}`, { method: 'DELETE' });
      setRefresh(r => !r);
    } catch (e) {
      alert('Gagal hapus frame');
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await fetch('http://localhost:3001/frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFrame)
      });
      setShowAdd(false);
      setNewFrame({ name: '', image_path: '', slots: '[]' });
      setRefresh(r => !r);
    } catch (e) {
      alert('Gagal tambah frame');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Frame</h1>
      <button onClick={() => setShowAdd(s => !s)} className="mb-4 bg-green-600 px-4 py-2 rounded">{showAdd ? 'Batal' : 'Tambah Frame'}</button>
      {showAdd && (
        <form onSubmit={handleAdd} className="mb-6 bg-gray-800 p-4 rounded">
          <input type="text" placeholder="Nama Frame" value={newFrame.name} onChange={e => setNewFrame(f => ({ ...f, name: e.target.value }))} className="mb-2 p-2 rounded w-full text-black" required />
          <input type="text" placeholder="Path Gambar (misal: /frames/nama.png)" value={newFrame.image_path} onChange={e => setNewFrame(f => ({ ...f, image_path: e.target.value }))} className="mb-2 p-2 rounded w-full text-black" required />
          <button type="submit" className="bg-blue-600 px-4 py-2 rounded">Simpan</button>
        </form>
      )}
      {loading ? <p>Loading...</p> : error ? <p className="text-red-400">{error}</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {frames.map(frame => (
            <div key={frame.id} className="bg-gray-800 rounded p-4 flex flex-col items-center">
              <img src={`http://localhost:3001${frame.image_path}`} alt={frame.name} className="w-32 h-32 object-cover mb-2 rounded" />
              <div className="font-bold mb-2">{frame.name}</div>
              <div className="text-xs text-gray-400 mb-2">{frame.image_path}</div>
              <div className="flex gap-2">
                {/* Tombol edit bisa dikembangkan nanti */}
                <button className="bg-yellow-500 px-3 py-1 rounded text-black" disabled>Edit</button>
                <button className="bg-red-600 px-3 py-1 rounded" onClick={() => handleDelete(frame.id)}>Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <a href="/" className="block mt-8 text-blue-400 underline">Kembali ke Halaman Utama</a>
    </div>
  );
};

// Main App Component
function App() {
  const { currentScreen } = useContext(AppContext);
  const [admin, setAdmin] = useState(window.location.pathname === '/admin');

  useEffect(() => {
    const onPop = () => setAdmin(window.location.pathname === '/admin');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  if (admin) return <AdminScreen />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-500 to-orange-700">
      {currentScreen === 'boarding' && <BoardingScreen />}
      {currentScreen === 'frameSelection' && <FrameSelectionScreen />}
      {currentScreen === 'photoSession' && <PhotoSessionScreen />}
      {currentScreen === 'finalPreview' && <FinalPreviewScreen />}
      {/* PaymentScreen dinonaktifkan sementara */}
      {currentScreen === 'payment' && <BoardingScreen />} {/* Mengarahkan ke BoardingScreen jika payment */}
      {currentScreen === 'success' && <SuccessScreen />}
    </div>
  );
}

// Wrap App with AppProvider
export default function WrappedApp() {
  return (
    <AppProvider>
      <App />
    </AppProvider>
  );
}