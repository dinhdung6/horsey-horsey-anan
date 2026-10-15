import type { AuthMode } from '../auth/auth';

type LoginOptions = {
  onSubmit: (mode: AuthMode, email: string, password: string) => Promise<string>;
};

export function createLoginScreen(options: LoginOptions) {
  const panel = document.createElement('main');
  panel.className = 'login-screen';
  panel.setAttribute('aria-labelledby', 'login-title');
  panel.innerHTML = `
    <form class="login-card">
      <h1 id="login-title">Horse Simulator</h1>
      <p class="login-description">Sign in to explore your saved world and messages.</p>
      <label>Email<input name="email" type="email" autocomplete="email" required></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
      <p class="login-status" role="status" aria-live="polite"></p>
      <button class="login-submit" type="submit">Sign in</button>
      <button class="login-mode" type="button">Create account</button>
    </form>`;
  document.body.append(panel);

  const form = panel.querySelector('form')!;
  const email = panel.querySelector<HTMLInputElement>('[name="email"]')!;
  const password = panel.querySelector<HTMLInputElement>('[name="password"]')!;
  const status = panel.querySelector<HTMLElement>('.login-status')!;
  const submit = panel.querySelector<HTMLButtonElement>('.login-submit')!;
  const modeButton = panel.querySelector<HTMLButtonElement>('.login-mode')!;
  let mode: AuthMode = 'sign-in';

  function setStatus(message: string, isError = false) {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    modeButton.disabled = true;
    setStatus(mode === 'sign-up' ? 'Creating account…' : 'Signing in…');
    try {
      const message = await options.onSubmit(mode, email.value.trim(), password.value);
      password.value = '';
      setStatus(message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Authentication failed. Try again.', true);
    } finally {
      submit.disabled = false;
      modeButton.disabled = false;
    }
  });

  modeButton.addEventListener('click', () => {
    mode = mode === 'sign-in' ? 'sign-up' : 'sign-in';
    submit.textContent = mode === 'sign-up' ? 'Create account' : 'Sign in';
    modeButton.textContent = mode === 'sign-up' ? 'Already have an account? Sign in' : 'Create account';
    password.autocomplete = mode === 'sign-up' ? 'new-password' : 'current-password';
    setStatus('');
  });

  return {
    show(message = '') {
      panel.hidden = false;
      setStatus(message);
    },
    hide() { panel.hidden = true; },
    setStatus,
    destroy() { panel.remove(); },
  };
}
