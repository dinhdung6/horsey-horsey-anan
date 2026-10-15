type Toast = { title: string; detail: string; text?: string; gentle?: boolean };

export function createAchievementToast() {
  const root = document.createElement('div');
  root.className = 'achievement-toast';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  document.body.append(root);
  const queue: Toast[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  function showNext() {
    const toast = queue.shift();
    if (!toast) {
      root.classList.remove('is-visible');
      timer = null;
      return;
    }
    root.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = toast.title;
    const detail = document.createElement('span');
    detail.textContent = toast.detail;
    root.append(title, detail);
    if (toast.text) {
      const message = document.createElement('span');
      message.textContent = toast.text;
      root.append(message);
    }
    root.classList.toggle('is-gentle', !!toast.gentle);
    root.classList.add('is-visible');
    timer = setTimeout(() => {
      root.classList.remove('is-visible');
      timer = setTimeout(showNext, 300);
    }, 4000);
  }

  function enqueue(toast: Toast) {
    queue.push(toast);
    if (!timer) showNext();
  }

  return {
    discovery(count: number, total: number, text: string) {
      const excerpt = text.length > 60 ? `${text.slice(0, 60)}…` : text;
      enqueue({ title: 'Đã tìm thấy một thông điệp', detail: `${count} / ${total}`, text: excerpt });
      if (total > 0 && count === total) {
        enqueue({ title: 'Bạn đã tìm thấy tất cả thông điệp.', detail: '', gentle: true });
      }
    },
    error() {
      enqueue({ title: 'Chưa lưu được thông điệp', detail: 'Hãy rời khỏi ô này rồi quay lại để thử lưu lại.' });
    },
    destroy() {
      if (timer) clearTimeout(timer);
      root.remove();
    },
  };
}
