import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';

export default function ScannerPage() {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let html5Qr = null;

    const startScanner = async () => {
      try {
        html5Qr = new Html5Qrcode('qr-reader');
        scannerRef.current = html5Qr;

        await html5Qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            // Parse the QR payload
            try {
              const data = JSON.parse(decodedText);
              if (data.uid && data.type === 'activation') {
                html5Qr.stop().catch(() => {});
                navigate(`/activate/${data.uid}`);
              } else {
                setError('رمز QR غير صالح — Invalid QR code format');
              }
            } catch {
              setError('رمز QR غير صالح — Could not parse QR data');
            }
          },
          () => {} // ignore scan failures
        );
        setScanning(true);
      } catch (err) {
        setError('تعذر الوصول للكاميرا — Camera access denied');
        console.error('Scanner error:', err);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [navigate]);

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
          {/* Pulse ring */}
          {scanning && (
            <div className="absolute inset-0 rounded-2xl border-2 border-teal-400/50 pulse-ring"></div>
          )}

          {/* Scanner container */}
          <div className="bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border border-gray-700">
            <div id="qr-reader" className="w-full"></div>
          </div>

          {/* Scan indicator */}
          {scanning && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <div className="bg-teal-500/90 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span className="text-white text-sm font-medium">جاري المسح...</span>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 text-center">
          <p className="text-gray-300 text-sm">وجّه الكاميرا نحو رمز QR الخاص بالراكب</p>
          <p className="text-gray-500 text-xs mt-1">Point camera at passenger's QR code</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-5 py-3 rounded-xl max-w-sm w-full text-center">
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
    </div>
  );
}
