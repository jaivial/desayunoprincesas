import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchSettings, savePack } from '../store/settingsSlice';
import { ChevronRight, Loader2, Save, Plus, Minus, Trash2, Package } from 'lucide-react';
import Select from '../components/ui/Select';
import Toggle from '../components/ui/Toggle';

const DEFAULT_FROM = '#ec4899';
const DEFAULT_TO = '#a855f7';
const DEFAULT_BORDER = '#ec4899';

// Normalises any stored value to a valid hex color, or returns the fallback.
const toHex = (value, fallback) =>
  /^#[0-9a-f]{6}$/i.test(String(value || '').trim()) ? value.trim() : fallback;

// Converts a hex color to an rgba() string (used for the live preview).
const hexToRgba = (hex, alpha) => {
  const m = String(hex || '').trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return `rgba(255,255,255,${alpha})`;
  const int = parseInt(m[1], 16);
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
};

// A color picker field combining a native color input with a hex text input.
function ColorField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={toHex(value, '#000000')}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 rounded border border-gray-300 cursor-pointer bg-white p-0.5"
          aria-label={label}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input font-mono text-sm"
          placeholder="#ec4899"
        />
      </div>
    </div>
  );
}

const ICON_OPTIONS = [
  { value: 'Sparkles', label: 'Sparkles ✨' },
  { value: 'Castle', label: 'Castle 🏰' },
  { value: 'Camera', label: 'Camera 📸' },
  { value: 'Crown', label: 'Crown 👑' },
  { value: 'Star', label: 'Star ⭐' },
  { value: 'Package', label: 'Package 📦' },
];

const EMPTY_PACK = {
  id: '',
  name: '',
  emoji: '',
  icon: 'Sparkles',
  adults: 1,
  children: 1,
  priceCents: 0,
  hasPhotographer: false,
  hasPremiumPass: false,
  shortDescription: '',
  description: '',
  persons: '',
  colorFrom: DEFAULT_FROM,
  colorTo: DEFAULT_TO,
  borderColor: DEFAULT_BORDER,
  highlight: '',
  premium: false,
  includes: [],
  displayOrder: 0,
  active: true,
  completed: false,
  maxLimitEnabled: false,
  maxTickets: 0,
};

