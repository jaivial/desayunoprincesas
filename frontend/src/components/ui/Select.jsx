/**
 * Custom Select/Dropdown component with glassmorphism style
 */
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function Select({ 
  value, 
  onChange, 
  options = [], 
  placeholder = 'Seleccionar...', 
  disabled = false,
  className = '' 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-3 text-left text-base bg-white/10 border border-white/20 rounded-xl flex items-center justify-between gap-2 transition-all
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/15 focus:outline-none focus:border-princess-pink'}
          ${isOpen ? 'border-princess-pink bg-white/15' : ''}`}
      >
        <span className={selectedOption ? 'text-white' : 'text-white/50'}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-white/60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 glass rounded-xl overflow-hidden max-h-60 overflow-auto">
          {options.length === 0 ? (
            <div className="px-4 py-3 text-white/50 text-sm">Sin opciones</div>
          ) : (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`w-full px-4 py-3 text-left flex items-center justify-between gap-2 transition-colors
                  ${option.value === value ? 'bg-princess-pink/30 text-white' : 'text-white/80 hover:bg-white/10'}`}
              >
                <span>{option.label}</span>
                {option.value === value && <Check className="w-4 h-4" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
