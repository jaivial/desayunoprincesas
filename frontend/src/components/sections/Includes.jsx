import { Check, Sparkles, Coffee, Camera, Music, Gift, Crown, Heart } from 'lucide-react';

const includes = [
  { icon: Coffee, title: 'Desayuno completo', description: 'Delicioso desayuno temático con variedad de opciones' },
  { icon: Crown, title: 'Encuentro con princesas', description: 'Conoce a tus princesas favoritas en persona' },
  { icon: Camera, title: 'Sesión de fotos', description: 'Fotos profesionales con las princesas' },
  { icon: Music, title: 'Espectáculo en vivo', description: 'Show musical con canciones mágicas' },
  { icon: Gift, title: 'Sorpresas y regalos', description: 'Detalles especiales para los pequeños' },
  { icon: Heart, title: 'Firma del Pasaporte Real', description: 'Las princesas firman tu pasaporte mágico como recuerdo' },
];

export default function Includes() {
  return (
    <section id="incluye" className="py-20 bg-gradient-to-b from-magic-dark to-princess-purple/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="w-6 h-6 text-princess-pink" />
            <span className="text-princess-pink font-medium">Incluido</span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
            ¿Qué <span className="text-gradient">incluye</span>?
          </h2>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Tu entrada incluye todo lo necesario para una experiencia mágica e inolvidable
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {includes.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="glass rounded-3xl p-6 hover:bg-white/20 transition-all duration-300 group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-princess-pink to-princess-purple flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-lg mb-2 flex items-center gap-2">
                      {item.title}
                      <Check className="w-4 h-4 text-green-400" />
                    </h3>
                    <p className="text-white/60">{item.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
