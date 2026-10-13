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

export function mountCountdowns(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-countdown]').forEach((el) => {
    const target = Date.parse(el.dataset.countdown!);
    const tick = () => {
      const r = remaining(Date.now(), target);
      if (r.passe) {
        el.querySelector('.cd-cases')?.setAttribute('hidden', '');
        el.querySelector('.cd-passe')?.removeAttribute('hidden');
        return false;
      }
      for (const k of ['jours', 'heures', 'minutes', 'secondes'] as const) {
        const span = el.querySelector(`[data-unit="${k}"]`);
        if (span) span.textContent = String(r[k]).padStart(k === 'jours' ? 1 : 2, '0');
      }
      return true;
    };
    if (tick()) {
      const id = setInterval(() => { if (!tick()) clearInterval(id); }, 1000);
    }
  });
}
