import { useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { ArrowLeft, CreditCard, Check, Loader2, User, Mail, Phone, Ticket, Tag, AlertTriangle, Package, Camera, Crown } from 'lucide-react';
import { setStep, setAcceptedTerms, setAcceptedPrivacy, selectPacks, selectCartItems, selectBookingTotals } from '../../store/bookingSlice';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function BookingSummary() {
  const dispatch = useDispatch();
  const booking = useSelector((state) => state.booking);
  const settings = useSelector((state) => state.settings.data);
  const packs = useSelector(selectPacks);
  const packsMap = useMemo(() => Object.fromEntries(packs.map((p) => [p.id, p])), [packs]);
  const cartItems = useSelector(selectCartItems);
  const totals = useSelector(selectBookingTotals);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const adultPrice = settings?.adultPriceCents ? settings.adultPriceCents / 100 : 35;
  const childPrice = settings?.childPriceCents ? settings.childPriceCents / 100 : 49;

  // Discount calculation (applies to both individual tickets AND packs)
  const earlyBirdCount = settings?.earlyBirdCount || 0;
  const earlyBirdDiscountPercent = settings?.earlyBirdDiscountPercent || 0;
  const paidBookingsCount = settings?.paidBookingsCount || 0;
  const hasDiscount = earlyBirdCount > 0 && earlyBirdDiscountPercent > 0 && paidBookingsCount < earlyBirdCount;

  const discountMultiplier = hasDiscount ? (100 - earlyBirdDiscountPercent) / 100 : 1;
  const discountedAdultPrice = adultPrice * discountMultiplier;
  const discountedChildPrice = childPrice * discountMultiplier;

  const selectedPacks = Object.entries(booking.packQuantities || {})
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ pack: packsMap[id], qty }))
    .filter((e) => e.pack);

  const packsOriginal = selectedPacks.reduce((acc, { pack, qty }) => acc + pack.price * qty, 0);
  const individualOriginal = booking.adultsCount * adultPrice + booking.childrenCount * childPrice;
  const originalTotal = packsOriginal + individualOriginal;
  const totalAmount = originalTotal * discountMultiplier;
  const discountAmount = originalTotal - totalAmount;

  // Count members with allergies
  const membersWithAllergies = booking.memberAllergies.filter(m => m.allergies && m.allergies.length > 0);
  const totalAllergies = membersWithAllergies.reduce((acc, m) => acc + m.allergies.length, 0);

  const formatDate = (dateString) => {
    if (!dateString) return 'Por confirmar';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const canPay = booking.acceptedTerms && booking.acceptedPrivacy;

  const handlePayment = async () => {
    if (!canPay) return;

    setLoading(true);
    setError(null);

    try {
      const allergiesPayload = booking.memberAllergies
        .filter(m => m.allergies && m.allergies.length > 0)
        .map(m => ({
          memberType: m.memberType,
          memberIndex: m.memberIndex,
          name: m.name,
          lastname: m.lastname,
          allergies: m.allergies,
        }));

      const requestBody = {
        name: booking.name,
        surname: booking.surname,
        email: booking.email,
        phoneCountryCode: booking.phoneCountryCode,
        phoneNumber: booking.phoneNumber,
        adultsCount: totals.adults,
        childrenCount: totals.children,
        items: cartItems,
        memberAllergies: allergiesPayload,
        eventDateId: booking.eventDateId || 0,
      };

      const res = await fetch(`${API_URL}/api/public/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al procesar el pago');
      }

      const { checkoutUrl } = await res.json();
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-display font-bold text-white text-center mb-6">
        Resumen de tu reserva
      </h3>

      {/* Discount Banner */}
      {hasDiscount && (
        <div className="p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl">
          <div className="flex items-center gap-2 text-green-400">
            <Tag className="w-5 h-5" />
            <span className="font-semibold">¡Promoción Primeras Reservas aplicada! (-{earlyBirdDiscountPercent}%)</span>
          </div>
          <p className="text-green-300/80 text-sm mt-1">
            Quedan {earlyBirdCount - paidBookingsCount} plazas con descuento
          </p>
        </div>
      )}

      {/* Event date */}
      <div className="p-4 bg-gradient-to-r from-princess-gold/20 to-princess-pink/20 rounded-xl text-center">
        <p className="text-white/60 text-sm">Fecha del evento</p>
        <p className="text-white font-semibold">{formatDate(settings?.eventDate)}</p>
      </div>

      {/* Buyer info */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
          <User className="w-5 h-5 text-princess-pink" />
          <div>
            <p className="text-white/60 text-sm">Nombre</p>
            <p className="text-white font-medium">{booking.name} {booking.surname}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
          <Mail className="w-5 h-5 text-princess-pink" />
          <div>
            <p className="text-white/60 text-sm">Email</p>
            <p className="text-white font-medium">{booking.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
          <Phone className="w-5 h-5 text-princess-pink" />
          <div>
            <p className="text-white/60 text-sm">Teléfono</p>
            <p className="text-white font-medium">{booking.phoneCountryCode} {booking.phoneNumber}</p>
          </div>
        </div>
      </div>

      {/* Allergies summary */}
      {membersWithAllergies.length > 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-semibold">Alergias registradas</span>
          </div>
          <p className="text-amber-300/80 text-sm">
            {membersWithAllergies.length} asistente{membersWithAllergies.length > 1 ? 's' : ''} con {totalAllergies} alergia{totalAllergies > 1 ? 's' : ''} en total
          </p>
        </div>
      )}

      {/* Cart summary */}
      <div className="p-4 bg-white/5 rounded-xl space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <Ticket className="w-5 h-5 text-princess-gold" />
          <span className="text-white font-semibold">Tu compra</span>
        </div>

        {selectedPacks.map(({ pack, qty }) => (
          <div key={pack.id} className="flex justify-between text-white/80">
            <span className="flex items-center gap-2">
              <Package className="w-4 h-4 text-princess-gold" />
              {pack.name} ({qty}x)
              {pack.hasPhotographer && <Camera className="w-4 h-4 text-blue-400" />}
              {pack.hasPremiumPass && <Crown className="w-4 h-4 text-purple-400" />}
            </span>
            <span className="flex items-center gap-2">
              {hasDiscount && (
                <span className="line-through text-white/40">{(pack.price * qty).toFixed(2)}€</span>
              )}
              <span>{(pack.price * qty * discountMultiplier).toFixed(2)}€</span>
            </span>
          </div>
        ))}

        {booking.adultsCount > 0 && (
          <div className="flex justify-between text-white/80">
            <span>Adultos ({booking.adultsCount}x {discountedAdultPrice.toFixed(2)}€)</span>
            <span className="flex items-center gap-2">
              {hasDiscount && (
                <span className="line-through text-white/40">{(booking.adultsCount * adultPrice).toFixed(2)}€</span>
              )}
              <span>{(booking.adultsCount * discountedAdultPrice).toFixed(2)}€</span>
            </span>
          </div>
        )}
        {booking.childrenCount > 0 && (
          <div className="flex justify-between text-white/80">
            <span>Niños ({booking.childrenCount}x {discountedChildPrice.toFixed(2)}€)</span>
            <span className="flex items-center gap-2">
              {hasDiscount && (
                <span className="line-through text-white/40">{(booking.childrenCount * childPrice).toFixed(2)}€</span>
              )}
              <span>{(booking.childrenCount * discountedChildPrice).toFixed(2)}€</span>
            </span>
          </div>
        )}

        {hasDiscount && discountAmount > 0 && (
          <div className="flex justify-between text-green-400 pt-2">
            <span>Dto. Primeras Reservas (-{earlyBirdDiscountPercent}%)</span>
            <span>-{discountAmount.toFixed(2)}€</span>
          </div>
        )}

        <div className="border-t border-white/20 pt-3 flex justify-between">
          <span className="text-white font-semibold">Total ({totals.totalTickets} entradas)</span>
          <span className={`text-2xl font-bold ${hasDiscount ? 'text-green-400' : 'text-gradient'}`}>{totalAmount.toFixed(2)}€</span>
        </div>
      </div>

      {/* Legal checkboxes */}
      <div className="space-y-3">
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              checked={booking.acceptedPrivacy}
              onChange={(e) => dispatch(setAcceptedPrivacy(e.target.checked))}
              className="sr-only"
            />
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              booking.acceptedPrivacy ? 'bg-princess-pink border-princess-pink' : 'border-white/40 group-hover:border-white/60'
            }`}>
              {booking.acceptedPrivacy && <Check className="w-3 h-3 text-white" />}
            </div>
          </div>
          <span className="text-white/70 text-sm">
            He leído y acepto la <a href="#" className="text-princess-pink hover:underline">Política de Privacidad</a>
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              checked={booking.acceptedTerms}
              onChange={(e) => dispatch(setAcceptedTerms(e.target.checked))}
              className="sr-only"
            />
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              booking.acceptedTerms ? 'bg-princess-pink border-princess-pink' : 'border-white/40 group-hover:border-white/60'
            }`}>
              {booking.acceptedTerms && <Check className="w-3 h-3 text-white" />}
            </div>
          </div>
          <span className="text-white/70 text-sm">
            Acepto los <a href="#" className="text-princess-pink hover:underline">Términos y Condiciones</a>
          </span>
        </label>
      </div>

      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-4 pt-4">
        <button
          onClick={() => dispatch(setStep(3))}
          disabled={loading}
          className="btn-secondary flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Atrás
        </button>
        <button
          onClick={handlePayment}
          disabled={!canPay || loading}
          className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              Pagar {totalAmount.toFixed(2)}€
            </>
          )}
        </button>
      </div>
    </div>
  );
}
