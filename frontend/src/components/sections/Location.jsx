import { MapPin, Navigation } from 'lucide-react';

const ADDRESS = 'Carrer Sèquia Rascanya, 2, 46470 Catarroja, València';
const MAPS_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ADDRESS)}`;

export default function Location() {
  return (
    <section
      id="ubicacion"
      className="py-20 bg-gradient-to-b from-princess-purple/20 to-magic-dark"
      aria-labelledby="location-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <MapPin className="w-6 h-6 text-princess-pink" aria-hidden="true" />
            <span className="text-princess-pink font-medium">Ubicación</span>
          </div>
          <h2
            id="location-heading"
            className="font-display text-4xl md:text-5xl font-bold text-white mb-4"
          >
            ¿Dónde <span className="text-gradient">Estamos</span>?
          </h2>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Ven a visitarnos a la Alquería Villa Carmen
          </p>
        </div>

        <div className="flex flex-col items-center gap-6">
          <address className="not-italic text-center">
            <p className="text-white text-xl font-medium">Alquería Villa Carmen</p>
            <p className="text-white/70 text-lg mt-2">{ADDRESS}</p>
          </address>

          <a
            href={MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-4"
          >
            <Navigation className="w-5 h-5" />
            Cómo llegar
          </a>
        </div>
      </div>
    </section>
  );
}
