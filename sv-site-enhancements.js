/* Progressive enhancements: screenshot view switcher and live catalog count. */
(() => {
  for (const group of document.querySelectorAll('[data-sv-switcher]')) {
    const image = group.querySelector('[data-sv-preview]');
    const caption = group.querySelector('[data-sv-caption]');
    group.querySelectorAll('button[data-sv-image]').forEach(button => {
      button.addEventListener('click', () => {
        const source = button.dataset.svImage;
        if (!source || !source.startsWith('assets/sv-new/')) return;
        image.src = source;
        image.alt = button.dataset.svAlt || image.alt;
        if (caption) caption.textContent = button.dataset.svDescription || '';
        group.querySelectorAll('button[data-sv-image]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
      });
    });
  }
  const count = document.querySelector('[data-sv-catalog-count]');
  if (count) {
    fetch('catalog/kits_latest.json', {cache: 'no-store'})
      .then(res => { if (!res.ok) throw Error('Not available'); return res.json(); })
      .then(data => {
        const direct = Array.isArray(data) ? data : [data?.kits, data?.entries, data?.models, data?.items, data?.data?.kits].find(Array.isArray);
        const n = direct?.length;
        if (n > 0) count.textContent = new Intl.NumberFormat('en-US').format(n) + ' kits';
      }).catch(() => {});
  }
})();
