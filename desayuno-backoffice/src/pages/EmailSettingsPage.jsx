import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSettings, updateSettings } from '../store/settingsSlice';
import { Save, Loader2 } from 'lucide-react';
import Select from '../components/ui/Select';

const emailProviderOptions = [
  { value: 'smtp', label: 'SMTP' },
  { value: 'gmail', label: 'Gmail' },
];

export default function EmailSettingsPage() {
  const dispatch = useDispatch();
  const { data: settings, loading, saving } = useSelector((state) => state.settings);
  const [form, setForm] = useState({});
  const [message, setMessage] = useState(null);

  useEffect(() => {
    dispatch(fetchSettings());
  }, [dispatch]);

  useEffect(() => {
    if (settings) {
      // Synchronize editable fields after async settings load.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
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
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    const dataToSend = {
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
      setMessage({ type: 'success', text: 'Configuración de email guardada correctamente' });
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

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Configuración de Email</h1>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
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
                  <p className="text-xs text-gray-500 mt-1">Deja vacío para mantener la contraseña actual</p>
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
          Guardar configuración de email
        </button>
      </form>
    </div>
  );
}
