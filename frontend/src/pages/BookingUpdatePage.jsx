import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function BookingUpdatePage() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true, error: null, data: null });

  useEffect(() => {
    if (!token) return;
    setState({ loading: true, error: null, data: null });

    fetch(`${API_URL}/api/public/booking-update/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error('Solicitud de cambio no encontrada');
        return res.json();
      })
      .then((data) => {
        if (data.checkoutUrl) {
          // Redirect to Stripe checkout
          window.location.href = data.checkoutUrl;
          return;
        }
        setState({ loading: false, error: null, data });
      })
      .catch((err) => {
        setState({ loading: false, error: err.message, data: null });
      });
  }, [token]);

  if (!token) {
    return (
      <div className="min-h-screen bg-princess-dark flex items-center justify-center p-4">
        <div className="bg-white/10 border border-red-500/30 rounded-2xl p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Enlace no válido</h1>
          <p className="text-gray-400">No se ha proporcionado un identificador de cambio.</p>
        </div>
      </div>
    );
  }

  if (state.loading) {
    return (
      <div className="min-h-screen bg-princess-dark flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-princess-pink mx-auto mb-4" />
          <p className="text-white/80 text-sm">Verificando solicitud de cambio...</p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-princess-dark flex items-center justify-center p-4">
        <div className="bg-white/10 border border-red-500/30 rounded-2xl p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Error</h1>
          <p className="text-gray-400">{state.error}</p>
        </div>
      </div>
    );
  }

  const data = state.data;

  // Already paid
  if (data?.status === 'paid') {
    return (
      <div className="min-h-screen bg-princess-dark flex items-center justify-center p-4">
        <div className="bg-white/10 border border-green-500/30 rounded-2xl p-8 text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">¡Solicitud de cambio completada!</h1>
          <p className="text-gray-300 mb-4">El cambio de pack ya ha sido procesado y pagado anteriormente.</p>
          <div className="bg-white/5 rounded-xl p-4 text-left text-sm space-y-2">
            <div className="flex justify-between text-gray-400">
              <span>Pack anterior:</span>
              <span className="text-white">{data.oldPackName || data.oldPackType}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Nuevo pack:</span>
              <span className="text-white">{data.newPackName || data.newPackType}</span>
            </div>
            <div className="flex justify-between text-green-400 font-bold pt-2 border-t border-white/10">
              <span>Pagado:</span>
              <span>{(data.differenceCents / 100).toFixed(2)}€</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Awaiting payment (no checkoutUrl - fallback)
  if (data?.status === 'awaiting_payment') {
    return (
      <div className="min-h-screen bg-princess-dark flex items-center justify-center p-4">
        <div className="bg-white/10 border border-amber-500/30 rounded-2xl p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Solicitud de cambio pendiente</h1>
          <p className="text-gray-300 mb-4">Esta solicitud de cambio de pack aún no ha sido pagada.</p>
          <div className="bg-white/5 rounded-xl p-4 text-left text-sm space-y-2 mb-4">
            <div className="flex justify-between text-gray-400">
              <span>Cliente:</span>
              <span className="text-white">{data.bookingName}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Nuevo pack:</span>
              <span className="text-white">{data.newPackName || data.newPackType}</span>
            </div>
            <div className="flex justify-between text-amber-400 font-bold pt-2 border-t border-white/10">
              <span>Suplemento:</span>
              <span>{(data.differenceCents / 100).toFixed(2)}€</span>
            </div>
          </div>
          <p className="text-gray-500 text-xs">Si acabas de realizar el pago, espera unos segundos y recarga la página.</p>
        </div>
      </div>
    );
  }

  return null;
}
