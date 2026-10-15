import type { Settings } from '../state/settings';

type OptionsPanelOptions = {
  settings: Settings;
  weatherNames: string[];
  qualityNames: string[];
  onWeather: (name: string) => void;
  onQuality: (name: string) => void;
  onSound: (enabled: boolean) => void;
  onAutoWander: (enabled: boolean) => void;
  accountEmail: string;
  onSignOut: () => Promise<void>;
};

function addSelect(panel: HTMLElement, label: string, value: string, values: string[], onChange: (value: string) => void) {
  const row = document.createElement('label');
  row.className = 'option-row';
  const title = document.createElement('span');
  title.textContent = label;
  const select = document.createElement('select');
  for (const name of values) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name[0].toUpperCase() + name.slice(1);
    option.selected = name === value;
    select.append(option);
  }
  select.addEventListener('change', () => onChange(select.value));
  row.append(title, select);
  panel.append(row);
}

function addToggle(panel: HTMLElement, label: string, checked: boolean, onChange: (enabled: boolean) => void) {
  const row = document.createElement('label');
  row.className = 'option-row option-toggle';
  const title = document.createElement('span');
  title.textContent = label;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  row.append(title, input);
  panel.append(row);
}

export function createOptionsPanel(options: OptionsPanelOptions) {
  const button = document.createElement('button');
  button.className = 'hud-button options-button';
  button.type = 'button';
  button.textContent = 'Options';
  button.setAttribute('aria-expanded', 'false');

  const panel = document.createElement('section');
  panel.className = 'options-panel';
  panel.id = 'options-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Options');
  addSelect(panel, 'Weather', options.settings.weather, options.weatherNames, options.onWeather);
  addSelect(panel, 'Quality', options.settings.quality, options.qualityNames, options.onQuality);
  addToggle(panel, 'Sound', options.settings.sound, options.onSound);
  addToggle(panel, 'Auto wander', options.settings.autoWander, options.onAutoWander);
  const account = document.createElement('div');
  account.className = 'option-row account-row';
  const identity = document.createElement('span');
  identity.textContent = options.accountEmail;
  identity.title = options.accountEmail;
  const signOut = document.createElement('button');
  signOut.type = 'button';
  signOut.textContent = 'Log out';
  const accountStatus = document.createElement('span');
  accountStatus.className = 'account-status';
  accountStatus.setAttribute('role', 'status');
  signOut.addEventListener('click', () => {
    signOut.disabled = true;
    accountStatus.textContent = '';
    void options.onSignOut().catch((error: unknown) => {
      console.error('Could not sign out:', error);
      accountStatus.textContent = 'Could not log out. Try again.';
      signOut.disabled = false;
    });
  });
  account.append(identity, signOut, accountStatus);
  panel.append(account);
  button.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    button.setAttribute('aria-expanded', String(!panel.hidden));
  });

  const controlsButton = document.createElement('button');
  controlsButton.className = 'hud-button controls-button';
  controlsButton.type = 'button';
  controlsButton.textContent = 'Controls';
  controlsButton.setAttribute('aria-expanded', 'false');
  const controls = document.createElement('section');
  controls.className = 'controls-panel';
  controls.id = 'controls-panel';
  controls.hidden = true;
  controls.innerHTML = '<strong>Controls</strong><span>WASD / arrows — move</span><span>Shift — run</span><span>Space — jump</span><span>E — eat</span><span>C — sit</span><span>Mouse drag — look</span>';
  controlsButton.addEventListener('click', () => {
    controls.hidden = !controls.hidden;
    controlsButton.setAttribute('aria-expanded', String(!controls.hidden));
  });

  document.body.append(button, panel, controlsButton, controls);
  return () => {
    button.remove();
    panel.remove();
    controlsButton.remove();
    controls.remove();
  };
}
