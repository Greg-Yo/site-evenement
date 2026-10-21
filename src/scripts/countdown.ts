export function remaining(nowMs: number, targetMs: number) {
  const diff = Math.floor((targetMs - nowMs) / 1000);
  if (diff <= 0) return { jours: 0, heures: 0, minutes: 0, secondes: 0, passe: true };
  return {
    jours: Math.floor(diff / 86400),
    heures: Math.floor((diff % 86400) / 3600),
    minutes: Math.floor((diff % 3600) / 60),
    secondes: diff % 60,
    passe: false,
  };
}

export function afficher(el: HTMLElement, r: ReturnType<typeof remaining>): void {
  el.querySelector('.cd-cases')?.toggleAttribute('hidden', r.passe);
  el.querySelector('.cd-passe')?.toggleAttribute('hidden', !r.passe);
  if (r.passe) return;
  for (const k of ['jours', 'heures', 'minutes', 'secondes'] as const) {
    const span = el.querySelector(`[data-unit="${k}"]`);
    if (span) span.textContent = String(r[k]).padStart(k === 'jours' ? 1 : 2, '0');
  }
}

export function mountCountdowns(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-countdown]').forEach((el) => {
    const target = Date.parse(el.dataset.countdown!);
    const tick = () => {
      const r = remaining(Date.now(), target);
      afficher(el, r);
      return !r.passe;
    };
    if (tick()) {
      const id = setInterval(() => { if (!tick()) clearInterval(id); }, 1000);
    }
  });
}
