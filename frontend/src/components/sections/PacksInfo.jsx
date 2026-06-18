import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Package, ChevronDown, Camera, Crown, Star } from 'lucide-react';
import { selectPacks } from '../../store/bookingSlice';

// Converts a hex color (#rrggbb) to an rgba() string with the given alpha.
function hexToRgba(hex, alpha) {
  if (typeof hex !== 'string') return null;
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Builds inline styles for a pack's color when it is stored as hex values
// ("#from,#to" for the gradient and "#hex" for the border). Returns null for
// legacy Tailwind-class values so the component can fall back to classNames.
function packColorStyle(pack) {
  const [fromHex, toHex] = String(pack.color || '').split(',').map((c) => c.trim());
  const from = hexToRgba(fromHex, 0.2);
  if (!from) return null;
  const to = hexToRgba(toHex || fromHex, 0.2);
  const border = hexToRgba(pack.borderColor, 0.4);
  return {
    backgroundImage: `linear-gradient(to right, ${from}, ${to})`,
    border: '1px solid',
    borderColor: border || 'rgba(255,255,255,0.15)',
  };
}

const menuItems = [
  {
    title: '🥪 Banquete Salado',
    items: [
      'Minisandwiches de pavo y queso, y de Nutella',
      'Cesta de panes variados con confituras, AOVE y mantequilla',
      'Croissants de la corte (mantequilla y chocolate)'
    ]
  },
  {
    title: '🍰 Toque Dulce',
    items: [
      'Torres de castillo (tortitas con sirope)',
      'Galletas y bizcochos caseros de Hada'
    ]
  },
  {
    title: '🍓 Fruta Fresca',
    items: [
      'Brochetas mágicas de fruta de temporada'
    ]
  },
  {
    title: '🧃 Bebidas de Fantasía',
    items: [
      '"Poción Real" (zumo favorito y/o batido de chocolate) para los peques',
      'Café o infusión favorita para los papis'
    ]
  }
];

function PackAccordionItem({ pack, isOpen, onClick }) {
  const colorStyle = packColorStyle(pack);
  return (
    <div className="border-b border-white/10 last:border-0">
      <button
        type="button"
        onClick={onClick}
        className="w-full py-5 flex items-center justify-between text-left hover:text-princess-pink transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 pr-4">
          <span className="text-2xl">{pack.emoji}</span>
          <div>
            <span className="text-white font-medium block">{pack.name}</span>
            <span className="text-white/50 text-sm">{pack.persons} · {pack.price}€</span>
          </div>
          {pack.highlight && (
            <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              pack.premium ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'
            }`}>
              {pack.premium ? <Crown className="w-3 h-3" /> : <Camera className="w-3 h-3" />}
              {pack.highlight}
            </span>
          )}
        </div>
        <ChevronDown 
          className={`w-5 h-5 text-princess-pink flex-shrink-0 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-500 ${
          isOpen ? 'max-h-[600px] pb-5' : 'max-h-0'
        }`}
      >
        <div
          className={colorStyle ? 'p-4 rounded-xl' : `p-4 rounded-xl bg-gradient-to-r ${pack.color} border ${pack.borderColor}`}
          style={colorStyle || undefined}
        >
          <p className="text-white/80 mb-4">{pack.description}</p>
          
          <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-princess-gold" />
            ¿Qué incluye?
          </h4>
          
          <ul className="space-y-2">
            {pack.includes.map((item, idx) => (
              <li key={idx} className={`flex items-start gap-2 text-sm ${
                item.startsWith('⭐') ? 'text-princess-gold font-medium' : 'text-white/70'
              }`}>
                {!item.startsWith('⭐') && !item.startsWith('📸') && <span className="text-princess-pink mt-1">•</span>}
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function PacksInfo() {
  const [openPackIndex, setOpenPackIndex] = useState(null);
  const packs = useSelector(selectPacks);

  const togglePackItem = (index) => {
    setOpenPackIndex(openPackIndex === index ? null : index);
  };

  return (
    <section
      id="packs"
      className="py-20 bg-magic-dark"
      aria-labelledby="packs-heading"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Intro */}
        <div className="text-center mb-12">
          <p className="text-white/80 text-lg leading-relaxed max-w-3xl mx-auto mb-8">
            ¿Te imaginas a tus pequeños desayunando junto a sus princesas favoritas, <span className="text-princess-pink font-semibold">Bella, Blancanieves, Ariel y Jasmine</span>? 👑🍎🌹🐚
          </p>
          <p className="text-white/70 leading-relaxed max-w-3xl mx-auto">
            El <span className="text-gradient font-semibold">Desayuno Real</span> ha llegado para cumplir los sueños de los más pequeños. La magia ha descendido sobre Alquería Villa Carmen y hemos creado un rincón donde los cuentos cobran vida. Un encuentro único, diseñado con el corazón, para que niños y mayores vivan una mañana inolvidable.
          </p>
        </div>

        {/* Menu Section */}
        <div className="glass rounded-3xl p-6 md:p-8 mb-12">
          <h3 className="font-display text-2xl md:text-3xl font-bold text-white text-center mb-6">
            ✨ Un festín digno de la Realeza 👑🍓
          </h3>
          <p className="text-white/70 text-center mb-8">
            Hemos diseñado un menú mágico donde el sabor y la fantasía se unen. En nuestra mesa real, los invitados disfrutarán de:
          </p>
          
          <div className="grid md:grid-cols-2 gap-6">
            {menuItems.map((category, idx) => (
              <div key={idx} className="bg-white/5 rounded-xl p-4">
                <h4 className="text-white font-semibold mb-3">{category.title}</h4>
                <ul className="space-y-2">
                  {category.items.map((item, itemIdx) => (
                    <li key={itemIdx} className="text-white/70 text-sm flex items-start gap-2">
                      <span className="text-princess-gold">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          <p className="text-white/60 text-sm text-center mt-6 italic">
            Todo el menú está elaborado con mimo, porque en nuestro Reino, ¡cada bocado cuenta una historia!
          </p>
        </div>

        {/* Packs Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Package className="w-6 h-6 text-princess-gold" aria-hidden="true" />
            <span className="text-princess-gold font-medium">💖 PACKS DISPONIBLES 💖</span>
          </div>
          <h2
            id="packs-heading"
            className="font-display text-4xl md:text-5xl font-bold text-white mb-4"
          >
            Elige tu <span className="text-gradient">Experiencia</span>
          </h2>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Descubre todos los detalles de cada pack y elige el que mejor se adapte a tu familia
          </p>
        </div>

        <div className="glass rounded-3xl p-6 md:p-8">
          {packs.map((pack, index) => (
            <PackAccordionItem
              key={pack.id}
              pack={pack}
              isOpen={openPackIndex === index}
              onClick={() => togglePackItem(index)}
            />
          ))}
        </div>

        {/* Footer */}
        <p className="text-center text-white/60 mt-8 text-sm">
          ✨ Un evento creado con muchísima ilusión por <span className="text-princess-pink">Alquería Villa Carmen</span> y <span className="text-princess-gold">Badabadú Animaciones</span> ✨
        </p>
      </div>
    </section>
  );
}
