import {
  settings,
  parseList,
  formatList,
  DEFAULT_SETTINGS,
} from '@/lib/settings';

const form = document.querySelector<HTMLFormElement>('#settings')!;
const hiddenTags = document.querySelector<HTMLTextAreaElement>('#hiddenTags')!;
const muteWords = document.querySelector<HTMLTextAreaElement>('#muteWords')!;
const muteWholeThread = document.querySelector<HTMLInputElement>('#muteWholeThread')!;
const status = document.querySelector<HTMLElement>('#status')!;
const reset = document.querySelector<HTMLButtonElement>('#reset')!;

async function load(): Promise<void> {
  const current = await settings.getValue();
  hiddenTags.value = formatList(current.hiddenTags);
  muteWords.value = formatList(current.muteWords);
  muteWholeThread.checked = current.muteWholeThread;
}

let flashTimer: ReturnType<typeof setTimeout> | undefined;
function flashSaved(): void {
  status.classList.add('visible');
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => status.classList.remove('visible'), 1200);
}

async function save(): Promise<void> {
  await settings.setValue({
    hiddenTags: parseList(hiddenTags.value),
    muteWords: parseList(muteWords.value),
    muteWholeThread: muteWholeThread.checked,
  });
  flashSaved();
}

form.addEventListener('input', () => void save());
reset.addEventListener('click', async () => {
  await settings.setValue(DEFAULT_SETTINGS);
  await load();
  flashSaved();
});

await load();
