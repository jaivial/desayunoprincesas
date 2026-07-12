import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Camera, Loader2, KeyRound, AlertTriangle } from 'lucide-react';
import { getAuthHeaders } from '../store/authSlice';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function QRReaderPage() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [manualToken, setManualToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isHttps = window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  useEffect(() => {
    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
      }
    };
  }, []);

  const confirmQR = async (qrToken) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/qr/confirm`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ qrToken }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'QR inválido');
      }

      const data = await res.json();
      navigate('/qr-confirm', { state: data });
    } catch (e) {
      setError(e.message);
    }
  };

  const startScanning = async () => {
    setError(null);
    setScanning(true);

    try {
      const reader = new BrowserMultiFormatReader();
      
      controlsRef.current = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        async (result) => {
          if (result) {
            const qrToken = result.getText();
            if (controlsRef.current) {
              controlsRef.current.stop();
            }
            setScanning(false);
            await confirmQR(qrToken);
          }
        }
      );
    } catch (e) {
      console.error('Camera error:', e);
      setError('No se pudo acceder a la cámara. Usa la entrada manual de código QR.');
      setScanning(false);
    }
  };

  const stopScanning = () => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    setScanning(false);
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    
    setError(null);
    setSubmitting(true);
    await confirmQR(manualToken.trim());
    setSubmitting(false);
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Lector de QR</h1>

      {/* HTTPS Warning */}
      {!isHttps && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-yellow-800 font-medium text-sm sm:text-base">Cámara no disponible</p>
            <p className="text-yellow-700 text-xs sm:text-sm mt-1">
              El acceso a la cámara requiere HTTPS. Usa la entrada manual de código QR o accede desde localhost.
            </p>
          </div>
        </div>
      )}

      {/* Camera Scanner (only show if HTTPS) */}
      {isHttps && (
        <div className="card mb-4 sm:mb-6 p-4 sm:p-6">
          <h2 className="font-semibold mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
            <Camera className="w-5 h-5" />
            Escanear con cámara
          </h2>
          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4 relative">
            <video ref={videoRef} className="w-full h-full object-cover" />
            {!scanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                <Camera className="w-12 sm:w-16 h-12 sm:h-16 text-gray-400" />
              </div>
            )}
          </div>

          <div className="flex gap-3">
            {!scanning ? (
              <button onClick={startScanning} className="btn btn-primary flex-1 flex items-center justify-center gap-2">
                <Camera className="w-5 h-5" />
                <span className="text-sm sm:text-base">Iniciar escaneo</span>
              </button>
            ) : (
              <button onClick={stopScanning} className="btn btn-secondary flex-1 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm sm:text-base">Escaneando...</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Manual QR Input */}
      <div className="card p-4 sm:p-6">
        <h2 className="font-semibold mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
          <KeyRound className="w-5 h-5" />
          Entrada manual de código
        </h2>
        <form onSubmit={handleManualSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código QR / Token
            </label>
            <input
              type="text"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              className="input"
              placeholder="Introduce el código del QR..."
              disabled={submitting}
            />
            <p className="text-xs text-gray-500 mt-1">
              El código aparece debajo del QR en el email de confirmación
            </p>
          </div>
          <button
            type="submit"
            disabled={!manualToken.trim() || submitting}
            className="btn btn-primary w-full flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm sm:text-base">Verificando...</span>
              </>
            ) : (
              <span className="text-sm sm:text-base">Confirmar asistencia</span>
            )}
          </button>
        </form>
      </div>

      {/* Error display */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
