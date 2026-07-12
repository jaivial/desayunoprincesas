import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchBookings, updateBooking } from '../store/bookingsSlice';
import { ArrowLeft, Loader2, Save, Plus, Minus, Trash2, AlertTriangle, Check, Package, Camera, Crown, RefreshCw, AlertCircle } from 'lucide-react';
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

const TICKET_STATUS_OPTIONS = [
  { value: 'pending', label: 'No pagado' },
  { value: 'paid', label: 'Pagado' },
];

const TICKET_METHOD_OPTIONS = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'bizum', label: 'Bizum' },
  { value: 'cash', label: 'Efectivo' },
];

const getPackTicketTotals = (booking) => (Array.isArray(booking?.items) ? booking.items : [])
  .filter((item) => item.itemType === 'pack')
  .reduce((totals, item) => {
    const quantity = item.quantity || 1;
    totals.adults += (item.adults || 0) * quantity;
    totals.children += (item.children || 0) * quantity;
    return totals;
  }, { adults: 0, children: 0 });

const getInitialTicketGroups = (booking) => {
  const individualItems = (Array.isArray(booking?.items) ? booking.items : [])
    .filter((item) => item.itemType === 'individual');
  const groups = individualItems.map((item) => ({
    adults: item.adults || 0,
    children: item.children || 0,
    amountCents: item.lineTotalCents || 0,
    paymentStatus: item.paymentStatus || booking.paymentStatus || 'pending',
    paymentMethod: item.paymentMethod || booking.paymentMethod || 'cash',
  }));

  const packTotals = getPackTicketTotals(booking);
  const remainingAdults = Math.max(0, (booking.adultsCount || 0) - packTotals.adults - groups.reduce((sum, item) => sum + item.adults, 0));
  const remainingChildren = Math.max(0, (booking.childrenCount || 0) - packTotals.children - groups.reduce((sum, item) => sum + item.children, 0));
  if ((remainingAdults > 0 || remainingChildren > 0) && individualItems.length === 0 && !booking.packType) {
    groups.push({
      adults: remainingAdults,
      children: remainingChildren,
      amountCents: Math.max(0, (booking.totalAmountCents || 0) - (booking.items || []).filter((item) => item.itemType === 'pack').reduce((sum, item) => sum + (item.lineTotalCents || 0), 0)),
      paymentStatus: booking.paymentStatus || 'pending',
      paymentMethod: booking.paymentMethod || 'cash',
    });
  }
  return groups;
};

const getPackAmountCents = (booking) => (Array.isArray(booking?.items) ? booking.items : [])
  .filter((item) => item.itemType === 'pack')
  .reduce((total, item) => total + (item.lineTotalCents || 0), 0);

