/**
 * @fileoverview Gallery section component displaying event imagery
 * 
 * Features:
 * - Responsive masonry-style grid layout
 * - First image spans 2x2 on desktop for visual hierarchy
 * - Hover effects with scale transform and gradient overlay
 * - Decorative icons on hover
 * - Accessible alt text for all images
 * 
 * @component
 * @example
 * <Gallery />
 */

import { useState, useEffect, useCallback } from 'react';
import { Heart, Star, Camera, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { GALLERY_IMAGES } from '../../assets/images.ts';

/**
 * Gallery section showcasing event atmosphere through images.
 * Uses a responsive grid with the first image emphasized.
 * 
 * @returns {JSX.Element} The gallery section component
 */
export default function Gallery() {
  // Index of the image open in the lightbox, or null when closed
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const isOpen = lightboxIndex !== null;

  const openLightbox = useCallback((index) => setLightboxIndex(index), []);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const showPrev = useCallback(() => {
    setLightboxIndex((i) => (i === null ? i : (i - 1 + GALLERY_IMAGES.length) % GALLERY_IMAGES.length));
  }, []);

  const showNext = useCallback(() => {
    setLightboxIndex((i) => (i === null ? i : (i + 1) % GALLERY_IMAGES.length));
  }, []);

  // Keyboard navigation + lock body scroll while the lightbox is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') showPrev();
      else if (e.key === 'ArrowRight') showNext();
    };

    window.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, closeLightbox, showPrev, showNext]);

  return (
    <section 
      id="galeria" 
      className="py-20 bg-gradient-to-b from-magic-dark to-princess-purple/20"
      aria-labelledby="gallery-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <Camera className="w-6 h-6 text-princess-pink" aria-hidden="true" />
            <span className="text-princess-pink font-medium">Galería</span>
          </div>
          <h2 
            id="gallery-heading"
            className="font-display text-4xl md:text-5xl font-bold text-white mb-4"
          >
            Momentos <span className="text-gradient">Mágicos</span>
          </h2>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Descubre la magia que te espera en nuestro evento
          </p>
        </div>

        {/* Image grid - first image spans 2x2 on md+ screens */}
        <div 
          className="grid grid-cols-2 md:grid-cols-3 gap-4"
          role="list"
          aria-label="Galería de imágenes del evento"
        >
          {GALLERY_IMAGES.map((image, index) => (
            <button
              key={index}
              type="button"
              role="listitem"
              onClick={() => openLightbox(index)}
              aria-label={`Ampliar imagen: ${image.caption || image.alt}`}
              className={`relative group overflow-hidden rounded-2xl cursor-pointer focus:outline-none focus:ring-2 focus:ring-princess-pink ${
                index === 0 ? 'md:col-span-2 md:row-span-2' : ''
              }`}
            >
              {/* Image */}
              <img
                src={image.src}
                alt={image.alt}
                loading={index < 3 ? 'eager' : 'lazy'}
                className="w-full h-full object-cover aspect-square transition-transform duration-500 group-hover:scale-110"
              />
              
              {/* Hover overlay with gradient */}
              <div 
                className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                aria-hidden="true"
              />
              
              {/* Hover content - caption and icons */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="text-white font-medium text-sm">
                  {image.caption || image.alt}
                </span>
                <div className="flex gap-2" aria-hidden="true">
                  <Heart className="w-5 h-5 text-princess-pink" />
                  <Star className="w-5 h-5 text-princess-gold" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox / image viewer */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Visor de imágenes"
          onClick={closeLightbox}
        >
          {/* Close */}
          <button
            type="button"
            onClick={closeLightbox}
            aria-label="Cerrar visor"
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Previous */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); showPrev(); }}
            aria-label="Imagen anterior"
            className="absolute left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>

          {/* Image */}
          <figure
            className="max-w-[90vw] max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={GALLERY_IMAGES[lightboxIndex].src}
              alt={GALLERY_IMAGES[lightboxIndex].alt}
              className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg shadow-2xl"
            />
            <figcaption className="mt-4 text-white/90 text-center">
              {GALLERY_IMAGES[lightboxIndex].caption || GALLERY_IMAGES[lightboxIndex].alt}
              <span className="ml-2 text-white/50 text-sm">
                {lightboxIndex + 1} / {GALLERY_IMAGES.length}
              </span>
            </figcaption>
          </figure>

          {/* Next */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); showNext(); }}
            aria-label="Imagen siguiente"
            className="absolute right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </div>
      )}
    </section>
  );
}
