/** Améliore le formulaire : masque la partie « je viens » si besoin, gère l'ajout et le retrait d'accompagnants. */
export function monterFormulaire(root: ParentNode = document): void {
  const form = root.querySelector<HTMLFormElement>('form.rsvp');
  if (!form) return;
  const siVient = form.querySelector<HTMLElement>('.si-vient')!;
  const liste = form.querySelector<HTMLUListElement>('.accompagnants')!;
  const ajouter = form.querySelector<HTMLButtonElement>('.ajouter')!;

  const majPresence = () => {
    const non = form.querySelector<HTMLInputElement>('input[name=vient][value=non]')!.checked;
    siVient.hidden = non;
  };
  form.querySelectorAll('input[name=vient]').forEach((r) => r.addEventListener('change', majPresence));
  majPresence();

  // Avec JS : on ne garde visibles que les lignes remplies (au moins une), et on montre les boutons.
  const lignes = () => Array.from(liste.querySelectorAll('li'));
  const renumeroter = () => lignes().filter((li) => !li.hidden).forEach((li, i) => {
    const input = li.querySelector('input')!;
    const label = li.querySelector('label')!;
    const base = label.textContent!.replace(/\s*\d+$/, '');
    label.textContent = `${base} ${i + 1}`;
    input.placeholder = `${base} ${i + 1}`;
  });
  lignes().forEach((li, i) => {
    const input = li.querySelector('input')!;
    li.hidden = !input.value && i > 0;
    li.querySelector<HTMLButtonElement>('.retirer')!.hidden = false;
    li.querySelector<HTMLButtonElement>('.retirer')!.addEventListener('click', () => {
      input.value = '';
      if (lignes().filter((l) => !l.hidden).length > 1) li.hidden = true;
      renumeroter();
    });
  });
  if (lignes().every((li) => li.querySelector('input')!.value === '')) lignes()[0].hidden = true;
  ajouter.hidden = false;
  ajouter.addEventListener('click', () => {
    const visibles = lignes().filter((l) => !l.hidden);
    if (visibles.length >= 10) return;
    let cachee = lignes().find((l) => l.hidden);
    if (!cachee) {
      cachee = lignes()[0].cloneNode(true) as HTMLLIElement;
      const n = lignes().length + 1;
      cachee.querySelector('input')!.id = `acc-${n}`;
      cachee.querySelector('label')!.htmlFor = `acc-${n}`;
      cachee.querySelector('input')!.value = '';
      cachee.querySelector('.retirer')!.addEventListener('click', () => { cachee!.querySelector('input')!.value = ''; cachee!.hidden = true; renumeroter(); });
      liste.append(cachee);
    }
    cachee.hidden = false;
    renumeroter();
    cachee.querySelector('input')!.focus();
  });
  renumeroter();
}