const getExistingPackPaymentGroups = (booking) => {
  const packItems = (Array.isArray(booking?.items) ? booking.items : [])
    .filter((item) => item.itemType === 'pack');
  if (packItems.length > 0) {
    return packItems.map((item, index) => ({
      id: item.id || `pack-${index}`,
      label: item.packName || PACK_NAMES[item.packType] || item.packType || 'Pack',
      adults: (item.adults || 0) * (item.quantity || 1),
      children: (item.children || 0) * (item.quantity || 1),
      amountCents: item.lineTotalCents || 0,
      paymentStatus: item.paymentStatus || booking.paymentStatus || 'pending',
      paymentMethod: item.paymentMethod || booking.paymentMethod || 'stripe',
    }));
  }
  if (!booking?.packType) return [];
  return [{
    id: 'legacy-pack',
    label: booking.packName || PACK_NAMES[booking.packType] || booking.packType,
    adults: booking.adultsCount || 0,
    children: booking.childrenCount || 0,
    amountCents: booking.totalAmountCents || 0,
    paymentStatus: booking.paymentStatus || 'pending',
    paymentMethod: booking.paymentMethod || 'stripe',
  }];
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
  const [ticketGroups, setTicketGroups] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [initialAllergies, setInitialAllergies] = useState([]);
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

  useEffect(() => {
    if (bookings.length === 0) {
      dispatch(fetchBookings({}));
    }
  }, [dispatch, bookings.length]);

  useEffect(() => {
    // Hydrate editable form once booking data arrives.
    const booking = bookings.find((b) => b.id === id);
    if (booking && !form) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBookingData(booking);
      setTicketGroups(getInitialTicketGroups(booking));
      setForm({
        name: booking.name || '',
        surname: booking.surname || '',
        email: booking.email || '',
        phone: booking.phoneNumber || booking.phone || '',
        phoneCountryCode: booking.phoneCountryCode || '',
        phoneNumber: booking.phoneNumber || booking.phone || '',
        adultsCount: booking.adultsCount || 0,
        childrenCount: booking.childrenCount || 0,
        paymentStatus: booking.paymentStatus || 'pending',
        paymentMethod: booking.paymentMethod || 'cash',
        totalAmountCents: booking.totalAmountCents || 0,
        adultPriceCents: booking.adultPriceCents || 0,
        childPriceCents: booking.childPriceCents || 0,
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
          setInitialAllergies(data.map(a => ({
            memberType: a.memberType,
            memberIndex: a.memberIndex,
            name: a.name,
            lastname: a.lastname,
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

  const addTicketGroup = () => {
    setTicketGroups((groups) => [...groups, {
      adults: 0,
      children: 0,
      amountCents: 0,
      paymentStatus: 'pending',
      paymentMethod: 'cash',
    }]);
  };

  const updateTicketGroup = (index, field, value) => {
    setTicketGroups((groups) => groups.map((group, i) => (
      i === index ? { ...group, [field]: value } : group
    )));
  };

  const changeTicketCount = (index, field, delta) => {
    const group = ticketGroups[index];
    const nextCount = Math.max(0, (group?.[field] || 0) + delta);
    const adultPriceCents = form?.adultPriceCents || 0;
    const childPriceCents = form?.childPriceCents || 0;
    const expectedAmount = (group.adults * adultPriceCents) + (group.children * childPriceCents);
    const nextGroup = { ...group, [field]: nextCount };
    if (group.amountCents === 0 || group.amountCents === expectedAmount) {
      nextGroup.amountCents = (nextGroup.adults * adultPriceCents) + (nextGroup.children * childPriceCents);
    }
    setTicketGroups((groups) => groups.map((item, i) => (i === index ? nextGroup : item)));
  };

  const removeTicketGroup = (index) => {
    setTicketGroups((groups) => groups.filter((_, i) => i !== index));
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
    } else if (newPrice < currentPrice) {
      // Show confirmation modal for refund (negative difference)
      setManualPaymentMethod('');
      setPackChangeModal(true);
    } else {
      // Same price: direct change
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
      const packTotals = getPackTicketTotals(bookingData);
      const individualAdults = ticketGroups.reduce((sum, group) => sum + group.adults, 0);
      const individualChildren = ticketGroups.reduce((sum, group) => sum + group.children, 0);
      const persistedItems = Array.isArray(bookingData?.items) ? bookingData.items : [];
      const hasPersistedPackItems = persistedItems.some((item) => item.itemType === 'pack');
      const originalTicketGroups = getInitialTicketGroups(bookingData);
      const originalIndividualAdults = originalTicketGroups.reduce((sum, group) => sum + group.adults, 0);
      const originalIndividualChildren = originalTicketGroups.reduce((sum, group) => sum + group.children, 0);
      const originalIndividualAmount = originalTicketGroups.reduce((sum, group) => sum + group.amountCents, 0);
      const itemAmountCents = ticketGroups.reduce((sum, group) => sum + group.amountCents, 0);
      const totalAmountCents = hasPersistedPackItems
        ? getPackAmountCents(bookingData) + itemAmountCents
        : bookingData?.packType
          ? (form.totalAmountCents - originalIndividualAmount) + itemAmountCents
          : ticketGroups.length > 0 ? itemAmountCents : form.totalAmountCents;
      const saveData = {
        ...form,
        phoneNumber: form.phoneNumber || form.phone,
        items: ticketGroups.map((group) => ({
          adults: group.adults,
          children: group.children,
          amountCents: group.amountCents,
          paymentStatus: group.paymentStatus,
          paymentMethod: group.paymentMethod,
        })),
        adultsCount: hasPersistedPackItems
          ? packTotals.adults + individualAdults
          : bookingData?.packType
            ? (form.adultsCount || 0) - originalIndividualAdults + individualAdults
            : individualAdults,
        childrenCount: hasPersistedPackItems
          ? packTotals.children + individualChildren
          : bookingData?.packType
            ? (form.childrenCount || 0) - originalIndividualChildren + individualChildren
            : individualChildren,
        totalAmountCents,
      };
      const changes = [];
      if (form.name !== (bookingData.name || '') || form.surname !== (bookingData.surname || '')) changes.push('Datos personales actualizados');
      if (form.email !== (bookingData.email || '')) changes.push('Email de contacto actualizado');
      if (form.phoneNumber !== (bookingData.phoneNumber || bookingData.phone || '')) changes.push('Teléfono actualizado');
      if (form.paymentStatus !== (bookingData.paymentStatus || 'pending')) changes.push('Estado general de pago actualizado');
      if (form.paymentMethod !== (bookingData.paymentMethod || 'cash')) changes.push('Método general de pago actualizado');
      if (form.confirmedAssistance !== Boolean(bookingData.confirmedAssistance)) changes.push('Estado de asistencia actualizado');
      if (JSON.stringify(ticketGroups) !== JSON.stringify(getInitialTicketGroups(bookingData))) changes.push(`Entradas actualizadas: ${ticketGroups.length} grupo(s) de pago`);
      const normalizedAllergies = allergies.map(({ memberType, memberIndex, name, lastname, allergies: memberAllergies }) => ({ memberType, memberIndex, name, lastname, allergies: memberAllergies }));
      if (JSON.stringify(normalizedAllergies) !== JSON.stringify(initialAllergies)) changes.push('Información de alergias actualizada');
      if (changes.length === 0) changes.push('Datos de la reserva revisados');
      // Update booking
      await dispatch(updateBooking({ id, data: saveData })).unwrap();
      
      // Update allergies
      const validAllergies = allergies.filter(a => a.name && a.lastname && a.allergies.length > 0);
      const allergiesResponse = await fetch(`${API_URL}/api/admin/bookings/${id}/allergies`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders() 
        },
        body: JSON.stringify(validAllergies),
      });
      if (!allergiesResponse.ok) {
        throw new Error(`Los cambios se guardaron, pero no se pudieron guardar las alergias (${allergiesResponse.status})`);
      }

      const emailResponse = await fetch(`${API_URL}/api/admin/bookings/${id}/send-update-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ changes }),
      });
      if (!emailResponse.ok) {
        throw new Error(`Los cambios se guardaron, pero no se pudo enviar el email al cliente (${emailResponse.status})`);
      }
      
      navigate('/inscripciones');
    } catch (err) {
      console.error('Error updating booking:', err);
      const message = err instanceof Error ? err.message : 'Error de conexión. Comprueba tu sesión e inténtalo de nuevo.';
      window.alert(message);
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
    { value: 'bizum', label: 'Bizum' },
    { value: 'cash', label: 'Efectivo' },
    { value: 'mixed', label: 'Mixto' },
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

  const existingPackPaymentGroups = getExistingPackPaymentGroups(bookingData);

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
                      refund: { label: `Reembolsado (${u.paymentMethod || '—'})`, cls: 'bg-emerald-100 text-emerald-700' },
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
                    onChange={(e) => {
                      handleChange('phone', e.target.value);
                      handleChange('phoneNumber', e.target.value);
                    }}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Ticket groups */}
            <div>
              <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold">Entradas por pago</h2>
                  <p className="text-xs text-gray-500 mt-1">Cada sección puede tener método y estado de pago distintos.</p>
                </div>
                <button
                  type="button"
                  onClick={addTicketGroup}
                  className="btn btn-secondary text-sm flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Añadir entradas
                </button>
              </div>

              {existingPackPaymentGroups.length === 0 && ticketGroups.length === 0 ? (
                <p className="text-sm text-gray-500 border border-dashed rounded-lg p-4 text-center">
                  No hay entradas individuales. Pulsa "Añadir entradas" para crear grupo de pago.
                </p>
              ) : (
                <div className="space-y-3">
                  {existingPackPaymentGroups.map((group, index) => (
                    <div key={group.id} className="border border-purple-200 bg-purple-50 rounded-lg p-3 sm:p-4">
                      <div className="mb-3">
                        <p className="font-medium text-purple-800">Grupo existente {index + 1}: {group.label}</p>
                        <p className="text-xs text-purple-600 mt-1">Compra original. Usa "Cambiar pack" para modificar estas entradas.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-lg border p-2">
                          <span className="text-sm font-medium text-gray-700">Adultos</span>
                          <p className="text-lg font-bold text-purple-700">{group.adults}</p>
                        </div>
                        <div className="bg-white rounded-lg border p-2">
                          <span className="text-sm font-medium text-gray-700">Niños</span>
                          <p className="text-lg font-bold text-purple-700">{group.children}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Estado de pago</label>
                          <Select value={group.paymentStatus} onChange={() => {}} options={TICKET_STATUS_OPTIONS} disabled />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Método de pago</label>
                          <Select value={group.paymentMethod} onChange={() => {}} options={TICKET_METHOD_OPTIONS} disabled />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Importe (€)</label>
                          <input type="number" className="input" value={(group.amountCents / 100).toFixed(2)} disabled />
                        </div>
                      </div>
                    </div>
                  ))}
                  {ticketGroups.map((group, index) => (
                    <div key={index} className="border border-blue-200 bg-blue-50 rounded-lg p-3 sm:p-4">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <p className="font-medium text-blue-800">Grupo de entradas {index + 1}</p>
                        <button
                          type="button"
                          onClick={() => removeTicketGroup(index)}
                          className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg"
                          title="Eliminar grupo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { field: 'adults', label: 'Adultos' },
                          { field: 'children', label: 'Niños' },
                        ].map(({ field, label }) => (
                          <div key={field} className="flex items-center justify-between bg-white rounded-lg border p-2">
                            <span className="text-sm font-medium text-gray-700">{label}</span>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => changeTicketCount(index, field, -1)}
                                disabled={group[field] === 0}
                                className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                aria-label={`Restar ${label.toLowerCase()}`}
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="w-8 text-center text-lg font-bold text-blue-700">{group[field]}</span>
                              <button
                                type="button"
                                onClick={() => changeTicketCount(index, field, 1)}
                                className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700"
                                aria-label={`Añadir ${label.toLowerCase()}`}
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Estado de pago</label>
                          <Select
                            value={group.paymentStatus}
                            onChange={(value) => updateTicketGroup(index, 'paymentStatus', value)}
                            options={TICKET_STATUS_OPTIONS}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Método de pago</label>
                          <Select
                            value={group.paymentMethod}
                            onChange={(value) => updateTicketGroup(index, 'paymentMethod', value)}
                            options={TICKET_METHOD_OPTIONS}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Importe (€)</label>
                          <input
                            type="number"
                            className="input"
                            min="0"
                            step="0.01"
                            value={(group.amountCents / 100).toFixed(2)}
                            onChange={(e) => updateTicketGroup(index, 'amountCents', Math.round(parseFloat(e.target.value) * 100) || 0)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-3 text-sm text-gray-600">
                <div className="bg-gray-50 rounded-lg p-2">Total adultos: <strong>{getPackTicketTotals(bookingData).adults + ticketGroups.reduce((sum, group) => sum + group.adults, 0)}</strong></div>
                <div className="bg-gray-50 rounded-lg p-2">Total niños: <strong>{getPackTicketTotals(bookingData).children + ticketGroups.reduce((sum, group) => sum + group.children, 0)}</strong></div>
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
        const isRefund = diff < 0;
        const absDiff = Math.abs(diff);
        const paymentMethods = isRefund
          ? [
              { value: 'reembolso_bizum', label: 'Reembolso por Bizum', desc: 'Devuelto por Bizum' },
              { value: 'reembolso_transferencia', label: 'Reembolso por transferencia', desc: 'Devuelto por transferencia' },
              { value: 'reembolso_efectivo', label: 'Reembolso en efectivo', desc: 'Devuelto en efectivo' },
            ]
          : [
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
                  <h3 className="text-lg font-bold text-gray-900">
                    {isRefund ? 'Reembolso requerido' : 'Suplemento de pago requerido'}
                  </h3>
                  <p className="text-sm text-gray-600 mt-2">
                    {isRefund
                      ? `Este cambio supone una diferencia de ${((absDiff) / 100).toFixed(2)}€ a devolver al cliente.`
                      : `Este cambio requiere de un suplemento de <strong className="text-amber-600">${((absDiff) / 100).toFixed(2)}€</strong>.`
                    }
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
                    <div className={`flex justify-between font-bold ${isRefund ? 'text-green-700' : 'text-amber-700'}`}>
                      <span>{isRefund ? 'A devolver:' : 'Diferencia:'}</span>
                      <span>{isRefund ? `${((absDiff) / 100).toFixed(2)}€` : `${((absDiff) / 100).toFixed(2)}€`}</span>
                    </div>
                  </div>

                  <p className="text-sm font-medium text-gray-700 mt-4 mb-2">
                    {isRefund ? 'Método de reembolso' : 'Método de pago'}
                  </p>
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
                  {!isRefund && manualPaymentMethod === '' && (
                    <p className="text-xs text-gray-400 mt-2 italic">
                      Stripe enviará un email al cliente con enlace para pagar la diferencia.
                    </p>
                  )}
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
                  disabled={manualPaymentMethod === '' && !isRefund ? false : !manualPaymentMethod}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {isRefund
                    ? 'Confirmar reembolso'
                    : manualPaymentMethod === ''
                    ? 'Enviar email de pago'
                    : 'Confirmar cambio'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
