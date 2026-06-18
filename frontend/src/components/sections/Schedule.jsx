import { useSelector } from 'react-redux';
import { Clock, MapPin, Calendar, Coffee, Music, Camera, Sparkles, Crown } from 'lucide-react';

const scheduleItems = [
  { time: '09:45', title: 'Apertura de puertas', description: 'Recibimiento en el jardín con photocall temático.', icon: Camera },
  { time: '10:00', title: 'Saludo de las princesas', description: 'Saludo desde el balcón Real. ¡El momento de la bienvenida!', icon: Sparkles },
  { time: '10:15', title: 'Desayuno Real', description: 'Acceso al Salón Real para el inicio del Desayuno Real. Durante el servicio, las princesas visitarán vuestra mesa dando la bienvenida.', icon: Coffee },
  { time: '11:30', title: 'Salón de la Corte', description: '¡Show musical y comienzo del Tour Mágico! Exploraréis los 4 rincones especiales donde las princesas sellarán vuestro Pasaporte Real.', icon: Music },
];

export default function Schedule() {
  const settings = useSelector((state) => state.settings.data);
  const openDates = useSelector((state) => state.booking.openDates);

  const formatDate = (dateString) => {
    if (!dateString) return 'Fecha por confirmar';
    // dateString may be YYYY-MM-DD or RFC3339 (…T00:00:00Z); take date part only.
    const date = new Date(dateString.slice(0, 10) + 'T00:00:00');
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const eventDateDisplay = openDates && openDates.length > 1
    ? openDates.map((d) => formatDate(d.date)).join(' · ')
    : (openDates && openDates.length === 1)
      ? formatDate(openDates[0].date)
      : formatDate(settings?.eventDate);

  return (
    <section id="horarios" className="py-20 bg-gradient-to-b from-princess-purple/20 to-magic-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <Clock className="w-6 h-6 text-princess-gold" />
            <span className="text-princess-gold font-medium">Programa</span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
            Nuestro Itinerario <span className="text-gradient">Mágico</span>
          </h2>
        </div>

        {/* Event info cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="glass rounded-3xl p-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-princess-pink/20 flex items-center justify-center">
              <Calendar className="w-7 h-7 text-princess-pink" />
            </div>
            <div>
              <p className="text-white/60 text-sm">Fecha del evento</p>
              <p className="text-white font-semibold text-lg">{eventDateDisplay}</p>
            </div>
          </div>
          <a
            href="https://www.google.com/maps/dir/?api=1&destination=Carrer%20S%C3%A8quia%20Rascanya%2C%202%2C%2046470%20Catarroja%2C%20Val%C3%A8ncia"
            target="_blank"
            rel="noopener noreferrer"
            className="glass rounded-3xl p-6 flex items-center gap-4 hover:bg-white/10 transition-colors group"
          >
            <div className="w-14 h-14 rounded-2xl bg-princess-purple/20 flex items-center justify-center group-hover:bg-princess-purple/30 transition-colors">
              <MapPin className="w-7 h-7 text-princess-purple" />
            </div>
            <div>
              <p className="text-white/60 text-sm">Ubicación</p>
              <p className="text-white font-semibold text-lg">Alquería Villa Carmen</p>
              <p className="text-white/50 text-sm">C/ Sequía de Rascanya, 2 - Catarroja</p>
            </div>
          </a>
        </div>

        {/* Timeline */}
        <div className="relative">
          <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-princess-pink via-princess-purple to-princess-gold" />
          
          <div className="space-y-8">
            {scheduleItems.map((item, index) => {
              const Icon = item.icon;
              const isLeft = index % 2 === 0;
              return (
                <div
                  key={index}
                  className={`relative flex items-center gap-8 ${
                    isLeft ? 'md:flex-row' : 'md:flex-row-reverse'
                  }`}
                >
                  {/* Timeline dot */}
                  <div className="absolute left-8 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-princess-pink border-4 border-magic-dark z-10" />
                  
                  {/* Content */}
                  <div className={`ml-16 md:ml-0 md:w-1/2 ${isLeft ? 'md:pr-12 md:text-right' : 'md:pl-12'}`}>
                    <div className={`glass rounded-2xl p-6 inline-block ${isLeft ? 'md:ml-auto' : ''}`}>
                      <div className={`flex items-center gap-3 mb-2 ${isLeft ? 'md:flex-row-reverse' : ''}`}>
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-princess-gold" />
                        </div>
                        <span className="text-princess-pink font-bold text-lg">{item.time}</span>
                      </div>
                      <h3 className="text-white font-semibold text-lg mb-1">{item.title}</h3>
                      <p className="text-white/60">{item.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* VIP experience */}
        <div className="mt-16">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <Sparkles className="w-6 h-6 text-princess-gold" />
              <span className="text-princess-gold font-medium">¿Quieres una experiencia inolvidable?</span>
            </div>
            <p className="text-white/70 max-w-2xl mx-auto">
              Al finalizar, cerraremos con un espectáculo único. Y para quienes busquen la máxima
              exclusividad, presentamos nuestro Pase VIP de Oro.
            </p>
          </div>

          <div className="glass rounded-3xl p-8 max-w-3xl mx-auto border border-princess-gold/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-princess-gold/20 flex items-center justify-center">
                <Crown className="w-7 h-7 text-princess-gold" />
              </div>
              <h3 className="text-white font-display font-bold text-xl md:text-2xl">
                Experiencia VIP de Oro · Pase “Cuento de ensueño”
              </h3>
            </div>
            <p className="text-white/70 mb-4">
              Acceso privado al Salón del Jardín Encantado. Atención ultra personalizada con las
              princesas en grupo reducido y una sesión de fotos profesional (Book especial) para
              capturar su magia.
            </p>
            <p className="text-princess-pink font-medium">
              🎟️ Las plazas son muy limitadas. No te quedes fuera de esta experiencia en Alquería Villa Carmen.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
