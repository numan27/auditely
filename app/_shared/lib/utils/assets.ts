// Asset helper functions

/**
 * Get image URL with proper path handling
 */
export const getImageUrl = (path: string): string => {
  if (path.startsWith('http')) return path;
  return `/images/${path}`;
};

/**
 * Get icon URL
 */
export const getIconUrl = (name: string): string => {
  return `/icons/${name}.svg`;
};

/**
 * Get font URL
 */
export const getFontUrl = (name: string, format: string = 'woff2'): string => {
  return `/fonts/${name}.${format}`;
};

/**
 * Generate placeholder image with specified dimensions
 */
export const getPlaceholderImage = (width: number, height: number, text?: string): string => {
  const label = text || `${width}x${height}`;
  return `https://placehold.co/${width}x${height}/3b82f6/ffffff?text=${encodeURIComponent(label)}`;
};

/**
 * Optimize image URL (for external image CDNs)
 */
export const optimizeImage = (url: string, width?: number, height?: number, quality = 80): string => {
  // This is a placeholder implementation
  // Replace with your actual image optimization service
  const params = new URLSearchParams();
  if (width) params.append('w', width.toString());
  if (height) params.append('h', height.toString());
  params.append('q', quality.toString());

  return `${url}?${params.toString()}`;
};
