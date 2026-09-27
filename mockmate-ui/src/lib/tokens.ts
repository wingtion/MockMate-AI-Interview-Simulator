// Read design tokens (CSS custom properties from index.css) for code that can't
// use CSS directly: canvas drawing and the Monaco theme. Keeps colors in one place.
export function cssToken(name: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}
