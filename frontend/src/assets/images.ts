/**
 * @fileoverview Centralized image URL management for Desayuno con Princesas
 * 
 * This file exports all image URLs used throughout the application.
 * In production, these URLs can be easily switched to CDN endpoints
 * by updating the CDN_BASE_URL constant.
 * 
 * @example
 * // Usage in components:
 * import { HERO_IMAGES, GALLERY_IMAGES } from '@/assets/images';
 * 
 * @version 1.0.0
 * @author Desayuno con Princesas Team
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Base URL for CDN assets. In development, this is empty (uses direct URLs).
 * In production, set this to your CDN domain (e.g., 'https://cdn.desayunoconprincesas.com')
 */
export const CDN_BASE_URL = '';

/**
 * Default image quality for Unsplash images (1-100)
 */
export const DEFAULT_QUALITY = 80;

// =============================================================================
// HERO SECTION IMAGES
// =============================================================================

/**
 * Background images for the hero section carousel.
 * These images rotate with a fade transition every 2 seconds.
 * Recommended size: 1920x1080 or higher for full-screen display.
 */
export const HERO_IMAGES_16_9: string[] = [
  'https://villacarmenmedia.b-cdn.net/princesas/IMG_6536.webp',
  'https://villacarmenmedia.b-cdn.net/princesas/ChatGPT%20Image%20Jun%2012%2C%202026%2C%2003_12_57%20PM.webp',
  'https://villacarmenmedia.b-cdn.net/princesas/ChatGPT%20Image%20Jun%2012%2C%202026%2C%2002_55_54%20PM.webp',
  'https://villacarmenmedia.b-cdn.net/princesas/ChatGPT%20Image%20Jun%2012%2C%202026%2C%2002_54_19%20PM.webp',
  'https://villacarmenmedia.b-cdn.net/princesas/Gemini_Generated_Image_56as8m56as8m56as.webp',
  'https://villacarmenmedia.b-cdn.net/princesas/blancanieves.webp',
];

export const HERO_IMAGES_9_16: string[] = [
  'https://villacarmenmedia.b-cdn.net/princesas/IMG_6536.webp',
  'https://villacarmenmedia.b-cdn.net/princesas/ChatGPT%20Image%20Jun%2012%2C%202026%2C%2002_53_00%20PM.webp',
  'https://villacarmenmedia.b-cdn.net/princesas/ChatGPT%20Image%20Jun%2012%2C%202026%2C%2002_37_49%20PM.webp',
  'https://villacarmenmedia.b-cdn.net/princesas/ChatGPT%20Image%20Jun%2012%2C%202026%2C%2002_19_37%20PM.webp',
  'https://villacarmenmedia.b-cdn.net/princesas/Gemini_Generated_Image_56as8m56as8m56as.webp',
  'https://villacarmenmedia.b-cdn.net/princesas/blancanieves.webp',
];

export const HERO_IMAGES: string[] = HERO_IMAGES_16_9;

// =============================================================================
// GALLERY SECTION IMAGES
// =============================================================================

/**
 * Gallery image item with source URL and alt text for accessibility.
 */
export interface GalleryImage {
  /** Image source URL */
  src: string;
  /** Alt text for accessibility and SEO */
  alt: string;
  /** Optional caption displayed on hover */
  caption?: string;
}

/**
 * Images displayed in the gallery grid section.
 * First image spans 2 columns and 2 rows on desktop.
 * Recommended size: 600x600 for grid items.
 */
