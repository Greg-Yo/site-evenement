export function mountLightbox(root: ParentNode = document): void {
  const dlg = root.querySelector<HTMLDialogElement>('dialog#lightbox');
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[data-lightbox]'));
  if (!dlg || links.length === 0) return;
  const img = dlg.querySelector('img')!;
  const cap = dlg.querySelector('figcaption')!;
  let i = 0;

  const show = (n: number) => {
    i = (n + links.length) % links.length;
    img.src = links[i].href;
    img.alt = links[i].dataset.caption ?? '';
    cap.textContent = links[i].dataset.caption ?? '';
    cap.hidden = !links[i].dataset.caption;
  };

  links.forEach((a, n) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      show(n);
      dlg.showModal();
    }),
  );
  dlg.querySelector('[data-prev]')!.addEventListener('click', () => show(i - 1));
  dlg.querySelector('[data-next]')!.addEventListener('click', () => show(i + 1));
  dlg.querySelector('[data-close]')!.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') show(i + 1);
    if (e.key === 'ArrowLeft') show(i - 1);
  });
  dlg.addEventListener('close', () => links[i].focus());
}
