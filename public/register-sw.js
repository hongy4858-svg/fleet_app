// Register on HTTPS deployments only.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('PWA service worker registration failed:', error);
    });
  });
}