export const GALLERY_IMAGES: GalleryImage[] = [
  {
    src: 'https://villacarmenmedia.b-cdn.net/princesas/IMG_6536.webp',
    alt: 'Desayuno con princesas',
    caption: 'Momentos mágicos',
  },
  {
    src: 'https://villacarmenmedia.b-cdn.net/princesas/ChatGPT%20Image%20Jun%2012%2C%202026%2C%2002_19_37%20PM.webp',
    alt: 'Magical breakfast',
    caption: 'Desayuno mágico',
  },
  {
    src: 'https://villacarmenmedia.b-cdn.net/princesas/ChatGPT%20Image%20Jun%2012%2C%202026%2C%2002_37_49%20PM.webp',
    alt: 'Kids activities',
    caption: 'Actividades para niños',
  },
  {
    src: 'https://villacarmenmedia.b-cdn.net/princesas/ChatGPT%20Image%20Jun%2012%2C%202026%2C%2002_54_19%20PM.webp',
    alt: 'Party decorations',
    caption: 'Decoración de ensueño',
  },
  {
    src: 'https://villacarmenmedia.b-cdn.net/princesas/Gemini_Generated_Image_56as8m56as8m56as.webp',
    alt: 'Party fun',
    caption: 'Diversión garantizada',
  },
  {
    src: 'https://villacarmenmedia.b-cdn.net/princesas/blancanieves.webp',
    alt: 'Princess celebration',
    caption: 'Celebración de cuento',
  },
];

// =============================================================================
// PLACEHOLDER & FALLBACK IMAGES
// =============================================================================

/**
 * Fallback images used when primary images fail to load.
 */
export const FALLBACK_IMAGES = {
  /** Default placeholder for missing images */
  placeholder: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=60',
  /** Avatar placeholder for user profiles */
  avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80',
  /** Error state image */
  error: 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=400&q=60',
};

// =============================================================================
// LOGO & BRANDING
// =============================================================================

/**
 * Logo and branding assets.
 * TODO: Replace with actual brand assets when available.
 */
export const BRANDING = {
  /** Main logo (light version for dark backgrounds) */
  logoLight: '/logo-light.svg',
  /** Main logo (dark version for light backgrounds) */
  logoDark: '/logo-dark.svg',
  /** Favicon */
  favicon: '/favicon.ico',
  /** Open Graph image for social sharing (1200x630 recommended) */
  ogImage: '/og-image.jpg',
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Constructs a full CDN URL for an asset path.
 * In development, returns the path as-is.
 * In production, prepends the CDN base URL.
 * 
 * @param path - The asset path (e.g., '/images/hero.jpg')
 * @returns The full URL with CDN base if configured
 * 
 * @example
 * getCdnUrl('/images/hero.jpg')
 * // Development: '/images/hero.jpg'
 * // Production: 'https://cdn.example.com/images/hero.jpg'
 */
export function getCdnUrl(path: string): string {
  if (!CDN_BASE_URL) return path;
  return `${CDN_BASE_URL}${path}`;
}

/**
 * Generates an optimized image URL with specified dimensions.
 * Works with Unsplash URLs to request specific sizes.
 * 
 * @param url - The original image URL
 * @param width - Desired width in pixels
 * @param quality - Image quality (1-100), defaults to DEFAULT_QUALITY
 * @returns Optimized image URL
 * 
 * @example
 * getOptimizedUrl('https://images.unsplash.com/photo-123', 800, 75)
 * // Returns: 'https://images.unsplash.com/photo-123?w=800&q=75'
 */
export function getOptimizedUrl(
  url: string,
  width: number,
  quality: number = DEFAULT_QUALITY
): string {
  // Handle Unsplash URLs
  if (url.includes('unsplash.com')) {
    const baseUrl = url.split('?')[0];
    return `${baseUrl}?w=${width}&q=${quality}`;
  }
  return url;
}

/**
 * Preloads an array of images to improve perceived performance.
 * Useful for hero carousel images.
 * 
 * @param urls - Array of image URLs to preload
 * 
 * @example
 * preloadImages(HERO_IMAGES);
 */
export function preloadImages(urls: string[]): void {
  urls.forEach((url) => {
    const img = new Image();
    img.src = url;
  });
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

/**
 * Default export containing all image collections.
 */
export default {
  hero: HERO_IMAGES,
  hero16x9: HERO_IMAGES_16_9,
  hero9x16: HERO_IMAGES_9_16,
  gallery: GALLERY_IMAGES,
  fallback: FALLBACK_IMAGES,
  branding: BRANDING,
};
