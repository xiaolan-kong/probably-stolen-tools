// Apply before the stylesheet so a saved dark preference does not flash white.
(() => {
  const key = 'ps-tools-theme';
  const valid = value => ['system', 'light', 'dark'].includes(value);
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let choice = 'system';
  try { const saved = localStorage.getItem(key); if (valid(saved)) choice = saved; } catch {}
  function apply() {
    document.documentElement.dataset.theme = choice === 'system' ? (system.matches ? 'dark' : 'light') : choice;
    document.documentElement.dataset.themeChoice = choice;
    const button = document.getElementById('theme');
    if (button) {
      const label = document.documentElement.dataset.theme === 'dark' ? '切换浅色模式' : '切换深色模式';
      button.setAttribute('aria-label', label); button.title = label;
    }
  }
  apply();
  system.addEventListener('change', apply);
  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('theme');
    apply();
    button?.addEventListener('click', () => {
      choice = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      apply();
      const feedback = document.getElementById('theme-feedback');
      try { localStorage.setItem(key, choice); feedback.hidden = true; }
      catch { feedback.textContent = '浏览器禁止保存设置，本次切换仍然有效。'; feedback.hidden = false; }
    });
    window.addEventListener('storage', event => {
      if (event.key !== key && event.key !== null) return;
      choice = valid(event.newValue) ? event.newValue : 'system';
      apply();
    });
  });
})();
