import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchBookings, updateBooking } from '../store/bookingsSlice';
import { ArrowLeft, Loader2, Save, Plus, Trash2, AlertTriangle, Check, Package, Camera, Crown, RefreshCw, AlertCircle } from 'lucide-react';
import Select from '../components/ui/Select';
import { getAuthHeaders } from '../store/authSlice';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

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

// Pack definitions
const PACK_NAMES = {
  encantado: 'Pack Encantado',
  reino_encantado: 'Pack Reino Encantado',
  recuerdo_real_1: 'Pack Recuerdo Real 1',
  recuerdo_real_2: 'Pack Recuerdo Real 2',
  cuento_ensueno_1: 'Pack Cuento de Ensueño 1',
  cuento_ensueno_2: 'Pack Cuento de Ensueño 2',
};

function AllergyMemberCard({ member, onUpdate, onDelete }) {
  const toggleAllergy = (allergyId) => {
    const newAllergies = member.allergies.includes(allergyId)
      ? member.allergies.filter(a => a !== allergyId)
      : [...member.allergies, allergyId];
    onUpdate({ ...member, allergies: newAllergies });
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <select
            value={member.memberType}
            onChange={(e) => onUpdate({ ...member, memberType: e.target.value })}
            className="input py-1 px-2 text-sm w-24"
          >
            <option value="adult">Adulto</option>
            <option value="child">Niño/a</option>
          </select>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
          title="Eliminar"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
          <input
            type="text"
            className="input text-sm"
            placeholder="Nombre"
            value={member.name}
            onChange={(e) => onUpdate({ ...member, name: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Apellidos</label>
          <input
            type="text"
            className="input text-sm"
            placeholder="Apellidos"
            value={member.lastname}
            onChange={(e) => onUpdate({ ...member, lastname: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Alergias</label>
        <div className="grid grid-cols-7 gap-1">
          {ALLERGENS.map((allergen) => {
            const isSelected = member.allergies.includes(allergen.id);
            return (
              <button
                key={allergen.id}
                type="button"
                onClick={() => toggleAllergy(allergen.id)}
                className={`flex flex-col items-center p-1.5 rounded-lg border transition-all ${
                  isSelected 
                    ? 'bg-red-100 border-red-300 ring-1 ring-red-400' 
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
                title={allergen.name}
              >
                <span className="text-lg">{allergen.icon}</span>
                <span className={`text-[8px] leading-tight text-center ${
                  isSelected ? 'text-red-700' : 'text-gray-500'
                }`}>
                  {allergen.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function EditBookingPage() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list: bookings, loading } = useSelector((state) => state.bookings);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [bookingData, setBookingData] = useState(null);
  const [allergies, setAllergies] = useState([]);
  const [allergiesLoading, setAllergiesLoading] = useState(true);

  // Pack change state
  const [availablePacks, setAvailablePacks] = useState([]);
  const [packsLoading, setPacksLoading] = useState(false);
  const [selectedNewPack, setSelectedNewPack] = useState('');
  const [packChangeModal, setPackChangeModal] = useState(false);
  const [packChangeLoading, setPackChangeLoading] = useState(false);
  const [packChangeResult, setPackChangeResult] = useState(null);
  const [manualPaymentMethod, setManualPaymentMethod] = useState('');
  const [bookingUpdates, setBookingUpdates] = useState([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);

  useEffect(() => {
    if (bookings.length === 0) {
      dispatch(fetchBookings({}));
    }
  }, [dispatch, bookings.length]);

  useEffect(() => {
    const booking = bookings.find((b) => b.id === id);
    if (booking && !form) {
      setBookingData(booking);
      setForm({
        name: booking.name || '',
        surname: booking.surname || '',
        email: booking.email || '',
        phone: booking.phone || '',
        adultsCount: booking.adultsCount || 0,
        childrenCount: booking.childrenCount || 0,
        paymentStatus: booking.paymentStatus || 'pending',
        paymentMethod: booking.paymentMethod || 'cash',
        totalAmountCents: booking.totalAmountCents || 0,
        confirmedAssistance: booking.confirmedAssistance || false,
      });
    }
  }, [bookings, id, form]);

  // Fetch available packs for this booking's event date
  useEffect(() => {
    if (!id || !form) return;
    const fetchPacks = async () => {
      setPacksLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/admin/bookings/${id}/packs`, {
          headers: { ...getAuthHeaders() },
        });
        if (res.ok) {
          const data = await res.json();
          setAvailablePacks(data.packs || []);
        }
      } catch (err) {
        console.error('Failed to fetch packs:', err);
      }
      setPacksLoading(false);
    };
    fetchPacks();
  }, [id, form]);

  // Fetch booking updates
  useEffect(() => {
    if (!id) return;
    const fetchUpdates = async () => {
      setUpdatesLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/admin/bookings/${id}/updates`, {
          headers: { ...getAuthHeaders() },
        });
        if (res.ok) {
          setBookingUpdates(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch updates:', err);
      }
      setUpdatesLoading(false);
    };
    fetchUpdates();
  }, [id]);

  // Fetch allergies
  useEffect(() => {
    const fetchAllergies = async () => {
      try {
        const res = await fetch(`${API_URL}/api/admin/bookings/${id}/allergies`, {
          headers: { ...getAuthHeaders() },
        });
        if (res.ok) {
          const data = await res.json();
          setAllergies(data.map(a => ({
            ...a,
            allergies: a.allergies || [],
          })));
        }
      } catch (err) {
        console.error('Failed to fetch allergies:', err);
      }
      setAllergiesLoading(false);
    };
    if (id) {
      fetchAllergies();
    }
  }, [id]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addAllergyMember = () => {
    setAllergies([...allergies, {
      memberType: 'adult',
      memberIndex: allergies.length,
      name: '',
      lastname: '',
      allergies: [],
    }]);
  };

  const updateAllergyMember = (index, updatedMember) => {
    const newAllergies = [...allergies];
    newAllergies[index] = updatedMember;
    setAllergies(newAllergies);
  };

  const deleteAllergyMember = (index) => {
    setAllergies(allergies.filter((_, i) => i !== index));
  };

  const handlePackChange = () => {
    if (!selectedNewPack) return;
    // Find new pack info
    const newPack = availablePacks.find(p => p.id === selectedNewPack);
    if (!newPack) return;
    // Find current pack from items
    const items = Array.isArray(bookingData?.items) ? bookingData.items : [];
    const currentPackItem = items.find(it => it.itemType === 'pack');
    const currentPrice = currentPackItem?.unitPriceCents || form.totalAmountCents || 0;
    const newPrice = newPack.priceCents;

    if (newPrice > currentPrice) {
      // Show confirmation modal for price increase
      setManualPaymentMethod('');
      setPackChangeModal(true);
    } else {
      // Direct change (same or lower price)
      confirmPackChange();
    }
  };

  const confirmPackChange = async () => {
    setPackChangeLoading(true);
    setPackChangeModal(false);
    try {
      const newPack = availablePacks.find(p => p.id === selectedNewPack);
      const body = { newPackType: selectedNewPack, newPackName: newPack?.name || '' };
      if (manualPaymentMethod) {
        body.paymentMethod = manualPaymentMethod;
      }
      const res = await fetch(`${API_URL}/api/admin/bookings/${id}/request-pack-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setPackChangeResult(data);
      if (data.status === 'updated') {
        // Refresh booking data
        dispatch(fetchBookings({}));
      }
    } catch (err) {
      console.error('Pack change error:', err);
      setPackChangeResult({ status: 'error', message: 'Error al solicitar el cambio de pack' });
    }
    setPackChangeLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Update booking
      await dispatch(updateBooking({ id, data: form })).unwrap();
      
      // Update allergies
      const validAllergies = allergies.filter(a => a.name && a.lastname && a.allergies.length > 0);
      await fetch(`${API_URL}/api/admin/bookings/${id}/allergies`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders() 
        },
        body: JSON.stringify(validAllergies),
      });
      
      navigate('/inscripciones');
    } catch (err) {
      console.error('Error updating booking:', err);
    } finally {
      setSaving(false);
    }
  };

  const statusOptions = [
    { value: 'pending', label: 'No pagado' },
    { value: 'paid', label: 'Pagado' },
  ];

  const methodOptions = [
    { value: 'stripe', label: 'Online (Stripe)' },
    { value: 'cash', label: 'Efectivo' },
  ];

  const confirmedOptions = [
    { value: 'true', label: 'Sí' },
    { value: 'false', label: 'No' },
  ];

  if (loading || !form) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => navigate('/inscripciones')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 sm:mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm sm:text-base">Volver a inscripciones</span>
      </button>

      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Editar inscripción</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card max-w-2xl p-4 sm:p-6">
          <div className="space-y-5 sm:space-y-6">
            {/* Items (packs + individual tickets, read-only) */}
            {(() => {
              const items = Array.isArray(bookingData?.items) ? bookingData.items : [];
              const packItems = items.filter((it) => it.itemType === 'pack');
              const individual = items.filter((it) => it.itemType === 'individual');
              if (packItems.length === 0 && bookingData?.packType) {
                packItems.push({
                  packType: bookingData.packType,
                  packName: bookingData.packName,
                  hasPhotographer: bookingData.hasPhotographer,
                  hasPremiumPass: bookingData.hasPremiumPass,
                  quantity: 1,
                });
              }
              if (packItems.length === 0 && individual.length === 0) return null;
              return (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
                  <p className="text-xs text-purple-600 font-medium">Composición de la compra</p>
                  {packItems.map((it, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Package className="w-5 h-5 text-purple-600" />
                      <div className="flex-1">
                        <p className="font-semibold text-purple-800">
                          {(it.packName || PACK_NAMES[it.packType] || it.packType)}{it.quantity > 1 ? ` x${it.quantity}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {it.hasPhotographer && (
                          <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                            <Camera className="w-3 h-3" /> Fotógrafo
                          </span>
                        )}
                        {it.hasPremiumPass && (
                          <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs">
                            <Crown className="w-3 h-3" /> Premium
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {individual.map((it, i) => (
                    <p key={`ind-${i}`} className="text-sm text-purple-800">
                      Entradas individuales: {it.adults} adulto(s) + {it.children} niño(s)
                    </p>
                  ))}
                </div>
              );
            })()}

            {/* Pack Change Section */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
              <h2 className="text-base font-semibold text-amber-800 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Cambiar pack
              </h2>
              <p className="text-xs text-amber-600">
                Cambia el pack de la reserva. Si el nuevo pack tiene un precio superior, se enviará un email al cliente para abonar la diferencia.
              </p>

              {packChangeResult && (
                <div className={`p-3 rounded-lg text-sm ${
                  packChangeResult.status === 'updated'
                    ? 'bg-green-100 text-green-800'
                    : packChangeResult.status === 'awaiting_payment'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {packChangeResult.message}
                  {packChangeResult.differenceCents > 0 && (
                    <span className="block mt-1 font-semibold">
                      Suplemento: {((packChangeResult.differenceCents) / 100).toFixed(2)}€
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nuevo pack</label>
                  {packsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Cargando packs...
                    </div>
                  ) : (
                    <select
                      value={selectedNewPack}
                      onChange={(e) => {
                        setSelectedNewPack(e.target.value);
                        setPackChangeResult(null);
                      }}
                      className="input text-sm"
                    >
                      <option value="">— Seleccionar pack —</option>
                      {availablePacks.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {(p.priceCents / 100).toFixed(2)}€
                          ({p.adults}A / {p.children}N)
                          {!p.active ? ' (No disponible)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handlePackChange}
                  disabled={!selectedNewPack || packChangeLoading}
                  className="btn btn-secondary text-sm flex items-center gap-1"
                >
                  {packChangeLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Cambiar
                </button>
              </div>
            </div>

            {/* Booking Update History */}
            {bookingUpdates.length > 0 && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Historial de cambios de pack
                </h2>
                <div className="space-y-2">
                  {bookingUpdates.map((u) => {
                    const statusInfo = {
                      awaiting_payment: { label: 'Pendiente de pago', cls: 'bg-amber-100 text-amber-700' },
                      paid: { label: 'Pagado', cls: 'bg-green-100 text-green-700' },
                      manual: { label: `Pagado manual (${u.paymentMethod || '—'})`, cls: 'bg-blue-100 text-blue-700' },
                    }[u.status] || { label: u.status, cls: 'bg-gray-100 text-gray-600' };
                    const diffEuros = (u.differenceCents / 100).toFixed(2);
                    return (
                      <div key={u.id} className="flex items-start justify-between p-3 bg-white rounded-lg text-sm border">
                        <div className="flex-1">
                          <p className="font-medium text-gray-800">
                            {u.oldPackName || u.oldPackType} → {u.newPackName || u.newPackType}
                          </p>
                          <p className="text-gray-500 text-xs mt-1">
                            {new Date(u.createdAt).toLocaleString('es-ES')}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.cls}`}>
                            {statusInfo.label}
                          </span>
                          <p className="text-xs text-gray-500 mt-1">
                            {u.differenceCents > 0 ? `+${diffEuros}€` : `${diffEuros}€`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Personal info */}
            <div>
              <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Datos personales</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    className="input"
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos</label>
                  <input
                    type="text"
                    className="input"
                    value={form.surname}
                    onChange={(e) => handleChange('surname', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    className="input"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    className="input"
                    value={form.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Attendees */}
            <div>
              <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Asistentes</h2>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adultos</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    value={form.adultsCount}
                    onChange={(e) => handleChange('adultsCount', parseInt(e.target.value) || 0)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Niños</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    value={form.childrenCount}
                    onChange={(e) => handleChange('childrenCount', parseInt(e.target.value) || 0)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Payment */}
            <div>
              <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Pago</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado de pago</label>
                  <Select
                    value={form.paymentStatus}
                    onChange={(value) => handleChange('paymentStatus', value)}
                    options={statusOptions}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Método de pago</label>
                  <Select
                    value={form.paymentMethod}
                    onChange={(value) => handleChange('paymentMethod', value)}
                    options={methodOptions}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Importe (€)</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    step="0.01"
                    value={(form.totalAmountCents / 100).toFixed(2)}
                    onChange={(e) => handleChange('totalAmountCents', Math.round(parseFloat(e.target.value) * 100) || 0)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Assistance */}
            <div>
              <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Asistencia</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asistencia confirmada</label>
                <Select
                  value={form.confirmedAssistance ? 'true' : 'false'}
                  onChange={(value) => handleChange('confirmedAssistance', value === 'true')}
                  options={confirmedOptions}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Allergies Section */}
        <div className="card max-w-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Alergias
            </h2>
            <button
              type="button"
              onClick={addAllergyMember}
              className="btn btn-secondary text-sm flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Añadir miembro
            </button>
          </div>

          {allergiesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : allergies.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">
              No hay alergias registradas. Pulsa "Añadir miembro" para añadir información de alergias.
            </p>
          ) : (
            <div className="space-y-4">
              {allergies.map((member, index) => (
                <AllergyMemberCard
                  key={index}
                  member={member}
                  onUpdate={(updated) => updateAllergyMember(index, updated)}
                  onDelete={() => deleteAllergyMember(index)}
                />
              ))}
            </div>
          )}

          <p className="text-xs text-gray-500 mt-4">
            Solo se guardarán los miembros con nombre, apellidos y al menos una alergia seleccionada.
          </p>
        </div>

        {/* Submit */}
        <div className="card max-w-2xl p-4 sm:p-6">
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/inscripciones')}
              className="btn btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Guardar cambios
            </button>
          </div>
        </div>
      </form>

      {/* Pack Change Confirmation Modal */}
      {packChangeModal && (() => {
        const items = Array.isArray(bookingData?.items) ? bookingData.items : [];
        const currentPackItem = items.find(it => it.itemType === 'pack');
        const currentPrice = currentPackItem?.unitPriceCents || form.totalAmountCents || 0;
        const newPack = availablePacks.find(p => p.id === selectedNewPack);
        const newPrice = newPack?.priceCents || 0;
        const diff = newPrice - currentPrice;
        const paymentMethods = [
          { value: '', label: 'Online (Stripe)', desc: 'Enlace de pago por email' },
          { value: 'bizum', label: 'Bizum', desc: 'Pagado por Bizum' },
          { value: 'transferencia', label: 'Transferencia bancaria', desc: 'Pagado por transferencia' },
          { value: 'efectivo', label: 'Efectivo', desc: 'Pagado en efectivo' },
        ];
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Suplemento de pago requerido</h3>
                  <p className="text-sm text-gray-600 mt-2">
                    Este cambio requiere de un suplemento de <strong className="text-amber-600">{((diff) / 100).toFixed(2)}€</strong>.
                  </p>
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-600">Pack actual:</span>
                      <span className="font-medium">{currentPackItem?.packName || bookingData?.packType || '—'}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-600">Nuevo pack:</span>
                      <span className="font-medium">{newPack?.name || selectedNewPack}</span>
                    </div>
                    <div className="flex justify-between font-bold text-amber-700">
                      <span>Diferencia:</span>
                      <span>{((diff) / 100).toFixed(2)}€</span>
                    </div>
                  </div>

                  <p className="text-sm font-medium text-gray-700 mt-4 mb-2">Método de pago</p>
                  <div className="space-y-2">
                    {paymentMethods.map(pm => (
                      <label key={pm.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        manualPaymentMethod === pm.value
                          ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-400'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={pm.value}
                          checked={manualPaymentMethod === pm.value}
                          onChange={() => setManualPaymentMethod(pm.value)}
                          className="w-4 h-4 text-amber-500"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-800">{pm.label}</span>
                          {pm.desc && <span className="text-xs text-gray-500 ml-2">({pm.desc})</span>}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setPackChangeModal(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmPackChange}
                  disabled={manualPaymentMethod === '' ? false : !manualPaymentMethod}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {manualPaymentMethod === '' ? 'Enviar email de pago' : 'Confirmar cambio'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