const slugify = (value) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export default function EditPackPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { data: settings, saving } = useSelector((state) => state.settings);

  const isNew = id === 'new';
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!settings) dispatch(fetchSettings());
  }, [settings, dispatch]);

  useEffect(() => {
    if (isNew) {
      // Form state must reset when route changes to the new-pack editor.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({ ...EMPTY_PACK });
      return;
    }
    if (settings?.packs) {
      const existing = settings.packs.find((p) => p.id === id);
      if (existing) {
        const [fromHex, toHex2] = String(existing.color || '').split(',').map((c) => c.trim());
        setForm({
          ...EMPTY_PACK,
          ...existing,
          price: (existing.priceCents / 100).toFixed(2),
          colorFrom: toHex(fromHex, DEFAULT_FROM),
          colorTo: toHex(toHex2 || fromHex, DEFAULT_TO),
          borderColor: toHex(existing.borderColor, DEFAULT_BORDER),
        });
      }
    }
  }, [isNew, id, settings]);

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const updateInclude = (index, value) => {
    setForm((prev) => {
      const includes = [...prev.includes];
      includes[index] = value;
      return { ...prev, includes };
    });
  };

  const addInclude = () => setForm((prev) => ({ ...prev, includes: [...prev.includes, ''] }));
  const removeInclude = (index) =>
    setForm((prev) => ({ ...prev, includes: prev.includes.filter((_, i) => i !== index) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    const packId = isNew ? slugify(form.id || form.name) : form.id;
    if (!packId) {
      setMessage({ type: 'error', text: 'El identificador (slug) es obligatorio' });
      return;
    }
    if (!form.name.trim()) {
      setMessage({ type: 'error', text: 'El nombre es obligatorio' });
      return;
    }

    const payload = {
      id: packId,
      name: form.name,
      emoji: form.emoji,
      icon: form.icon,
      adults: parseInt(form.adults, 10) || 0,
      children: parseInt(form.children, 10) || 0,
      priceCents: Math.round(parseFloat(form.price || 0) * 100),
      hasPhotographer: !!form.hasPhotographer,
      hasPremiumPass: !!form.hasPremiumPass,
      shortDescription: form.shortDescription,
      description: form.description,
      persons: form.persons,
      color: `${form.colorFrom},${form.colorTo}`,
      borderColor: form.borderColor,
      highlight: form.highlight,
      premium: !!form.premium,
      includes: form.includes.filter((i) => i.trim() !== ''),
      displayOrder: parseInt(form.displayOrder, 10) || 0,
      active: form.active !== false,
      completed: !!form.completed,
      maxLimitEnabled: !!form.maxLimitEnabled,
      maxTickets: parseInt(form.maxTickets, 10) || 0,
    };

    try {
      await dispatch(savePack(payload)).unwrap();
      navigate('/settings');
    } catch {
      setMessage({ type: 'error', text: 'Error al guardar el pack' });
    }
  };

  if (!form) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4" aria-label="Breadcrumb">
        <button onClick={() => navigate('/settings')} className="hover:text-primary-600">
          Ajustes
        </button>
        <ChevronRight className="w-4 h-4" />
        <button onClick={() => navigate('/settings')} className="hover:text-primary-600">
          Packs
        </button>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-900 font-medium truncate">
          {isNew ? 'Nuevo pack' : form.name || id}
        </span>
      </nav>

      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
        <Package className="w-6 h-6" />
        {isNew ? 'Crear pack' : 'Editar pack'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        <div className="card p-4 sm:p-6 grid gap-3 sm:gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Identificador (slug)</label>
              <input
                type="text"
                className="input"
                value={form.id}
                onChange={(e) => set('id', e.target.value)}
                disabled={!isNew}
                placeholder="ej. pack_especial"
              />
              {!isNew && <p className="text-xs text-gray-500 mt-1">El identificador no se puede cambiar.</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nombre</label>
              <input type="text" className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Emoji</label>
              <input type="text" className="input" value={form.emoji} onChange={(e) => set('emoji', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Icono</label>
              <Select value={form.icon} onChange={(v) => set('icon', v)} options={ICON_OPTIONS} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Adultos</label>
              <input type="number" min="0" className="input" value={form.adults} onChange={(e) => set('adults', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Niños</label>
              <input type="number" min="0" className="input" value={form.children} onChange={(e) => set('children', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Precio (€)</label>
              <input type="number" step="0.01" min="0" className="input" value={form.price} onChange={(e) => set('price', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Orden</label>
              <input type="number" className="input" value={form.displayOrder} onChange={(e) => set('displayOrder', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Personas (texto)</label>
              <input type="text" className="input" value={form.persons} onChange={(e) => set('persons', e.target.value)} placeholder="1 adulto + 1 niño/a" />
            </div>
          </div>
        </div>

        <div className="card p-4 sm:p-6 grid gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Descripción corta (tarjeta de compra)</label>
            <input type="text" className="input" value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descripción larga (sección de packs)</label>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Etiqueta destacada (opcional)</label>
            <input type="text" className="input" value={form.highlight} onChange={(e) => set('highlight', e.target.value)} placeholder="ej. Incluye fotógrafo" />
          </div>
        </div>

        {/* Colores */}
        <div className="card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-1">Colores</h2>
          <p className="text-xs text-gray-500 mb-4">Elige los colores del pack. El fondo es un degradado entre el color inicial y el final.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ColorField label="Color inicial" value={form.colorFrom} onChange={(v) => set('colorFrom', v)} />
            <ColorField label="Color final" value={form.colorTo} onChange={(v) => set('colorTo', v)} />
            <ColorField label="Color del borde" value={form.borderColor} onChange={(v) => set('borderColor', v)} />
          </div>
          <div className="mt-4">
            <span className="block text-sm font-medium mb-1">Vista previa</span>
            <div
              className="rounded-xl p-4 text-sm text-gray-700"
              style={{
                backgroundImage: `linear-gradient(to right, ${hexToRgba(form.colorFrom, 0.2)}, ${hexToRgba(form.colorTo, 0.2)})`,
                border: `1px solid ${hexToRgba(form.borderColor, 0.5)}`,
              }}
            >
              {form.name || 'Vista previa del pack'}
            </div>
          </div>
        </div>

        {/* Estados */}
        <div className="card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-2">Estados</h2>
          <div className="divide-y divide-gray-100">
            <Toggle label="Incluye fotógrafo" checked={!!form.hasPhotographer} onChange={(v) => set('hasPhotographer', v)} />
            <Toggle label="Pase premium" checked={!!form.hasPremiumPass} onChange={(v) => set('hasPremiumPass', v)} />
            <Toggle label="Destacar como premium" description="Resalta el pack como experiencia premium" checked={!!form.premium} onChange={(v) => set('premium', v)} />
            <Toggle label="Activo" description="Si se desactiva, el pack no se muestra en la web" checked={form.active !== false} onChange={(v) => set('active', v)} />
            <Toggle label="Completado (agotado)" description="Desactiva la selección y muestra una cinta 'Completo'" checked={!!form.completed} onChange={(v) => set('completed', v)} />
          </div>
        </div>

        {/* Capacidad máxima */}
        <div className="card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-2">Capacidad máxima</h2>
          <Toggle
            label="Limitar unidades de este pack"
            description="Cuenta el número de packs vendidos (no las entradas dentro de cada pack). Cuando se alcance el límite, el pack se mostrará como completo en la web"
            checked={!!form.maxLimitEnabled}
            onChange={(v) => set('maxLimitEnabled', v)}
          />
          {form.maxLimitEnabled && (
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">Número máximo de packs</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => set('maxTickets', Math.max(0, (parseInt(form.maxTickets, 10) || 0) - 1))}
                  className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700"
                  aria-label="Restar"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min="0"
                  className="input w-24 text-center"
                  value={form.maxTickets}
                  onChange={(e) => set('maxTickets', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => set('maxTickets', (parseInt(form.maxTickets, 10) || 0) + 1)}
                  className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700"
                  aria-label="Sumar"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-500">packs</span>
              </div>
            </div>
          )}
        </div>

        <div className="card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-semibold">¿Qué incluye?</h2>
            <button type="button" onClick={addInclude} className="btn btn-secondary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" />
              Añadir
            </button>
          </div>
          <div className="space-y-2">
            {form.includes.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <input type="text" className="input" value={item} onChange={(e) => updateInclude(index, e.target.value)} />
                <button type="button" onClick={() => removeInclude(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {form.includes.length === 0 && <p className="text-sm text-gray-500">Sin elementos.</p>}
          </div>
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            {message.text}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/settings')} className="btn btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn btn-primary flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Guardar pack
          </button>
        </div>
      </form>
    </div>
  );
}
