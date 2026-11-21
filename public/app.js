export function initializePage() {
  const controller = new AbortController();
  const { signal } = controller;
  const timers = new Set();
  const on = (element, event, handler) => element?.addEventListener(event, handler, { signal });
  const navToggle = document.querySelector('.nav-toggle');
  on(navToggle, 'click', () => {
    const open = document.body.classList.toggle('nav-open');
    navToggle.setAttribute('aria-expanded', String(open));
  });

  document.querySelectorAll('[data-open-dialog]').forEach((button) => on(button, 'click', () => {
    const dialog = document.getElementById(button.dataset.openDialog);
    if (dialog instanceof HTMLDialogElement) dialog.showModal();
  }));
  document.querySelectorAll('dialog[data-open-on-load]').forEach((dialog) => dialog.showModal());
  document.querySelectorAll('[data-close-dialog]').forEach((button) => on(button, 'click', () => button.closest('dialog')?.close()));
  document.querySelectorAll('dialog').forEach((dialog) => on(dialog, 'click', (event) => {
    if (event.target !== dialog || dialog.id === 'created-key-dialog') return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }));
  document.querySelectorAll('form[data-confirm]').forEach((form) => on(form, 'submit', (event) => {
    if (!window.confirm(form.dataset.confirm)) event.preventDefault();
  }));

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  document.querySelectorAll('.js-copy').forEach((button) => on(button, 'click', async () => {
    const target = button.dataset.copyTarget ? document.getElementById(button.dataset.copyTarget) : null;
    const text = button.dataset.copyText ?? target?.textContent ?? '';
    try {
      await copyText(text.trim());
      const original = button.innerHTML;
      button.innerHTML = '<span class="copy-success">Copied</span>';
      button.setAttribute('aria-label', 'Copied');
      const timer = setTimeout(() => {
        button.innerHTML = original;
        timers.delete(timer);
      }, 1600);
      timers.add(timer);
    } catch {
      button.textContent = 'Copy failed';
    }
  }));

  return () => {
    controller.abort();
    timers.forEach(clearTimeout);
  };
}
