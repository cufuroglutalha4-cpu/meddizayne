(() => {
  const MANIFEST_URL = 'assets/gallery-manifest.json';
  const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif'];
  const MAX_CONSECUTIVE_MISSES = 3;
  let manifestPromise = null;

  function getManifest() {
    if (!manifestPromise) {
      manifestPromise = fetch(MANIFEST_URL, { cache: 'no-store' })
        .then(r => {
          if (!r.ok) throw new Error('manifest');
          return r.json();
        })
        .catch(() => null);
    }
    return manifestPromise;
  }

  function imageExists(url) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  async function resolveNumberedImage(prefix, number) {
    for (const ext of EXTENSIONS) {
      const url = `${prefix}${number}.${ext}`;
      const found = await imageExists(url);
      if (found) return found;
    }
    return null;
  }

  function createGalleryItem({ thumb, full, alt, number }) {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', `${alt} ${number} — büyüt`);

    const img = document.createElement('img');
    img.src = thumb;
    img.dataset.full = full;
    img.alt = `${alt} ${number}`;
    img.decoding = 'async';
    img.fetchPriority = 'low';

    img.addEventListener('error', () => {
      if (img.dataset.fallbackDone === '1') return;
      img.dataset.fallbackDone = '1';
      img.src = full;
    });

    item.appendChild(img);
    return item;
  }

  async function loadFromManifest(gallery, manifest) {
    const key = gallery.dataset.galleryKey;
    if (!key || !manifest || !Array.isArray(manifest[key])) return false;

    const alt = gallery.dataset.alt || 'Galeri görseli';
    const limit = parseInt(gallery.dataset.limit || '', 10);
    const entries = Number.isFinite(limit) && limit > 0
      ? manifest[key].slice(0, limit)
      : manifest[key];

    if (!entries.length) return false;

    const fragment = document.createDocumentFragment();
    entries.forEach((entry, i) => {
      fragment.appendChild(createGalleryItem({
        thumb: entry.thumb,
        full: entry.full,
        alt,
        number: entry.number ?? (i + 1)
      }));
    });

    gallery.replaceChildren(fragment);
    return true;
  }

  async function loadFallback(gallery) {
    const prefix = gallery.dataset.prefix;
    const alt = gallery.dataset.alt || 'Galeri görseli';
    const limit = parseInt(gallery.dataset.limit || '', 10);
    if (!prefix) return;

    let number = 1;
    let consecutiveMisses = 0;
    let loaded = 0;
    const fragment = document.createDocumentFragment();

    while (consecutiveMisses < MAX_CONSECUTIVE_MISSES) {
      if (Number.isFinite(limit) && limit > 0 && loaded >= limit) break;

      const src = await resolveNumberedImage(prefix, number);
      if (src) {
        fragment.appendChild(createGalleryItem({ thumb: src, full: src, alt, number }));
        loaded++;
        consecutiveMisses = 0;
      } else {
        consecutiveMisses++;
      }
      number++;
    }

    if (loaded) gallery.replaceChildren(fragment);
  }

  async function loadAutoGallery(gallery) {
    const manifest = await getManifest();
    const ok = await loadFromManifest(gallery, manifest);
    if (!ok) await loadFallback(gallery);
  }

  function createLightbox() {
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = `
      <button class="lightbox-close" type="button" aria-label="Galeriyi kapat">×</button>
      <button class="lightbox-prev" type="button" aria-label="Önceki görsel">‹</button>
      <img class="lightbox-image" alt="">
      <button class="lightbox-next" type="button" aria-label="Sonraki görsel">›</button>
      <div class="lightbox-counter" aria-live="polite"></div>
    `;
    document.body.appendChild(box);
    return box;
  }

  function setupLightbox() {
    const box = createLightbox();
    const image = box.querySelector('.lightbox-image');
    const counter = box.querySelector('.lightbox-counter');
    const close = box.querySelector('.lightbox-close');
    const prev = box.querySelector('.lightbox-prev');
    const next = box.querySelector('.lightbox-next');

    let currentGallery = [];
    let currentIndex = 0;
    let touchStartX = null;

    function show(index) {
      if (!currentGallery.length) return;
      currentIndex = (index + currentGallery.length) % currentGallery.length;
      const target = currentGallery[currentIndex];

      // Orijinal görsel yalnızca kullanıcı lightbox'ı açınca / gezinince yüklenir.
      image.src = target.dataset.full || target.src;
      image.alt = target.alt || 'Büyük galeri görseli';
      counter.textContent = `${currentIndex + 1} / ${currentGallery.length}`;
    }

    function open(clicked) {
      const gallery = clicked.closest('.gallery-grid');
      currentGallery = gallery
        ? Array.from(gallery.querySelectorAll('.gallery-item img'))
        : [clicked];
      currentIndex = Math.max(0, currentGallery.indexOf(clicked));
      show(currentIndex);
      box.classList.add('is-open');
      box.setAttribute('aria-hidden', 'false');
      document.body.classList.add('lightbox-open');
    }

    function closeBox() {
      box.classList.remove('is-open');
      box.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('lightbox-open');
      image.removeAttribute('src');
    }

    document.addEventListener('click', event => {
      const clicked = event.target.closest('.gallery-item img');
      if (clicked) open(clicked);
    });

    document.addEventListener('keydown', event => {
      const item = event.target.closest?.('.gallery-item');
      if (item && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        const clicked = item.querySelector('img');
        if (clicked) open(clicked);
        return;
      }

      if (!box.classList.contains('is-open')) return;
      if (event.key === 'Escape') closeBox();
      if (event.key === 'ArrowLeft') show(currentIndex - 1);
      if (event.key === 'ArrowRight') show(currentIndex + 1);
    });

    close.addEventListener('click', closeBox);
    prev.addEventListener('click', () => show(currentIndex - 1));
    next.addEventListener('click', () => show(currentIndex + 1));

    box.addEventListener('click', event => {
      if (event.target === box) closeBox();
    });

    box.addEventListener('touchstart', event => {
      touchStartX = event.changedTouches[0]?.clientX ?? null;
    }, { passive: true });

    box.addEventListener('touchend', event => {
      if (touchStartX === null) return;
      const endX = event.changedTouches[0]?.clientX ?? touchStartX;
      const delta = endX - touchStartX;
      if (Math.abs(delta) > 45) {
        if (delta > 0) show(currentIndex - 1);
        else show(currentIndex + 1);
      }
      touchStartX = null;
    }, { passive: true });
  }

  async function init() {
    setupLightbox();
    const galleries = Array.from(document.querySelectorAll('.auto-gallery'));
    await Promise.all(galleries.map(loadAutoGallery));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
