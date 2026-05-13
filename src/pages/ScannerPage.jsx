import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';

// Beep sound generator (works without audio files)
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 1200;
    osc.type = 'sine';
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {
    // AudioContext not supported
  }
}

// Vibrate if supported
function vibrate() {
  try {
    if (navigator.vibrate) navigator.vibrate(200);
  } catch (e) {}
}

export default function ScannerPage() {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const hasScanned = useRef(false);

  const handleScanSuccess = useCallback((decodedText) => {
    if (hasScanned.current) return;

    let uid = null;

    // Strategy 1: Clean UID string (new format — just the uid)
    const trimmed = decodedText.trim();
    if (/^[a-zA-Z0-9]{20,40}$/.test(trimmed)) {
      uid = trimmed;
    }

    // Strategy 2: JSON with uid field (legacy format)
    if (!uid) {
      try {
        const data = JSON.parse(decodedText);
        if (data.uid) uid = data.uid;
      } catch {
        // Not JSON
      }
    }

    if (uid) {
      hasScanned.current = true;
      playBeep();
      vibrate();
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
      navigate(`/activate/${uid}`);
    } else {
      setError('رمز QR غير صالح — Invalid QR code');
      setTimeout(() => setError(''), 2000);
    }
  }, [navigate]);

  useEffect(() => {
    let html5Qr = null;
    let retryCount = 0;
    const maxRetries = 3;

    const startScanner = async () => {
      try {
        html5Qr = new Html5Qrcode('qr-reader');
        scannerRef.current = html5Qr;

        await html5Qr.start(
          { facingMode: 'environment' },
          {
            fps: 30,
            qrbox: { width: 280, height: 280 },
            aspectRatio: 1.0,
            disableFlip: false,
          },
          handleScanSuccess,
          () => {} // ignore scan failures (auto-retry built into html5-qrcode)
        );
        setScanning(true);
        setError('');
      } catch (err) {
        console.error('Scanner error:', err);
        retryCount++;
        if (retryCount < maxRetries) {
          // Auto-retry after 1s
          setTimeout(startScanner, 1000);
        } else {
          setError('تعذر الوصول للكاميرا — Camera access denied');
        }
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [handleScanSuccess]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-12 pb-4 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="text-white/70 hover:text-white p-2 cursor-pointer">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-white">مسح رمز QR</h1>
        <div className="w-10"></div>
      </div>

      {/* Scanner Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="relative w-full max-w-sm">
          {/* Scanner container */}
          <div className="bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border border-gray-700 relative">
            <div id="qr-reader" className="w-full"></div>

            {/* Scanner Frame Overlay */}
            {scanning && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-[280px] h-[280px] relative">
                  {/* Corner brackets */}
                  <div className="absolute top-0 left-0 w-10 h-10 border-t-3 border-l-3 border-teal-400 rounded-tl-lg"></div>
                  <div className="absolute top-0 right-0 w-10 h-10 border-t-3 border-r-3 border-teal-400 rounded-tr-lg"></div>
                  <div className="absolute bottom-0 left-0 w-10 h-10 border-b-3 border-l-3 border-teal-400 rounded-bl-lg"></div>
                  <div className="absolute bottom-0 right-0 w-10 h-10 border-b-3 border-r-3 border-teal-400 rounded-br-lg"></div>
                  {/* Scan line animation */}
                  <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent scan-line"></div>
                </div>
              </div>
            )}
          </div>

          {/* Scan indicator */}
          {scanning && (
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
              <div className="bg-teal-500/90 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2 shadow-lg shadow-teal-500/30">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span className="text-white text-sm font-medium">جاري المسح...</span>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-10 text-center">
          <p className="text-gray-300 text-sm">وجّه الكاميرا نحو رمز QR الخاص بالراكب</p>
          <p className="text-gray-500 text-xs mt-1">Point camera at passenger's QR code</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-5 py-3 rounded-xl max-w-sm w-full text-center animate-pulse">
            {error}
          </div>
        )}
      </div>

      {/* Bottom */}
      <div className="px-4 pb-8">
        <button
          onClick={() => navigate('/')}
          className="w-full border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 py-3 rounded-xl transition-colors cursor-pointer"
        >
          إلغاء — Cancel
        </button>
      </div>

      {/* Scan line animation CSS */}
      <style>{`
        @keyframes scanLine {
          0% { top: 8px; }
          50% { top: calc(100% - 8px); }
          100% { top: 8px; }
        }
        .scan-line {
          animation: scanLine 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
