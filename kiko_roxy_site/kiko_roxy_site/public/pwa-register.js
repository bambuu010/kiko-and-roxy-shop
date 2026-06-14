if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Local browsers can block service workers on some file or privacy settings.
    });
  });
}
