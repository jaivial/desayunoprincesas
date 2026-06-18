import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchSettings, updateSettings } from '../store/settingsSlice';
import { Save, Loader2, Euro, Tag, Package, Plus, Pencil, Users } from 'lucide-react';
import Select from '../components/ui/Select';
import DatePicker from '../components/ui/DatePicker';

export default function SettingsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { data: settings, loading, saving } = useSelector((state) => state.settings);
  const packs = settings?.packs || [];
  const [form, setForm] = useState({});
  const [message, setMessage] = useState(null);

  useEffect(() => {
    dispatch(fetchSettings());
  }, [dispatch]);

  useEffect(() => {
    if (settings) {
      setForm({
        maxCapacity: settings.maxCapacity || 120,
        adultPrice: settings.adultPriceCents ? (settings.adultPriceCents / 100).toFixed(2) : '35.00',
        childPrice: settings.childPriceCents ? (settings.childPriceCents / 100).toFixed(2) : '40.00',
        eventDate: settings.eventDate || '',
        earlyBirdCount: settings.earlyBirdCount || 0,
        earlyBirdDiscountPercent: settings.earlyBirdDiscountPercent || 0,
        maxIndividualAdultTickets: settings.maxIndividualAdultTickets || 0,
        maxIndividualChildTickets: settings.maxIndividualChildTickets || 0,
        emailProvider: settings.emailProvider || 'smtp',
        smtpHost: settings.smtpHost || '',
        smtpPort: settings.smtpPort || 587,
        smtpUsername: settings.smtpUsername || '',
        smtpFromEmail: settings.smtpFromEmail || '',
        smtpPassword: '',
        gmailUsername: settings.gmailUsername || '',
      });
    }
  }, [settings]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'number' ? value : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    
    const dataToSend = {
      maxCapacity: parseInt(form.maxCapacity, 10),
      adultPriceCents: Math.round(parseFloat(form.adultPrice) * 100),
      childPriceCents: Math.round(parseFloat(form.childPrice) * 100),
      eventDate: form.eventDate || null,
      earlyBirdCount: parseInt(form.earlyBirdCount, 10) || 0,
      earlyBirdDiscountPercent: parseInt(form.earlyBirdDiscountPercent, 10) || 0,
      maxIndividualAdultTickets: parseInt(form.maxIndividualAdultTickets, 10) || 0,
      maxIndividualChildTickets: parseInt(form.maxIndividualChildTickets, 10) || 0,
      emailProvider: form.emailProvider,
      smtpHost: form.smtpHost,
      smtpPort: parseInt(form.smtpPort, 10),
      smtpUsername: form.smtpUsername,
      smtpFromEmail: form.smtpFromEmail,
      smtpPassword: form.smtpPassword || undefined,
      gmailUsername: form.gmailUsername,
    };

    try {
      await dispatch(updateSettings(dataToSend)).unwrap();
      setMessage({ type: 'success', text: 'Configuración guardada correctamente' });
    } catch {
      setMessage({ type: 'error', text: 'Error al guardar la configuración' });
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const emailProviderOptions = [
    { value: 'smtp', label: 'SMTP' },
    { value: 'gmail', label: 'Gmail' },
  ];

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Configuración</h1>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Event settings */}
        <div className="card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Evento</h2>
          <div className="grid gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Capacidad máxima</label>
              <input 
                type="number" 
                name="maxCapacity" 
                value={form.maxCapacity} 
                onChange={handleChange} 
                className="input" 
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fecha del evento</label>
              <DatePicker
                value={form.eventDate}
                onChange={(value) => setForm((prev) => ({ ...prev, eventDate: value }))}
                placeholder="Seleccionar fecha y hora..."
                showTime={true}
              />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <Euro className="w-5 h-5" />
            Precios
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Precio adulto (€)</label>
              <div className="relative">
                <input 
                  type="number" 
                  name="adultPrice" 
                  value={form.adultPrice} 
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
                  value={form.childPrice} 
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

        {/* Individual Ticket Limits */}
        <div className="card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Límites de Entradas Individuales por Compra
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Máx. entradas adulto</label>
              <input 
                type="number" 
                name="maxIndividualAdultTickets" 
                value={form.maxIndividualAdultTickets} 
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
                value={form.maxIndividualChildTickets} 
                onChange={handleChange} 
                className="input" 
                min="0"
                placeholder="0 = sin límite"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Limita el número máximo de entradas individuales (no en packs) que un cliente puede comprar por transacción. 0 = sin límite.
          </p>
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
          {packs.length === 0 ? (
            <p className="text-sm text-gray-500">No hay packs todavía.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {packs.map((pack) => (
                <li key={pack.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl">{pack.emoji}</span>
                    <div className="min-w-0">
                      <p className="font-medium truncate flex items-center gap-2">
                        {pack.name}
                        {pack.completed && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Completo</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">{pack.persons} · {(pack.priceCents / 100).toFixed(2)}€</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/settings/packs/${pack.id}`)}
                    className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
                    title="Editar pack"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Primeras Reservas Discount */}
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
                value={form.earlyBirdCount} 
                onChange={handleChange} 
                className="input" 
                min="0"
                placeholder="0 = desactivado"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Porcentaje de descuento (%)</label>
              <div className="relative">
                <input 
                  type="number" 
                  name="earlyBirdDiscountPercent" 
                  value={form.earlyBirdDiscountPercent} 
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
              Las primeras {form.earlyBirdCount} reservas tendrán un {form.earlyBirdDiscountPercent}% de descuento aplicado automáticamente.
            </p>
          )}
        </div>

        {/* Email settings */}
        <div className="card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Email</h2>
          <div className="grid gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Proveedor</label>
              <Select
                value={form.emailProvider}
                onChange={(value) => setForm((prev) => ({ ...prev, emailProvider: value }))}
                options={emailProviderOptions}
                placeholder="Seleccionar proveedor..."
              />
            </div>

            {form.emailProvider === 'smtp' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Host SMTP</label>
                    <input 
                      type="text" 
                      name="smtpHost" 
                      value={form.smtpHost} 
                      onChange={handleChange} 
                      className="input" 
                      placeholder="smtp.example.com" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Puerto SMTP</label>
                    <input 
                      type="number" 
                      name="smtpPort" 
                      value={form.smtpPort} 
                      onChange={handleChange} 
                      className="input" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Usuario SMTP</label>
                  <input 
                    type="text" 
                    name="smtpUsername" 
                    value={form.smtpUsername} 
                    onChange={handleChange} 
                    className="input" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Contraseña SMTP</label>
                  <input 
                    type="password" 
                    name="smtpPassword" 
                    value={form.smtpPassword} 
                    onChange={handleChange} 
                    className="input" 
                    placeholder="••••••••"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Deja vacío para mantener la contraseña actual
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email de envío</label>
                  <input 
                    type="email" 
                    name="smtpFromEmail" 
                    value={form.smtpFromEmail} 
                    onChange={handleChange} 
                    className="input" 
                  />
                </div>
              </>
            )}

            {form.emailProvider === 'gmail' && (
              <div>
                <label className="block text-sm font-medium mb-1">Email Gmail</label>
                <input 
                  type="email" 
                  name="gmailUsername" 
                  value={form.gmailUsername} 
                  onChange={handleChange} 
                  className="input" 
                  placeholder="tu@gmail.com" 
                />
                <p className="text-xs text-gray-500 mt-1">
                  Usa contraseña de aplicación desde Seguridad de Google
                </p>
              </div>
            )}
          </div>
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
    </div>
  );
}
