import { Sparkles, Phone, Globe } from 'lucide-react';

const ADDRESS = 'C/ Sequía de Rascanya, 2, 46470 Catarroja, Valencia';
const WHATSAPP_URL = 'https://wa.me/34638857294';
const INSTAGRAM_URL = 'https://www.instagram.com/alqueria_villacarmen/?hl=es';
const WEBSITE_URL = 'https://alqueriavillacarmen.com';

export default function Footer() {
  return (
    <footer className="py-16 bg-black/60 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          {/* Brand */}
          <div className="text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start mb-4">
              <Sparkles className="w-6 h-6 text-princess-gold" />
              <span className="font-display text-xl font-semibold text-white">
                Desayuno con Princesas
              </span>
            </div>
            <p className="text-white/60 text-sm">
              Una experiencia mágica para toda la familia en la Alquería Villa Carmen.
            </p>
          </div>

          {/* Contact */}
          <div className="text-center">
            <h3 className="text-white font-semibold mb-4">Contacto</h3>
            <div className="space-y-3">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 justify-center text-white/60 hover:text-princess-pink transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span>+34 638 857 294</span>
              </a>
              <p className="text-white/60 text-sm">{ADDRESS}</p>
            </div>
          </div>

          {/* Social / Links */}
          <div className="text-center md:text-right">
            <h3 className="text-white font-semibold mb-4">Síguenos</h3>
            <div className="flex items-center gap-4 justify-center md:justify-end">
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/10 hover:bg-princess-pink/20 text-white/60 hover:text-princess-pink transition-colors"
                aria-label="Instagram"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a
                href={WEBSITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/10 hover:bg-princess-pink/20 text-white/60 hover:text-princess-pink transition-colors"
                aria-label="Sitio web"
              >
                <Globe className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/40 text-sm">
            © {new Date().getFullYear()} Desayuno con Princesas. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-4">
            <a href="/terminos" className="text-white/40 hover:text-white/70 text-sm transition-colors">
              Términos y Condiciones
            </a>
            <span className="text-white/20">|</span>
            <a href="/privacidad" className="text-white/40 hover:text-white/70 text-sm transition-colors">
              Política de Privacidad
            </a>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://alqueriavillacarmen.com" target="_blank" rel="noopener noreferrer">
              <img 
                src="https://villacarmenmedia.b-cdn.net/images/icons/logoblancopng.PNG" 
                alt="Alquería Villa Carmen" 
                className="h-20 opacity-70 hover:opacity-100 transition-opacity"
              />
            </a>
            <img 
              src="https://villacarmenmedia.b-cdn.net/princesas/WhatsApp_Image_2026-06-12_at_17.30.48-removebg-preview.webp" 
              alt="Desayuno con Princesas" 
              className="h-20 opacity-70 hover:opacity-100 transition-opacity"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
