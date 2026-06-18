import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchBookings, deleteBooking, resendEmail, setFilters } from '../store/bookingsSlice';
import { ChevronDown, ChevronUp, Trash2, Mail, Loader2, Check, X, Search, Filter, Pencil, ExternalLink, AlertTriangle } from 'lucide-react';
import Select from '../components/ui/Select';
import { getAuthHeaders } from '../store/authSlice';
import { ToastContainer, useToast } from '../components/ui/Toast';
import { fetchEventDates } from '../store/eventDatesSlice';

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

const getPackName = (packType) => PACK_NAMES[packType] || packType;

// Returns the list of pack labels for a booking (supports several packs).
const getBookingPackLabels = (b) => {
  if (Array.isArray(b.packNames) && b.packNames.length > 0) return b.packNames;
  if (Array.isArray(b.items) && b.items.length > 0) {
    return b.items
      .filter((it) => it.itemType === 'pack')
      .map((it) => {
        const name = it.packName || getPackName(it.packType);
        return it.quantity > 1 ? `${name} x${it.quantity}` : name;
      });
  }
  if (b.packType) return [b.packName || getPackName(b.packType)];
  return [];
};

export default function InscripcionesPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list: bookings, loading, filters } = useSelector((state) => state.bookings);
  const { list: eventDates } = useSelector((state) => state.eventDates);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [localFilters, setLocalFilters] = useState(filters);
  const [allergiesDialog, setAllergiesDialog] = useState(null);
  const [allergiesLoading, setAllergiesLoading] = useState(false);
  const [allergiesData, setAllergiesData] = useState([]);
  const [sendingEmail, setSendingEmail] = useState(null);
  const { toasts, removeToast, success, error } = useToast();

  useEffect(() => {
    dispatch(fetchBookings(filters));
    dispatch(fetchEventDates());
  }, [dispatch, filters]);

  const handleFilter = () => {
    dispatch(setFilters(localFilters));
  };

  const handleClearFilters = () => {
    const cleared = { name: '', email: '', status: '', method: '', confirmed: '', dateId: '' };
    setLocalFilters(cleared);
    dispatch(setFilters(cleared));
  };

  const handleDelete = async (id) => {
    await dispatch(deleteBooking(id));
    setDeleteConfirm(null);
  };

  const handleResend = async (id) => {
    setSendingEmail(id);
    try {
      await dispatch(resendEmail(id)).unwrap();
      success('Email enviado correctamente');
    } catch (err) {
      error('Error al enviar el email');
    } finally {
      setSendingEmail(null);
    }
  };

  const handleViewAllergies = async (booking) => {
    setAllergiesDialog(booking);
    setAllergiesLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/bookings/${booking.id}/allergies`, {
        headers: { ...getAuthHeaders() },
      });
      if (res.ok) {
        const data = await res.json();
        setAllergiesData(data);
      }
    } catch (err) {
      console.error('Failed to fetch allergies:', err);
    }
    setAllergiesLoading(false);
  };

  const formatDate = (date) => new Date(date).toLocaleDateString('es-ES', { 
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
  });

  const statusOptions = [
    { value: '', label: 'Todos los estados' },
    { value: 'pending', label: 'No pagado' },
    { value: 'paid', label: 'Pagado' },
  ];

  const methodOptions = [
    { value: '', label: 'Todos los métodos' },
    { value: 'stripe', label: 'Online (Stripe)' },
    { value: 'cash', label: 'Efectivo' },
  ];

  const confirmedOptions = [
    { value: '', label: 'Toda asistencia' },
    { value: 'true', label: 'Confirmada' },
    { value: 'false', label: 'No confirmada' },
  ];

  const dateOptions = [
    { value: '', label: 'Todas las fechas' },
    ...eventDates.map((ed) => {
      const [y, m, d] = ed.eventDate.slice(0, 10).split('-');
      return { value: String(ed.id), label: `${d}/${m}/${y}` };
    }),
  ];

  const formatEventDate = (dateStr) => {
    if (!dateStr) return '—';
    // dateStr may be YYYY-MM-DD or RFC3339 (…T00:00:00Z); take the date part only.
    const [y, m, d] = dateStr.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  };

  const hasActiveFilters = Object.values(localFilters).some(v => v !== '');

  const AllergyBadge = ({ booking }) => {
    const count = booking.allergyCount || 0;
    if (count === 0) return <span className="text-gray-400 text-xs">NO</span>;
    return (
      <button
        onClick={() => handleViewAllergies(booking)}
        className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium hover:bg-amber-200 transition-colors"
      >
        {count}
        <ExternalLink className="w-3 h-3" />
      </button>
    );
  };

  const BookingCard = ({ b }) => (
    <div className="card mb-3">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="font-semibold">{b.name} {b.surname}</p>
          <p className="text-sm text-gray-500">{b.email}</p>
          <p className="text-sm text-gray-500">{b.phone}</p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => navigate(`/inscripciones/${b.id}`)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600" title="Editar">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => handleResend(b.id)} disabled={sendingEmail === b.id} className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 disabled:opacity-50" title="Reenviar email">
            {sendingEmail === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          </button>
          <button onClick={() => setDeleteConfirm(b.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500" title="Eliminar">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-4 gap-2 text-center mb-3">
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-lg font-bold">{b.adultsCount}</p>
          <p className="text-xs text-gray-500">Adultos</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-lg font-bold">{b.childrenCount}</p>
          <p className="text-xs text-gray-500">Niños</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-lg font-bold">{(b.totalAmountCents / 100).toFixed(0)}€</p>
          <p className="text-xs text-gray-500">Importe</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="flex items-center justify-center h-7">
            <AllergyBadge booking={b} />
          </div>
          <p className="text-xs text-gray-500">Alergias</p>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${b.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {b.paymentStatus === 'paid' ? <><Check className="w-3 h-3" /> Pagado</> : 'No pagado'}
          </span>
          <span className="px-2 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
            {b.paymentMethod === 'stripe' ? 'Online' : 'Efectivo'}
          </span>
          {getBookingPackLabels(b).length > 0 ? (
            getBookingPackLabels(b).map((label, i) => (
              <span key={i} className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                {label}
              </span>
            ))
          ) : (
            <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">Sin pack</span>
          )}
          {b.confirmedAssistance && (
            <span className="px-2 py-1 bg-teal-100 text-teal-700 rounded-full text-xs">Asistió</span>
          )}
        </div>
        <span className="text-xs text-gray-400">{formatDate(b.createdAt)}</span>
        {b.eventDate && (
          <span className="text-xs text-blue-500">Evento: {formatEventDate(b.eventDate)}</span>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Inscripciones</h1>

      {/* Filters */}
      <div className="card mb-4 sm:mb-6">
        <button onClick={() => setFiltersOpen(!filtersOpen)} className="w-full flex items-center justify-between">
          <span className="font-semibold flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
            {hasActiveFilters && <span className="bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full">Activos</span>}
          </span>
          {filtersOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        
        {filtersOpen && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Buscar por nombre..." className="input pl-9" value={localFilters.name || ''} onChange={(e) => setLocalFilters({ ...localFilters, name: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Buscar por email..." className="input pl-9" value={localFilters.email || ''} onChange={(e) => setLocalFilters({ ...localFilters, email: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado de pago</label>
                <Select value={localFilters.status || ''} onChange={(value) => setLocalFilters({ ...localFilters, status: value })} options={statusOptions} placeholder="Seleccionar estado..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Método de pago</label>
                <Select value={localFilters.method || ''} onChange={(value) => setLocalFilters({ ...localFilters, method: value })} options={methodOptions} placeholder="Seleccionar método..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asistencia</label>
                <Select value={localFilters.confirmed || ''} onChange={(value) => setLocalFilters({ ...localFilters, confirmed: value })} options={confirmedOptions} placeholder="Seleccionar asistencia..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Día del evento</label>
                <Select value={localFilters.dateId || ''} onChange={(value) => setLocalFilters({ ...localFilters, dateId: value })} options={dateOptions} placeholder="Todas las fechas..." />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button onClick={handleFilter} className="btn btn-primary flex items-center justify-center gap-2">
                <Search className="w-4 h-4" />
                Aplicar filtros
              </button>
              {hasActiveFilters && <button onClick={handleClearFilters} className="btn btn-secondary">Limpiar filtros</button>}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-8 h-8 animate-spin" /></div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="lg:hidden">
            {bookings.map((b) => <BookingCard key={b.id} b={b} />)}
            {bookings.length === 0 && (
              <div className="card text-center py-12">
                <p className="text-gray-500">No hay inscripciones</p>
                {hasActiveFilters && <button onClick={handleClearFilters} className="text-primary-600 text-sm mt-2 hover:underline">Limpiar filtros</button>}
              </div>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-semibold">Nombre</th>
                  <th className="text-left py-3 px-2 font-semibold">Email</th>
                  <th className="text-left py-3 px-2 font-semibold">Teléfono</th>
                  <th className="text-left py-3 px-2 font-semibold">Pack</th>
                  <th className="text-center py-3 px-2 font-semibold">Adultos</th>
                  <th className="text-center py-3 px-2 font-semibold">Niños</th>
                  <th className="text-center py-3 px-2 font-semibold">Alergias</th>
                  <th className="text-left py-3 px-2 font-semibold">Estado</th>
                  <th className="text-left py-3 px-2 font-semibold">Método</th>
                  <th className="text-right py-3 px-2 font-semibold">Importe</th>
                  <th className="text-left py-3 px-2 font-semibold">Fecha reserva</th>
                  <th className="text-left py-3 px-2 font-semibold">Día evento</th>
                  <th className="text-center py-3 px-2 font-semibold">Asist.</th>
                  <th className="text-right py-3 px-2 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-2 font-medium">{b.name} {b.surname}</td>
                    <td className="py-3 px-2 text-gray-600">{b.email}</td>
                    <td className="py-3 px-2 text-gray-600">{b.phone}</td>
                    <td className="py-3 px-2">
                      {getBookingPackLabels(b).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {getBookingPackLabels(b).map((label, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">{label}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">NO</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center">{b.adultsCount}</td>
                    <td className="py-3 px-2 text-center">{b.childrenCount}</td>
                    <td className="py-3 px-2 text-center"><AllergyBadge booking={b} /></td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${b.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {b.paymentStatus === 'paid' ? <><Check className="w-3 h-3" /> Pagado</> : 'No pagado'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-gray-600">{b.paymentMethod === 'stripe' ? 'Online' : 'Efectivo'}</td>
                    <td className="py-3 px-2 text-right font-medium">{(b.totalAmountCents / 100).toFixed(2)}€</td>
                    <td className="py-3 px-2 text-gray-600 text-xs">{formatDate(b.createdAt)}</td>
                    <td className="py-3 px-2 text-gray-600 text-xs">{formatEventDate(b.eventDate)}</td>
                    <td className="py-3 px-2 text-center">
                      {b.confirmedAssistance ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 rounded-full"><Check className="w-4 h-4 text-green-600" /></span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-100 rounded-full"><X className="w-4 h-4 text-gray-400" /></span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => navigate(`/inscripciones/${b.id}`)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors" title="Editar"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleResend(b.id)} disabled={sendingEmail === b.id} className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors disabled:opacity-50" title="Reenviar email">
                          {sendingEmail === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setDeleteConfirm(b.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bookings.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No hay inscripciones</p>
                {hasActiveFilters && <button onClick={handleClearFilters} className="text-primary-600 text-sm mt-2 hover:underline">Limpiar filtros</button>}
              </div>
            )}
          </div>
        </>
      )}

      {!loading && bookings.length > 0 && <p className="text-sm text-gray-500 mt-4">Mostrando {bookings.length} inscripción{bookings.length !== 1 ? 'es' : ''}</p>}

      {/* Delete dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-semibold mb-2">¿Eliminar inscripción?</h3>
            <p className="text-gray-600 mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn btn-secondary">Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn btn-danger">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Allergies dialog */}
      {allergiesDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Alergias - {allergiesDialog.name} {allergiesDialog.surname}
              </h3>
              <button onClick={() => { setAllergiesDialog(null); setAllergiesData([]); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {allergiesLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
            ) : allergiesData.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay alergias registradas</p>
            ) : (
              <div className="space-y-4">
                {allergiesData.map((member) => (
                  <div key={member.id} className="border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${member.memberType === 'adult' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                        {member.memberType === 'adult' ? 'Adulto' : 'Niño/a'}
                      </span>
                      <span className="font-semibold">{member.name} {member.lastname}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {member.allergies.map((allergyId) => {
                        const allergen = getAllergenInfo(allergyId);
                        return (
                          <span key={allergyId} className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-full text-sm">
                            <span>{allergen.icon}</span>
                            <span>{allergen.name}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-6 flex justify-end">
              <button onClick={() => { setAllergiesDialog(null); setAllergiesData([]); }} className="btn btn-secondary">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
