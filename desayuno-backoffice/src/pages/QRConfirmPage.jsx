import { useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { CheckCircle, AlertTriangle, User, Mail, Phone, ArrowLeft, Package, Camera, Crown, CalendarDays } from 'lucide-react';

// Allergen definitions
const ALLERGENS = [
  { id: 'gluten', name: 'Gluten', icon: '🌾' },
  { id: 'crustaceans', name: 'Crustáceos', icon: '🦐' },
  { id: 'eggs', name: 'Huevos', icon: '🥚' },
  { id: 'fish', name: 'Pescado', icon: '🐟' },
  { id: 'peanuts', name: 'Cacahuetes', icon: '🥜' },
  { id: 'soy', name: 'Soja', icon: '🫘' },
  { id: 'dairy', name: 'Lácteos', icon: '🥛' },
  { id: 'nuts', name: 'Frutos secos', icon: '🌰' },
  { id: 'celery', name: 'Apio', icon: '🥬' },
  { id: 'mustard', name: 'Mostaza', icon: '🟡' },
  { id: 'sesame', name: 'Sésamo', icon: '⚪' },
  { id: 'sulfites', name: 'Sulfitos', icon: '🍷' },
  { id: 'lupin', name: 'Altramuces', icon: '🌸' },
  { id: 'mollusks', name: 'Moluscos', icon: '🦪' },
];

const getAllergenInfo = (id) => ALLERGENS.find(a => a.id === id) || { id, name: id, icon: '❓' };

// Pack definitions
const PACK_NAMES = {
  encantado: 'Pack Encantado',
  reino_encantado: 'Pack Reino Encantado',
  recuerdo_real_1: 'Pack Recuerdo Real 1',
  recuerdo_real_2: 'Pack Recuerdo Real 2',
  cuento_ensueno_1: 'Pack Cuento de Ensueño 1',
  cuento_ensueno_2: 'Pack Cuento de Ensueño 2',
};

export default function QRConfirmPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const data = location.state;

  useEffect(() => {
    if (!data) {
      navigate('/qr-reader');
      return;
    }

    if (!data.alreadyConfirmed) {
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 }, colors: ['#ec4899', '#8b5cf6', '#f59e0b'] });
    }
  }, [data, navigate]);

  if (!data) return null;

  const { booking, alreadyConfirmed } = data;
  const memberAllergies = booking.memberAllergies || [];

  return (
    <div className="max-w-lg mx-auto">
      <div className="card p-4 sm:p-6 text-center">
        {alreadyConfirmed ? (
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-500" />
          </div>
        ) : (
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-green-500" />
          </div>
        )}

        <h1 className="text-xl sm:text-2xl font-bold mb-2">
          {alreadyConfirmed ? '¡QR ya utilizado!' : '¡Asistencia Confirmada!'}
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
          {alreadyConfirmed ? 'Esta entrada ya fue registrada previamente.' : 'La entrada ha sido registrada correctamente.'}
        </p>

        <div className="text-left space-y-2 sm:space-y-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-3 p-2 sm:p-3 bg-gray-50 rounded-lg">
            <User className="w-5 h-5 text-primary-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Nombre</p>
              <p className="font-medium text-sm sm:text-base truncate">{booking.name} {booking.surname}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2 sm:p-3 bg-gray-50 rounded-lg">
            <Mail className="w-5 h-5 text-primary-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Email</p>
              <p className="font-medium text-sm sm:text-base truncate">{booking.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2 sm:p-3 bg-gray-50 rounded-lg">
            <Phone className="w-5 h-5 text-primary-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Teléfono</p>
              <p className="font-medium text-sm sm:text-base">{booking.phone}</p>
            </div>
          </div>

          {booking.eventDate && (
            <div className="flex items-center gap-3 p-2 sm:p-3 bg-blue-50 rounded-lg">
              <CalendarDays className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500">Día del evento</p>
                <p className="font-medium text-sm sm:text-base text-blue-700">{booking.eventDate}</p>
              </div>
            </div>
          )}

          {/* Tickets Breakdown Section */}
          <div className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              Desglose de entradas
            </h3>
            
            <div className="space-y-2">
              {/* Packs */}
              {(() => {
                const items = Array.isArray(booking.items) ? booking.items : [];
                let packItems = items.filter((it) => it.itemType === 'pack');
                if (packItems.length === 0 && booking.packType) {
                  packItems = [{
                    packType: booking.packType,
                    packName: booking.packName,
                    hasPhotographer: booking.hasPhotographer,
                    hasPremiumPass: booking.hasPremiumPass,
                    adults: booking.adultsCount,
                    children: booking.childrenCount,
                    quantity: 1,
                  }];
                }
                return packItems.map((it, i) => (
                  <div key={i} className="p-2 sm:p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-purple-700">
                        {(it.packName || PACK_NAMES[it.packType] || it.packType)}{it.quantity > 1 ? ` x${it.quantity}` : ''}
                      </span>
                      <div className="flex gap-1">
                        {it.hasPhotographer && (
                          <span className="p-1 bg-blue-100 rounded" title="Fotógrafo incluido">
                            <Camera className="w-3 h-3 text-blue-600" />
                          </span>
                        )}
                        {it.hasPremiumPass && (
                          <span className="p-1 bg-amber-100 rounded" title="Pase Premium">
                            <Crown className="w-3 h-3 text-amber-600" />
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-purple-600">
                      Incluye: {(it.adults || 0) * (it.quantity || 1)} adulto(s), {(it.children || 0) * (it.quantity || 1)} niño(s)
                    </p>
                  </div>
                ));
              })()}

              {/* Individual tickets */}
              {(() => {
                const items = Array.isArray(booking.items) ? booking.items : [];
                const individualItems = items.filter((it) => it.itemType === 'individual');
                return individualItems.map((it, i) => (
                  <div key={`ind-${i}`} className="p-2 sm:p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <span className="font-medium text-sm text-blue-700">Entradas individuales</span>
                    <p className="text-xs text-blue-600">
                      {it.adults > 0 && `${it.adults} adulto(s)`}
                      {it.adults > 0 && it.children > 0 && ', '}
                      {it.children > 0 && `${it.children} niño(s)`}
                    </p>
                  </div>
                ));
              })()}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="p-2 sm:p-3 bg-blue-50 rounded-lg text-center">
              <p className="text-xl sm:text-2xl font-bold text-blue-600">{booking.adultsCount}</p>
              <p className="text-xs text-blue-600">Adultos</p>
            </div>
            <div className="p-2 sm:p-3 bg-pink-50 rounded-lg text-center">
              <p className="text-xl sm:text-2xl font-bold text-pink-600">{booking.childrenCount}</p>
              <p className="text-xs text-pink-600">Niños</p>
            </div>
            <div className="p-2 sm:p-3 bg-purple-50 rounded-lg text-center">
              <p className="text-xl sm:text-2xl font-bold text-purple-600">{booking.totalPulseras}</p>
              <p className="text-xs text-purple-600">Pulseras</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 p-2 sm:p-3 bg-green-50 rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500">Importe</p>
              <p className="font-medium text-sm sm:text-base">{(booking.totalAmountCents / 100).toFixed(2)}€</p>
            </div>
            <div className="flex flex-wrap gap-1">
              <span className={`px-2 py-1 rounded text-xs whitespace-nowrap ${booking.paymentStatus === 'paid' ? 'bg-green-200 text-green-700' : 'bg-yellow-200 text-yellow-700'}`}>
                {booking.paymentStatus === 'paid' ? 'Pagado' : 'No pagado'}
              </span>
              <span className="px-2 py-1 bg-gray-200 rounded text-xs text-gray-700 whitespace-nowrap">
                {booking.paymentMethod === 'stripe' ? 'Online' : 'Efectivo'}
              </span>
            </div>
          </div>

          {/* Allergies Section */}
          {memberAllergies.length > 0 && (
            <div className="p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-amber-800">Alergias Registradas</h3>
              </div>
              <div className="space-y-3">
                {memberAllergies.map((member, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-3 border border-amber-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        member.memberType === 'adult' 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {member.memberType === 'adult' ? 'Adulto' : 'Niño/a'}
                      </span>
                      <span className="font-medium text-sm">{member.name} {member.lastname}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {member.allergies.map((allergyId) => {
                        const allergen = getAllergenInfo(allergyId);
                        return (
                          <span 
                            key={allergyId}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded text-xs"
                          >
                            <span>{allergen.icon}</span>
                            <span>{allergen.name}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Link to="/qr-reader" className="btn btn-primary w-full flex items-center justify-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm sm:text-base">Escanear otro QR</span>
        </Link>
      </div>
    </div>
  );
}
