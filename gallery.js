(() => {
  const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
  const MAX_CONSECUTIVE_MISSES = 3;

  function imageExists(url) {
    return new Promise((resolve) => {
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

  function createGalleryItem(src, alt, number) {
    const item = document.createElement('div');
    item.className = 'gallery-item';

    const img = document.createElement('img');
    img.src = src;
    img.alt = `${alt} ${number}`;
    img.loading = 'lazy';
    img.decoding = 'async';

    item.appendChild(img);
    return item;
  }

  async function loadAutoGallery(gallery) {
    const prefix = gallery.dataset.prefix;
    const alt = gallery.dataset.alt || 'Galeri görseli';
    if (!prefix) return;

    let number = 1;
    let consecutiveMisses = 0;

    while (consecutiveMisses < MAX_CONSECUTIVE_MISSES) {
      const src = await resolveNumberedImage(prefix, number);
      if (src) {
        gallery.appendChild(createGalleryItem(src, alt, number));
        consecutiveMisses = 0;
      } else {
        consecutiveMisses += 1;
      }
      number += 1;
    }
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
      image.src = target.src;
      image.alt = target.alt || 'Büyük galeri görseli';
      counter.textContent = `${currentIndex + 1} / ${currentGallery.length}`;
    }

    function open(clicked) {
      const gallery = clicked.closest('.gallery-grid');
      currentGallery = gallery ? Array.from(gallery.querySelectorAll('.gallery-item img')) : [clicked];
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
      image.src = '';
    }

    document.addEventListener('click', (event) => {
      const clicked = event.target.closest('.gallery-item img');
      if (clicked) open(clicked);
    });

    close.addEventListener('click', closeBox);
    prev.addEventListener('click', () => show(currentIndex - 1));
    next.addEventListener('click', () => show(currentIndex + 1));

    box.addEventListener('click', (event) => {
      if (event.target === box) closeBox();
    });

    document.addEventListener('keydown', (event) => {
      if (!box.classList.contains('is-open')) return;
      if (event.key === 'Escape') closeBox();
      if (event.key === 'ArrowLeft') show(currentIndex - 1);
      if (event.key === 'ArrowRight') show(currentIndex + 1);
    });

    box.addEventListener('touchstart', (event) => {
      touchStartX = event.changedTouches[0]?.clientX ?? null;
    }, { passive: true });

    box.addEventListener('touchend', (event) => {
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
