import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchSettings } from '../store/settingsSlice';
import { fetchEventDates, createEventDate, patchEventDate, patchEventDatePacks } from '../store/eventDatesSlice';
import { Save, Loader2, Euro, Tag, Package, Plus, Pencil, Users, CalendarDays, Lock, Unlock } from 'lucide-react';
import MonthCalendar from '../components/ui/MonthCalendar';

export default function SettingsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { data: settings, loading: settingsLoading } = useSelector((state) => state.settings);
  const { list: eventDates, loading: datesLoading, saving } = useSelector((state) => state.eventDates);

  const [selectedDate, setSelectedDate] = useState(null); // "YYYY-MM-DD"
  const [form, setForm] = useState({});
  const [packForms, setPackForms] = useState({}); // packId -> { active, priceCents, maxEnabled, maxTickets }
  const [message, setMessage] = useState(null);

  useEffect(() => {
    dispatch(fetchSettings());
    dispatch(fetchEventDates());
  }, [dispatch]);

  // When a date is selected, seed form from that date's data
  const selectedED = eventDates.find((ed) => ed.eventDate.slice(0, 10) === selectedDate) || null;

  useEffect(() => {
    if (selectedED) {
      // Hydrate the date editor when selection changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        maxCapacity: selectedED.maxCapacity,
        adultPrice: (selectedED.adultPriceCents / 100).toFixed(2),
        childPrice: (selectedED.childPriceCents / 100).toFixed(2),
        earlyBirdCount: selectedED.earlyBirdCount,
        earlyBirdDiscountPercent: selectedED.earlyBirdDiscountPercent,
        maxIndividualAdultTickets: selectedED.maxIndividualAdultTickets,
        maxIndividualChildTickets: selectedED.maxIndividualChildTickets,
      });
      // seed pack forms from event_date_packs
      const pf = {};
      const catalogPacks = settings?.packs || [];
      // start from catalog packs, override with per-date config
      for (const p of catalogPacks) {
        const dp = (selectedED.packs || []).find((dp) => dp.packId === p.id);
        pf[p.id] = {
          active: dp ? dp.active : p.active !== false,
          priceCents: dp ? dp.priceCents : p.priceCents,
          maxEnabled: dp ? dp.maxEnabled : false,
          maxTickets: dp ? dp.maxTickets : 0,
        };
      }
      setPackForms(pf);
    } else {
      setForm({});
      setPackForms({});
    }
  }, [selectedDate, eventDates]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleOpenDay = async () => {
    if (!selectedDate) return;
    setMessage(null);
    try {
      // Existing-but-closed day → reopen; brand-new day → create.
      if (selectedED) {
        await dispatch(patchEventDate({ id: selectedED.id, data: { isOpen: true } })).unwrap();
      } else {
        await dispatch(createEventDate(selectedDate)).unwrap();
      }
      setMessage({ type: 'success', text: `Día ${selectedDate} abierto correctamente` });
    } catch {
      setMessage({ type: 'error', text: 'Error al abrir el día' });
    }
  };

  const handleCloseDay = async () => {
    if (!selectedED) return;
    setMessage(null);
    try {
      await dispatch(patchEventDate({ id: selectedED.id, data: { isOpen: false } })).unwrap();
      setMessage({ type: 'success', text: 'Día cerrado' });
    } catch {
      setMessage({ type: 'error', text: 'Error al cerrar el día' });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedED) return;
    setMessage(null);

    const data = {
      maxCapacity: parseInt(form.maxCapacity, 10),
      adultPriceCents: Math.round(parseFloat(form.adultPrice) * 100),
      childPriceCents: Math.round(parseFloat(form.childPrice) * 100),
      earlyBirdCount: parseInt(form.earlyBirdCount, 10) || 0,
      earlyBirdDiscountPercent: parseInt(form.earlyBirdDiscountPercent, 10) || 0,
      maxIndividualAdultTickets: parseInt(form.maxIndividualAdultTickets, 10) || 0,
      maxIndividualChildTickets: parseInt(form.maxIndividualChildTickets, 10) || 0,
    };

    const packsPayload = Object.entries(packForms).map(([packId, pf]) => ({
      packId,
      active: pf.active,
      priceCents: parseInt(pf.priceCents, 10) || 0,
      maxEnabled: pf.maxEnabled,
      maxTickets: parseInt(pf.maxTickets, 10) || 0,
    }));

    try {
      await Promise.all([
        dispatch(patchEventDate({ id: selectedED.id, data })).unwrap(),
        dispatch(patchEventDatePacks({ id: selectedED.id, packs: packsPayload })).unwrap(),
      ]);
      setMessage({ type: 'success', text: 'Configuración guardada correctamente' });
    } catch {
      setMessage({ type: 'error', text: 'Error al guardar la configuración' });
    }
  };

  const loading = settingsLoading || datesLoading;

  if (loading && eventDates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const catalogPacks = settings?.packs || [];

  const formatDay = (ymd) => {
    if (!ymd) return '';
    const [y, m, d] = ymd.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Configuración del Evento</h1>

      {/* Calendar */}
      <div className="card p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
          <CalendarDays className="w-5 h-5" />
          Calendario de fechas
        </h2>
        <div className="flex justify-center">
          <MonthCalendar
            eventDates={eventDates}
            selected={selectedDate}
            onSelect={setSelectedDate}
          />
        </div>
        {!selectedDate && (
          <p className="text-sm text-gray-500 mt-3 text-center">
            Selecciona un día en el calendario para abrirlo o editarlo, o haz clic en cualquier día del mes para abrirlo.
          </p>
        )}
      </div>

      {/* No date selected — show hint to click any day */}
      {!selectedDate && (
        <div className="card p-4 sm:p-6 text-center text-gray-500 text-sm">
          Haz clic en cualquier día del calendario para seleccionarlo.
        </div>
      )}

      {/* Selected a day that has no event date record, or is closed */}
      {selectedDate && (!selectedED || !selectedED.isOpen) && (
        <div className="card p-4 sm:p-6">
          <p className="text-sm text-gray-600 mb-4">
            El día <strong>{formatDay(selectedDate)}</strong> no está abierto.
          </p>
          {message && (
            <div className={`p-3 rounded-lg text-sm mb-4 ${message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {message.text}
            </div>
          )}
          <button
            onClick={handleOpenDay}
            disabled={saving}
            className="btn btn-primary flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
            Abrir este día
          </button>
        </div>
      )}

      {/* Selected an open day → show full editor */}
      {selectedED && selectedED.isOpen && (
        <form onSubmit={handleSave} className="space-y-4 sm:space-y-6">
          {/* Day header */}
          <div className="card p-4 sm:p-6 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="font-semibold text-lg">{formatDay(selectedED.eventDate)}</p>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${selectedED.isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {selectedED.isOpen ? 'Abierto' : 'Cerrado'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCloseDay}
              disabled={saving || !selectedED.isOpen}
              className="btn btn-secondary flex items-center gap-2 text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Cerrar día
            </button>
          </div>

          {/* Pricing */}
          <div className="card p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
              <Euro className="w-5 h-5" />
              Precios
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Capacidad máxima</label>
                <input
                  type="number"
                  name="maxCapacity"
                  value={form.maxCapacity ?? ''}
                  onChange={handleChange}
                  className="input"
                  min="1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Precio adulto (€)</label>
                  <div className="relative">
                    <input
                      type="number"
                      name="adultPrice"
                      value={form.adultPrice ?? ''}
                      onChange={handleChange}
                      className="input pr-8"
                      step="0.01"
                      min="0"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Precio niño (€)</label>
                  <div className="relative">
                    <input
                      type="number"
                      name="childPrice"
                      value={form.childPrice ?? ''}
                      onChange={handleChange}
                      className="input pr-8"
                      step="0.01"
                      min="0"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Individual Ticket Limits */}
          <div className="card p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Límites de Entradas Individuales
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Máx. entradas adulto</label>
                <input
                  type="number"
                  name="maxIndividualAdultTickets"
                  value={form.maxIndividualAdultTickets ?? ''}
                  onChange={handleChange}
                  className="input"
                  min="0"
                  placeholder="0 = sin límite"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Máx. entradas niño</label>
                <input
                  type="number"
                  name="maxIndividualChildTickets"
                  value={form.maxIndividualChildTickets ?? ''}
                  onChange={handleChange}
                  className="input"
                  min="0"
                  placeholder="0 = sin límite"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">0 = sin límite</p>
          </div>

          {/* Packs */}
          <div className="card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                <Package className="w-5 h-5" />
                Packs especiales
              </h2>
              <button
                type="button"
                onClick={() => navigate('/settings/packs/new')}
                className="btn btn-secondary flex items-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4" />
                Nuevo pack
              </button>
            </div>
            {catalogPacks.length === 0 ? (
              <p className="text-sm text-gray-500">No hay packs todavía.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {catalogPacks.map((pack) => {
                  const pf = packForms[pack.id] || { active: true, priceCents: pack.priceCents, maxEnabled: false, maxTickets: 0 };
                  return (
                    <li key={pack.id} className="py-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xl">{pack.emoji}</span>
                          <p className="font-medium truncate">{pack.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500 flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={pf.active}
                              onChange={(e) => setPackForms((prev) => ({ ...prev, [pack.id]: { ...pf, active: e.target.checked } }))}
                              className="rounded"
                            />
                            Activo
                          </label>
                          <button
                            type="button"
                            onClick={() => navigate(`/settings/packs/${pack.id}`)}
                            className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg"
                            title="Editar pack (catálogo)"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Precio (€)</label>
                          <div className="relative">
                            <input
                              type="number"
                              value={(pf.priceCents / 100).toFixed(2)}
                              onChange={(e) => setPackForms((prev) => ({
                                ...prev,
                                [pack.id]: { ...pf, priceCents: Math.round(parseFloat(e.target.value) * 100) || 0 },
                              }))}
                              className="input pr-7 text-sm"
                              step="0.01"
                              min="0"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">€</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Máx. tickets</label>
                          <input
                            type="number"
                            value={pf.maxTickets}
                            onChange={(e) => setPackForms((prev) => ({
                              ...prev,
                              [pack.id]: { ...pf, maxTickets: parseInt(e.target.value, 10) || 0 },
                            }))}
                            className="input text-sm"
                            min="0"
                            placeholder="0 = sin límite"
                          />
                        </div>
                        <div className="flex items-end">
                          <label className="text-xs text-gray-500 flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={pf.maxEnabled}
                              onChange={(e) => setPackForms((prev) => ({
                                ...prev,
                                [pack.id]: { ...pf, maxEnabled: e.target.checked },
                              }))}
                              className="rounded"
                            />
                            Límite activo
                          </label>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Early Bird */}
          <div className="card p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Descuento Primeras Reservas
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Primeras reservas con descuento</label>
                <input
                  type="number"
                  name="earlyBirdCount"
                  value={form.earlyBirdCount ?? ''}
                  onChange={handleChange}
                  className="input"
                  min="0"
                  placeholder="0 = desactivado"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Porcentaje (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    name="earlyBirdDiscountPercent"
                    value={form.earlyBirdDiscountPercent ?? ''}
                    onChange={handleChange}
                    className="input pr-8"
                    min="0"
                    max="100"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                </div>
              </div>
            </div>
            {form.earlyBirdCount > 0 && form.earlyBirdDiscountPercent > 0 && (
              <p className="text-xs text-gray-500 mt-3">
                Las primeras {form.earlyBirdCount} reservas tendrán un {form.earlyBirdDiscountPercent}% de descuento.
              </p>
            )}
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {message.text}
            </div>
          )}

          <button type="submit" disabled={saving} className="btn btn-primary w-full sm:w-auto flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Guardar configuración
          </button>
        </form>
      )}
    </div>
  );
}
