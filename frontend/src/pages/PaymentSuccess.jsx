import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { CheckCircle, Ticket, User, Mail, Calendar, Home, Sparkles, Package, AlertTriangle, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const allergenNames = {
  gluten: 'Gluten',
  crustaceans: 'Crustáceos',
  eggs: 'Huevos',
  fish: 'Pescado',
  peanuts: 'Cacahuetes',
  soy: 'Soja',
  dairy: 'Lácteos',
  nuts: 'Frutos secos',
  celery: 'Apio',
  mustard: 'Mostaza',
  sesame: 'Sésamo',
  sulfites: 'Sulfitos',
  lupin: 'Altramuces',
  mollusks: 'Moluscos',
};

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const bookingId = searchParams.get('bookingId') || searchParams.get('session_id');
  const updateToken = searchParams.get('update_token');

  useEffect(() => {
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#ff6b9d', '#9b59b6', '#f1c40f'],
    });

    const timer = setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 120,
        origin: { y: 0.5 },
        colors: ['#ff6b9d', '#9b59b6', '#f1c40f'],
      });
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Handle booking update payment success
    if (updateToken) {
      setLoading(false);
      setBooking({ _type: 'booking_update', token: updateToken });
      return;
    }

    if (!bookingId) {
      setError('No se encontró la reserva');
      setLoading(false);
      return;
    }

    const loadBooking = async () => {
      try {
        // First, verify the session and ensure booking exists
        const verifyRes = await fetch(`${API_URL}/api/public/verify-session/${bookingId}`);
        if (!verifyRes.ok) {
          const errData = await verifyRes.json();
          throw new Error(errData.error || 'No se pudo verificar el pago');
        }
        const verifyData = await verifyRes.json();
        const actualBookingId = verifyData.bookingId;

        // Now fetch the full booking data
        const res = await fetch(`${API_URL}/api/public/bookings/${actualBookingId}`);
        if (!res.ok) {
          throw new Error('No se pudo cargar la reserva');
        }
        const data = await res.json();
        setBooking(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadBooking();
  }, [bookingId]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-magic-dark flex items-center justify-center">
        <div className="animate-pulse text-white text-xl">Cargando reserva...</div>
      </div>
    );
  }

  // Booking update payment success
  if (booking?._type === 'booking_update') {
    return <BookingUpdateSuccess token={booking.token} />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-magic-dark flex items-center justify-center px-4">
        <div className="glass rounded-3xl p-8 text-center max-w-md">
          <div className="text-red-400 text-xl mb-4">{error}</div>
          <Link to="/" className="btn-primary inline-flex items-center gap-2">
            <Home className="w-5 h-5" />
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const totalAmount = booking.totalAmountCents / 100;

  return (
    <div className="min-h-screen bg-magic-dark py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="glass rounded-3xl p-8 md:p-12 text-center">
          {/* Success icon */}
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-400" />
          </div>

          <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">
            ¡Pago Completado!
          </h1>
          <p className="text-white/70 mb-8">
            Tu reserva ha sido confirmada. Guarda este código QR para acceder al evento.
          </p>

          {/* QR Code */}
          <div className="bg-white p-6 rounded-2xl inline-block mb-8">
            <QRCodeSVG
              value={booking.qrToken || booking.id}
              size={200}
              level="H"
              includeMargin
            />
          </div>

          {/* Booking info */}
          <div className="text-left space-y-4 mb-8">
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
              <Calendar className="w-5 h-5 text-princess-gold" />
              <div>
                <p className="text-white/60 text-sm">Fecha del evento</p>
                <p className="text-white font-medium">{formatDate(booking.eventDate)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
              <User className="w-5 h-5 text-princess-pink" />
              <div>
                <p className="text-white/60 text-sm">Nombre</p>
                <p className="text-white font-medium">{booking.name} {booking.surname}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
              <Mail className="w-5 h-5 text-princess-pink" />
              <div>
                <p className="text-white/60 text-sm">Email</p>
                <p className="text-white font-medium">{booking.email}</p>
              </div>
            </div>

            {/* Tickets breakdown */}
            <div className="p-4 bg-white/5 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <Ticket className="w-5 h-5 text-princess-purple" />
                <p className="text-white font-medium">Desglose de entradas</p>
              </div>
              
              <div className="space-y-3">
                {/* Packs */}
                {booking.items?.filter(item => item.itemType === 'pack').map((item, idx) => (
                  <div key={idx} className="p-3 bg-gradient-to-r from-princess-purple/20 to-princess-pink/20 rounded-lg border border-princess-purple/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-princess-gold" />
                        <span className="text-white font-semibold">
                          {item.packName || item.packType}
                          {item.quantity > 1 && ` x${item.quantity}`}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {item.hasPhotographer && (
                          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">📸</span>
                        )}
                        {item.hasPremiumPass && (
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">👑</span>
                        )}
                      </div>
                    </div>
                    <p className="text-white/70 text-sm">
                      Incluye: {item.adults * (item.quantity || 1)} adulto(s), {item.children * (item.quantity || 1)} niño(s)
                    </p>
                  </div>
                ))}

                {/* Individual tickets */}
                {booking.items?.filter(item => item.itemType === 'individual').map((item, idx) => (
                  <div key={`ind-${idx}`} className="p-3 bg-white/10 rounded-lg border border-white/20">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-princess-pink" />
                      <span className="text-white font-semibold">Entradas individuales</span>
                    </div>
                    <p className="text-white/70 text-sm">
                      {item.adults > 0 && `${item.adults} adulto(s)`}
                      {item.adults > 0 && item.children > 0 && ', '}
                      {item.children > 0 && `${item.children} niño(s)`}
                    </p>
                  </div>
                ))}
              </div>

              {/* Total summary */}
              <div className="mt-4 pt-3 border-t border-white/20 flex justify-between items-center">
                <span className="text-white/60 text-sm">Total entradas:</span>
                <span className="text-white font-medium">
                  {booking.adultsCount} adulto(s), {booking.childrenCount} niño(s)
                </span>
              </div>
            </div>

            {/* Allergies */}
            {booking.memberAllergies?.length > 0 && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <p className="text-amber-400 font-medium">Alergias registradas</p>
                </div>
                <div className="space-y-2">
                  {booking.memberAllergies.map((member, idx) => (
                    <div key={idx} className="text-sm">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs mr-2 ${member.memberType === 'adult' ? 'bg-princess-purple/30 text-princess-purple' : 'bg-princess-gold/30 text-princess-gold'}`}>
                        {member.memberType === 'adult' ? 'Adulto' : 'Niño/a'}
                      </span>
                      <span className="text-white font-medium">{member.name} {member.lastname}</span>
                      <p className="text-amber-300/80 mt-1 ml-1">
                        {member.allergies.map(a => allergenNames[a] || a).join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 bg-gradient-to-r from-princess-pink/20 to-princess-purple/20 rounded-xl flex justify-between items-center">
              <span className="text-white font-semibold">Total pagado</span>
              <span className="text-2xl font-bold text-gradient">{totalAmount.toFixed(2)}€</span>
            </div>
          </div>

          {/* Age restriction notice */}
          <div className="p-4 bg-princess-pink/10 border-2 border-princess-pink rounded-xl mb-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-princess-pink flex-shrink-0" />
              <p className="text-white font-medium">
                <span className="text-princess-pink font-bold">Importante:</span> Evento exclusivo para niños a partir de 3 años
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="p-4 bg-princess-gold/10 border border-princess-gold/30 rounded-xl mb-8">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-princess-gold mt-0.5" />
              <p className="text-white/80 text-sm text-left">
                Presenta este código QR en la entrada del evento. También te hemos enviado
                un email de confirmación con todos los detalles.
              </p>
            </div>
          </div>

          <Link to="/" className="btn-primary inline-flex items-center gap-2">
            <Home className="w-5 h-5" />
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
// Build 1781351798

function BookingUpdateSuccess({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/public/booking-update/${token}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-magic-dark flex items-center justify-center">
        <div className="animate-pulse text-white text-xl">Verificando pago...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-magic-dark py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="glass rounded-3xl p-8 md:p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-400" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white mb-2">¡Pago Completado!</h1>
          <p className="text-white/70 mb-8">El suplemento ha sido abonado correctamente.</p>

          <div className="text-left space-y-4 mb-8">
            <div className="p-4 bg-white/5 rounded-xl">
              <p className="text-white/60 text-sm mb-2">Detalles del cambio</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Pack anterior:</span>
                  <span className="text-white">{data?.oldPackName || data?.oldPackType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Nuevo pack:</span>
                  <span className="text-white">{data?.newPackName || data?.newPackType}</span>
                </div>
                <div className="flex justify-between font-bold text-green-400 pt-2 border-t border-white/10">
                  <span>Pagado:</span>
                  <span>{(data?.differenceCents / 100).toFixed(2)}€</span>
                </div>
              </div>
            </div>
          </div>

          <Link to="/" className="btn-primary inline-flex items-center gap-2">
            <Home className="w-5 h-5" />
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
