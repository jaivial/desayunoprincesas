import { useState } from 'react';
import { Menu, X, Sparkles, Ticket } from 'lucide-react';

const navLinks = [
  { href: '#inicio', label: 'Inicio' },
  { href: '#galeria', label: 'Galería' },
  { href: '#horarios', label: 'Horarios' },
  { href: '#incluye', label: 'Qué incluye' },
  { href: '#entradas', label: 'Entradas' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const scrollToTickets = () => {
    document.getElementById('entradas')?.scrollIntoView({ behavior: 'smooth' });
    setIsOpen(false);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 glass-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <a href="#inicio" className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-princess-gold" />
              <span className="font-display text-xl font-semibold text-white">
                Desayuno con Princesas
              </span>
            </a>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-white/80 hover:text-white transition-colors text-sm font-medium"
                >
                  {link.label}
                </a>
              ))}
              <button onClick={scrollToTickets} className="btn-primary flex items-center gap-2 text-sm">
                <Ticket className="w-4 h-4" />
                Comprar Entradas
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden text-white p-2"
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile sidenav */}
      <div
        className={`fixed inset-0 z-40 md:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="absolute inset-0 bg-black/60" onClick={() => setIsOpen(false)} />
        <div
          className={`absolute top-0 right-0 w-72 h-full glass-dark transform transition-transform duration-300 ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="p-6 pt-20">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="text-white/80 hover:text-white transition-colors text-lg font-medium py-2"
                >
                  {link.label}
                </a>
              ))}
              <button onClick={scrollToTickets} className="btn-primary flex items-center justify-center gap-2 mt-4">
                <Ticket className="w-4 h-4" />
                Comprar Entradas
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
