/**
 * @fileoverview Hero section component for the landing page
 * 
 * Features:
 * - Full viewport height with rotating background images
 * - Fade transition every 2 seconds between images
 * - 70% opacity black overlay for text readability
 * - Event date fetched from backend settings
 * - Call-to-action button to scroll to tickets section
 * - Glassmorphism badge for "magical event" label
 * 
 * @component
 * @example
 * <Hero />
 */

import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Sparkles, Calendar, ChevronDown } from 'lucide-react';
import { HERO_IMAGES_16_9, HERO_IMAGES_9_16, preloadImages } from '../../assets/images.ts';

/**
 * Hero section with rotating background images and event information.
 * 
 * @returns {JSX.Element} The hero section component
 */
export default function Hero() {
  // Current image index for carousel
  const [currentImage, setCurrentImage] = useState(0);
  const [prevImage, setPrevImage] = useState(0);
  const [heroImages, setHeroImages] = useState(HERO_IMAGES_16_9);
  const [isFirstImageLoaded, setIsFirstImageLoaded] = useState(false);
  
  // Get settings from Redux store (includes event date)
  const settings = useSelector((state) => state.settings.data);

  /**
   * Preload hero images on mount and set up rotation interval.
   * Images rotate every 2 seconds with crossfade effect.
   */
  useEffect(() => {
    const mediaQuery = window.matchMedia('(orientation: portrait) and (max-aspect-ratio: 9/16)');

    const updateHeroImages = () => {
      const nextImages = mediaQuery.matches ? HERO_IMAGES_9_16 : HERO_IMAGES_16_9;
      console.log('[Hero] Switching images to:', mediaQuery.matches ? '9:16' : '16:9', 'count:', nextImages.length);
      setHeroImages(nextImages);
      setCurrentImage(0);
      setPrevImage(0);
      setIsFirstImageLoaded(false);
      preloadImages(nextImages);
    };

    updateHeroImages();
    mediaQuery.addEventListener('change', updateHeroImages);

    // Preload all hero images for smooth transitions
    preloadImages([...HERO_IMAGES_16_9, ...HERO_IMAGES_9_16]);

    return () => mediaQuery.removeEventListener('change', updateHeroImages);
  }, []);

  useEffect(() => {
    console.log('[Hero] Starting load/decode for ALL images:', heroImages.length);
    let cancelled = false;
    let interval;
    const startTime = Date.now();

    // Load and decode ALL images before starting carousel
    const loadPromises = heroImages.map((src, index) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = async () => {
          try {
            await img.decode();
            console.log('[Hero] Image', index, 'decoded:', src.split('/').pop());
            resolve();
          } catch (err) {
            console.warn('[Hero] Decode failed for image', index, err);
            resolve(); // Continue anyway
          }
        };
        img.onerror = () => {
          console.error('[Hero] Load failed for image', index);
          resolve(); // Continue anyway
        };
        img.src = src;
      });
    });

    Promise.all(loadPromises).then(() => {
      if (cancelled) return;
      
      const totalTime = Date.now() - startTime;
      console.log('[Hero] ALL images decoded in', totalTime, 'ms - starting carousel');
      
      setIsFirstImageLoaded(true);

      // Rotate images every 2 seconds after ALL images are ready
      interval = setInterval(() => {
        setCurrentImage((prev) => {
          setPrevImage(prev);
          return (prev + 1) % heroImages.length;
        });
      }, 2000);
    });

    return () => {
      console.log('[Hero] Cleanup - stopping carousel');
      cancelled = true;
      clearInterval(interval);
    };
  }, [heroImages]);

  /**
   * Formats a date string to Spanish locale format.
   * @param {string|null} dateString - ISO date string or null
   * @returns {string} Formatted date or fallback text
   */
  const formatDate = (dateString) => {
    if (!dateString) return 'Próximamente';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  /**
   * Smooth scrolls to the tickets section.
   */
  const scrollToTickets = () => {
    document.getElementById('entradas')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="inicio" className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Rotating background images with gapless crossfade.
          The previous image stays fully opaque underneath while the current
          one fades in on top, so the background is never blank. */}
      {heroImages.map((img, index) => {
        const isCurrent = index === currentImage;
        const isPrev = index === prevImage;
        return (
          <div
            key={img}
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
              isFirstImageLoaded && (isCurrent || isPrev) ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ backgroundImage: `url(${img})`, zIndex: isCurrent ? 2 : 1 }}
            role="img"
            aria-label={`Hero background ${index + 1}`}
          />
        );
      })}

      {/* Dark overlay - 70% opacity black, sits above images (z-index 3) */}
      <div className="absolute inset-0 bg-black/70 z-[3]" aria-hidden="true" />

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto animate-fade-in">
        {/* Glassmorphism badge */}
        <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full mb-6">
          <Sparkles className="w-5 h-5 text-princess-gold" aria-hidden="true" />
          <span className="text-white/90 text-sm font-medium">Un evento mágico</span>
        </div>

        {/* Main heading */}
        <h1 className="font-display text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
          Desayuno con
          <span className="block text-gradient">Princesas</span>
        </h1>

        {/* Description */}
        <p className="text-xl md:text-2xl text-white/80 mb-8 max-w-2xl mx-auto">
          Vive una experiencia única junto a tus princesas favoritas. 
          Desayuno, diversión y magia para toda la familia.
        </p>

        {/* Event date */}
        <div className="flex items-center justify-center gap-2 text-white/90 mb-10">
          <Calendar className="w-5 h-5 text-princess-pink" aria-hidden="true" />
          <time dateTime={settings?.eventDate}>{formatDate(settings?.eventDate)}</time>
        </div>

        {/* CTA Button */}
        <button 
          onClick={scrollToTickets} 
          className="btn-primary text-lg px-8 py-4"
          aria-label="Ir a la sección de reserva de entradas"
        >
          Reserva tu Entrada
        </button>
      </div>

      {/* Scroll indicator */}
      <div 
        className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce"
        aria-hidden="true"
      >
        <ChevronDown className="w-8 h-8 text-white/60" />
      </div>
    </section>
  );
}
