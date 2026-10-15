import { hasFoundAllMessages, type Achievement } from '../data/achievements';
import type { Message } from '../data/messages';

export function createAchievementPanel(
  messages: Message[],
  initial: Achievement[],
  onMarkRead: (messageId: number) => Promise<void>,
  onReset: () => Promise<void>,
) {
  const button = document.createElement('button');
  button.className = 'hud-button achievement-button';
  button.type = 'button';
  button.textContent = 'Thông điệp';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'achievement-panel');

  const panel = document.createElement('section');
  panel.className = 'achievement-panel';
  panel.id = 'achievement-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Thông điệp đã tìm thấy');

  let achievements = [...initial];
  let panelOpened = false;
  let disposed = false;
  let resetting = false;
  let openMessageId: number | null = null;
  const pendingReads = new Set<number>();
  const messageById = new Map(messages.map((message) => [message.id, message]));

  function render() {
    panel.replaceChildren();
    const found = achievements.length;
    const heading = document.createElement('h2');
    heading.textContent = `Thông điệp đã tìm thấy ${found} / ${messages.length}`;
    const progress = document.createElement('div');
    progress.className = 'achievement-progress';
    progress.setAttribute('role', 'progressbar');
    progress.setAttribute('aria-valuemin', '0');
    progress.setAttribute('aria-valuemax', String(messages.length));
    progress.setAttribute('aria-valuenow', String(found));
    const progressFill = document.createElement('span');
    progressFill.style.width = `${messages.length ? found / messages.length * 100 : 0}%`;
    progress.append(progressFill);
    panel.append(heading, progress);

    const remaining = document.createElement('p');
    remaining.className = 'achievement-remaining';
    remaining.textContent = messages.length > found ? `Còn ${messages.length - found} thông điệp chưa được tìm thấy.` : '';
    panel.append(remaining);

    const list = document.createElement('ol');
    list.className = 'achievement-list';
    achievements.forEach((achievement, index) => {
      const message = messageById.get(achievement.messageId);
      if (!message) return;
      const row = document.createElement('li');
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'achievement-row';
      const number = document.createElement('span');
      number.className = 'achievement-number';
      number.textContent = String(index + 1);
      const summary = document.createElement('span');
      summary.className = 'achievement-summary';
      summary.textContent = message.text.split('\n')[0];
      const date = document.createElement('time');
      date.dateTime = achievement.discoveredAt;
      date.textContent = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(achievement.discoveredAt));
      open.append(number, summary, date);
      if (!achievement.readAt) {
        const dot = document.createElement('span');
        dot.className = 'achievement-new-dot';
        dot.setAttribute('aria-label', 'Mới');
        open.append(dot);
      }
      open.addEventListener('click', () => {
        openMessageId = achievement.messageId;
        render();
        if (!achievement.readAt && !pendingReads.has(achievement.messageId)) {
          pendingReads.add(achievement.messageId);
          void onMarkRead(achievement.messageId).then(() => {
            if (disposed) return;
            achievements = achievements.map((item) => item.messageId === achievement.messageId
              ? { ...item, readAt: new Date().toISOString() }
              : item);
            render();
          }).catch((error: unknown) => {
            console.error('Could not mark message as read:', error);
            status.textContent = 'Không thể đồng bộ trạng thái đã đọc. Hãy mở lại thông điệp để thử lại.';
          }).finally(() => pendingReads.delete(achievement.messageId));
        }
      });
      row.append(open);
      list.append(row);
      if (openMessageId === achievement.messageId) {
        const fullText = document.createElement('p');
        fullText.className = 'achievement-full-text';
        fullText.textContent = message.text;
        row.append(fullText);
      }
    });
    panel.append(list);
    if (hasFoundAllMessages(messages, achievements)) {
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'achievement-reset';
      reset.textContent = resetting ? 'Đang đặt lại…' : 'Reset thông điệp';
      reset.disabled = resetting;
      reset.addEventListener('click', async () => {
        if (resetting || !window.confirm('Xóa toàn bộ tiến độ thông điệp của tài khoản này?')) return;
        resetting = true;
        status.textContent = 'Đang đặt lại tiến độ…';
        render();
        try {
          await onReset();
          if (disposed) return;
          achievements = [];
          openMessageId = null;
          status.textContent = '';
        } catch (error) {
          console.error('Could not reset message discoveries:', error);
          status.textContent = (error as { code?: string })?.code === 'PGRST202'
            ? 'Thiếu chức năng đặt lại trong Supabase. Hãy chạy SUPABASE-RESET-ACHIEVEMENTS.sql trong SQL Editor.'
            : 'Không thể đặt lại tiến độ. Hãy kiểm tra kết nối rồi thử lại.';
        } finally {
          resetting = false;
          if (!disposed) render();
        }
      });
      panel.append(reset);
    }
    panel.append(status);
    const hasUnread = achievements.some((achievement) => !achievement.readAt);
    button.classList.toggle('has-new', hasUnread && !panelOpened);
  }

  const status = document.createElement('p');
  status.className = 'achievement-status';
  status.setAttribute('role', 'status');

  function setOpen(open: boolean) {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) {
      panelOpened = true;
      status.textContent = '';
      render();
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'j' || event.key === 'J') {
      if ((event.target as HTMLElement).closest('input, textarea, select, button')) return;
      setOpen(panel.hidden);
    } else if (event.key === 'Escape' && !panel.hidden) {
      setOpen(false);
    }
  };
  button.addEventListener('click', () => setOpen(panel.hidden));
  document.addEventListener('keydown', onKeyDown);
  document.body.append(button, panel);
  render();

  return {
    setAchievements(items: Achievement[]) {
      achievements = [...items];
      render();
    },
    destroy() {
      disposed = true;
      document.removeEventListener('keydown', onKeyDown);
      button.remove();
      panel.remove();
    },
  };
}
