'use strict';

(() => {
  const picker = document.getElementById('display-mode');
  let preference;
  try { preference = localStorage.getItem('ml-lab-display'); } catch {}
  picker.value = ['light','dark'].includes(preference) ? preference : 'system';
  const system = matchMedia('(prefers-color-scheme: dark)');
  function apply() {
    document.documentElement.dataset.theme = picker.value === 'system' ? (system.matches ? 'dark' : 'light') : picker.value;
  }
  picker.addEventListener('change',() => {
    apply();
    try { localStorage.setItem('ml-lab-display',picker.value); } catch {}
  });
  system.addEventListener('change',apply);
  apply();
})();
