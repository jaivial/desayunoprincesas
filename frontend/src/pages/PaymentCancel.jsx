import { Link } from 'react-router-dom';
import { XCircle, Home, RefreshCw } from 'lucide-react';

export default function PaymentCancel() {
  return (
    <div className="min-h-screen bg-magic-dark flex items-center justify-center px-4">
      <div className="glass rounded-3xl p-8 md:p-12 text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-12 h-12 text-red-400" />
        </div>

        <h1 className="font-display text-3xl font-bold text-white mb-2">
          Pago Cancelado
        </h1>
        <p className="text-white/70 mb-8">
          El proceso de pago ha sido cancelado. No se ha realizado ningún cargo.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/" className="btn-secondary inline-flex items-center justify-center gap-2">
            <Home className="w-5 h-5" />
            Volver al inicio
          </Link>
          <Link to="/#entradas" className="btn-primary inline-flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Reintentar
          </Link>
        </div>
      </div>
    </div>
  );
}
