// Applies the saved theme before first paint, so dark mode never flashes white.
// A file rather than an inline script so the Content-Security-Policy can forbid inline scripts.
try {
  const saved = localStorage.getItem('cos_theme');
  const dark = saved === 'dark' || ((!saved || saved === 'system') && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
} catch {}
