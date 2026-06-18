import { useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Minus, Plus, User, Baby, ArrowRight, Tag, Camera, Crown } from 'lucide-react';
import {
  setAdultsCount,
  setChildrenCount,
  setStep,
  setPackQuantity,
  selectPacks,
  selectBookingTotals,
} from '../../store/bookingSlice';

function PackCard({ pack, quantity, onChange, discountPercent, remainingCapacity }) {
  const hasDiscount = discountPercent > 0;
  const discountedPrice = hasDiscount ? (pack.price * (100 - discountPercent)) / 100 : pack.price;
  const packSize = Math.max(1, (pack.adults || 0) + (pack.children || 0));
  // The per-pack limit counts packs (units), not the tickets inside each pack.
  const limitReached = pack.maxLimitEnabled && pack.availableTickets < quantity + 1;
  const noCapacity = remainingCapacity < packSize;
  const isCompleted = !!pack.completed || (pack.maxLimitEnabled && pack.availableTickets < 1);
  const showAvailability = pack.maxLimitEnabled && !isCompleted;
  const isSelected = quantity > 0;

  return (
    <div
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all relative overflow-hidden ${
        isCompleted
          ? 'border-white/10 bg-white/5 opacity-60'
          : isSelected
            ? 'border-princess-pink bg-princess-pink/20'
            : 'border-white/20 bg-white/5'
      }`}
    >
      {/* Completo ribbon */}
      {isCompleted && (
        <span className="absolute top-4 -right-12 w-44 rotate-45 bg-red-600 text-white text-center text-xs font-bold py-1 shadow-lg z-10">
          Completo
        </span>
      )}

      {/* Discount badge */}
      {hasDiscount && !isCompleted && (
        <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
          -{discountPercent}%
        </div>
      )}

      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{pack.emoji}</span>
          <div>
            <h4 className="text-white font-semibold">{pack.name}</h4>
            <p className="text-white/60 text-xs">{pack.adults} adulto + {pack.children} niño{pack.children > 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="text-right">
          {hasDiscount ? (
            <div>
              <p className="text-white/40 line-through text-sm">{pack.price}€</p>
              <p className="text-2xl font-bold text-green-400">{discountedPrice.toFixed(2)}€</p>
            </div>
          ) : (
            <p className="text-2xl font-bold text-gradient">{pack.price}€</p>
          )}
        </div>
      </div>

      <p className="text-white/70 text-sm mb-3">{pack.description}</p>

      <div className="flex flex-wrap gap-2 items-center mb-3">
        {showAvailability && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-300 rounded-full text-xs">
            Quedan {pack.availableTickets} pack{pack.availableTickets === 1 ? '' : 's'} disponible{pack.availableTickets === 1 ? '' : 's'}
          </span>
        )}
        {pack.hasPhotographer && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs">
            <Camera className="w-3 h-3" /> Fotógrafo
          </span>
        )}
        {pack.hasPremiumPass && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs">
            <Crown className="w-3 h-3" /> Premium
          </span>
        )}
      </div>

      {/* Quantity selector */}
      <div className="flex items-center justify-between">
        <span className="text-white/60 text-sm">Cantidad</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onChange(pack.id, Math.max(0, quantity - 1))}
            disabled={quantity === 0}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Minus className="w-4 h-4 text-white" />
          </button>
          <span className="text-2xl font-bold text-white w-8 text-center">{quantity}</span>
          <button
            onClick={() => onChange(pack.id, quantity + 1)}
            disabled={isCompleted || limitReached || noCapacity}
            className="w-9 h-9 rounded-full bg-princess-pink flex items-center justify-center hover:bg-princess-pink/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Plus className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TicketCounter() {
  const dispatch = useDispatch();
  const { adultsCount, childrenCount, packQuantities } = useSelector((state) => state.booking);
  const { availableTickets } = useSelector((state) => state.capacity);
  const settings = useSelector((state) => state.settings.data);
  const packs = useSelector(selectPacks);
  const packsMap = useMemo(() => Object.fromEntries(packs.map((p) => [p.id, p])), [packs]);
  const totals = useSelector(selectBookingTotals);

  const adultPrice = settings?.adultPriceCents ? settings.adultPriceCents / 100 : 35;
  const childPrice = settings?.childPriceCents ? settings.childPriceCents / 100 : 49;

  // Individual ticket limits per purchase (0 = unlimited)
  const maxIndividualAdults = settings?.maxIndividualAdultTickets || 0;
  const maxIndividualChildren = settings?.maxIndividualChildTickets || 0;

  // Early bird discount calculation
  const earlyBirdCount = settings?.earlyBirdCount || 0;
  const earlyBirdDiscountPercent = settings?.earlyBirdDiscountPercent || 0;
  const paidBookingsCount = settings?.paidBookingsCount || 0;
  const hasEarlyBird = earlyBirdCount > 0 && earlyBirdDiscountPercent > 0 && paidBookingsCount < earlyBirdCount;
  const remainingEarlyBird = earlyBirdCount - paidBookingsCount;

  const discountMultiplier = hasEarlyBird ? (100 - earlyBirdDiscountPercent) / 100 : 1;
  const discountedAdultPrice = adultPrice * discountMultiplier;
  const discountedChildPrice = childPrice * discountMultiplier;

  // Totals across packs + individual tickets
  const totalTickets = totals.totalTickets;
  const canAddMore = totalTickets < availableTickets;
  const remainingCapacity = availableTickets - totalTickets;

  const individualOriginal = adultsCount * adultPrice + childrenCount * childPrice;
  const individualTotal = adultsCount * discountedAdultPrice + childrenCount * discountedChildPrice;

  const packsOriginal = Object.entries(packQuantities).reduce((acc, [id, qty]) => {
    const p = packsMap[id];
    return acc + (p ? p.price * qty : 0);
  }, 0);
  const packsTotal = packsOriginal * discountMultiplier;

  const originalTotal = individualOriginal + packsOriginal;
  const totalAmount = individualTotal + packsTotal;
  const discountAmount = originalTotal - totalAmount;

  const selectedPacks = Object.entries(packQuantities)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ pack: packsMap[id], qty }))
    .filter((e) => e.pack);

  // Check if individual limits are reached
  const adultLimitReached = maxIndividualAdults > 0 && adultsCount >= maxIndividualAdults;
  const childLimitReached = maxIndividualChildren > 0 && childrenCount >= maxIndividualChildren;

  const handleAdultChange = (delta) => {
    if (delta > 0 && !canAddMore) return;
    if (delta > 0 && adultLimitReached) return;
    dispatch(setAdultsCount(Math.max(0, adultsCount + delta)));
  };

  const handleChildChange = (delta) => {
    if (delta > 0 && !canAddMore) return;
    if (delta > 0 && childLimitReached) return;
    dispatch(setChildrenCount(Math.max(0, childrenCount + delta)));
  };

  const handlePackChange = (packId, quantity) => {
    dispatch(setPackQuantity({ packId, quantity }));
  };

  const handleNext = () => {
    if (totalTickets > 0) dispatch(setStep(2));
  };

  return (
    <div className="space-y-6">
      {/* Early Bird Banner */}
      {hasEarlyBird && (
        <div className="p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl">
          <div className="flex items-center gap-2 text-green-400">
            <Tag className="w-5 h-5" />
            <span className="font-semibold">¡Promoción Primeras Reservas! -{earlyBirdDiscountPercent}% de descuento</span>
          </div>
          <p className="text-green-300/80 text-sm mt-1">
            Quedan <span className="font-bold">{remainingEarlyBird}</span> plazas con descuento (aplica a entradas y packs)
          </p>
        </div>
      )}

      <div className="text-center">
        <p className="text-white/60 mb-2">Entradas disponibles</p>
        <p className="text-3xl font-bold text-white">{availableTickets}</p>
      </div>

      <p className="text-white/70 text-sm text-center">
        Puedes combinar varios packs y entradas individuales en la misma compra.
      </p>

      {/* Packs section */}
      <div className="grid gap-4">
        {packs.map((pack) => (
          <PackCard
            key={pack.id}
            pack={pack}
            quantity={packQuantities[pack.id] || 0}
            onChange={handlePackChange}
            discountPercent={hasEarlyBird ? earlyBirdDiscountPercent : 0}
            remainingCapacity={remainingCapacity}
          />
        ))}
      </div>

      {/* Separator */}
      <div className="flex items-center gap-4 py-2">
        <div className="flex-1 h-px bg-white/20"></div>
        <span className="text-white/60 text-sm whitespace-nowrap">Y/o añade entradas individuales</span>
        <div className="flex-1 h-px bg-white/20"></div>
      </div>

      {/* Adult counter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-2xl transition-all relative bg-white/5">
        {hasEarlyBird && (
          <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
            -{earlyBirdDiscountPercent}%
          </div>
        )}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-princess-purple/30 flex items-center justify-center">
            <User className="w-6 h-6 text-princess-purple" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg">Adulto</h3>
            <div className="flex items-center gap-2">
              {hasEarlyBird ? (
                <>
                  <span className="text-white/40 line-through text-sm">{adultPrice.toFixed(2)}€</span>
                  <span className="text-green-400 font-medium">{discountedAdultPrice.toFixed(2)}€</span>
                  <span className="text-white/60">/ persona</span>
                </>
              ) : (
                <span className="text-white/60">{adultPrice.toFixed(2)}€ / persona</span>
              )}
            </div>
            {maxIndividualAdults > 0 && (
              <p className="text-white/50 text-xs mt-1">Máx. {maxIndividualAdults} por compra</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => handleAdultChange(-1)}
            disabled={adultsCount === 0}
            className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Minus className="w-5 h-5 text-white" />
          </button>
          <span className="text-3xl font-bold text-white w-12 text-center">{adultsCount}</span>
          <button
            onClick={() => handleAdultChange(1)}
            disabled={!canAddMore || adultLimitReached}
            className="w-12 h-12 rounded-full bg-princess-pink flex items-center justify-center hover:bg-princess-pink/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Plus className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Child counter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-2xl transition-all relative bg-white/5">
        {hasEarlyBird && (
          <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
            -{earlyBirdDiscountPercent}%
          </div>
        )}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-princess-gold/30 flex items-center justify-center">
            <Baby className="w-6 h-6 text-princess-gold" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg">Niño/a</h3>
            <div className="flex items-center gap-2">
              {hasEarlyBird ? (
                <>
                  <span className="text-white/40 line-through text-sm">{childPrice.toFixed(2)}€</span>
                  <span className="text-green-400 font-medium">{discountedChildPrice.toFixed(2)}€</span>
                  <span className="text-white/60">/ persona</span>
                </>
              ) : (
                <span className="text-white/60">{childPrice.toFixed(2)}€ / persona</span>
              )}
            </div>
            {maxIndividualChildren > 0 && (
              <p className="text-white/50 text-xs mt-1">Máx. {maxIndividualChildren} por compra</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => handleChildChange(-1)}
            disabled={childrenCount === 0}
            className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Minus className="w-5 h-5 text-white" />
          </button>
          <span className="text-3xl font-bold text-white w-12 text-center">{childrenCount}</span>
          <button
            onClick={() => handleChildChange(1)}
            disabled={!canAddMore || childLimitReached}
            className="w-12 h-12 rounded-full bg-princess-pink flex items-center justify-center hover:bg-princess-pink/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Plus className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Combined summary */}
      {totalTickets > 0 && (
        <div className="p-6 bg-gradient-to-r from-princess-pink/20 to-princess-purple/20 rounded-2xl space-y-3">
          {selectedPacks.map(({ pack, qty }) => (
            <div key={pack.id} className="flex justify-between text-white/80">
              <span>{pack.name} ({qty}x)</span>
              <span className="flex items-center gap-2">
                {hasEarlyBird && (
                  <span className="line-through text-white/40">{(pack.price * qty).toFixed(2)}€</span>
                )}
                <span>{(pack.price * qty * discountMultiplier).toFixed(2)}€</span>
              </span>
            </div>
          ))}
          {adultsCount > 0 && (
            <div className="flex justify-between text-white/80">
              <span>Adultos ({adultsCount}x)</span>
              <span className="flex items-center gap-2">
                {hasEarlyBird && (
                  <span className="line-through text-white/40">{(adultsCount * adultPrice).toFixed(2)}€</span>
                )}
                <span>{(adultsCount * discountedAdultPrice).toFixed(2)}€</span>
              </span>
            </div>
          )}
          {childrenCount > 0 && (
            <div className="flex justify-between text-white/80">
              <span>Niños ({childrenCount}x)</span>
              <span className="flex items-center gap-2">
                {hasEarlyBird && (
                  <span className="line-through text-white/40">{(childrenCount * childPrice).toFixed(2)}€</span>
                )}
                <span>{(childrenCount * discountedChildPrice).toFixed(2)}€</span>
              </span>
            </div>
          )}
          {hasEarlyBird && discountAmount > 0 && (
            <div className="flex justify-between text-green-400">
              <span>Dto. Primeras Reservas (-{earlyBirdDiscountPercent}%)</span>
              <span>-{discountAmount.toFixed(2)}€</span>
            </div>
          )}
          <div className="border-t border-white/20 pt-3 flex justify-between">
            <span className="text-white font-semibold">Total ({totalTickets} entradas)</span>
            <span className="text-2xl font-bold text-white">{totalAmount.toFixed(2)}€</span>
          </div>
        </div>
      )}

      {/* Next button */}
      <button
        onClick={handleNext}
        disabled={totalTickets === 0}
        className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Continuar
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}
