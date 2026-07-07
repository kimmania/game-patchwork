export function showModal(title: string, html: string, buttons: { label: string; primary?: boolean; action?: () => void }[] = []): () => void {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return () => {};
  overlay.innerHTML = `
    <div class="modal-inner" role="dialog" aria-modal="true">
      <h2>${escapeHtml(title)}</h2>
      <div class="modal-body">${html}</div>
      <div class="modal-actions">
        ${buttons.map((b) => `<button class="${b.primary ? 'primary' : ''}">${escapeHtml(b.label)}</button>`).join('')}
      </div>
    </div>
  `;
  overlay.classList.remove('hidden');

  const btns = overlay.querySelectorAll('button');
  btns.forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      hide();
      buttons[idx]?.action?.();
    });
  });

  const hide = () => {
    overlay.classList.add('hidden');
    overlay.innerHTML = '';
  };

  return hide;
}

export function hideModal(): void {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.innerHTML = '';
  }
}

export function showToast(message: string, duration = 2000): void {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  overlay.appendChild(toast);
  overlay.classList.remove('hidden');
  setTimeout(() => {
    toast.remove();
    if (!overlay.innerHTML.trim()) overlay.classList.add('hidden');
  }, duration);
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}
