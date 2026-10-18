/**
 * Jednostavan registrator servisnog radnika. Namjerno ne koristimo plugin:
 * jedan fajl, bez zavisnosti, i radi isto na Vercelu.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return; // u razvoju SW bi keširao stare fajlove

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline keš nije kritičan; aplikacija normalno radi i bez njega.
    });
  });
}
