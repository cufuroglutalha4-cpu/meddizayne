from pathlib import Path
from PIL import Image, ImageOps
import json
import re

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
THUMBS = ASSETS / 'thumbs'
MANIFEST = ASSETS / 'gallery-manifest.json'

PATTERNS = {
    'italyanboya': re.compile(r'^italyanboya(\d+)\.(jpg|jpeg|png|webp|avif)$', re.I),
    'satinart': re.compile(r'^satinart(\d+)\.(jpg|jpeg|png|webp|avif)$', re.I),
}

THUMB_MAX = (720, 720)
WEBP_QUALITY = 82
THUMBS.mkdir(parents=True, exist_ok=True)
manifest = {key: [] for key in PATTERNS}
wanted = set()

for key, pattern in PATTERNS.items():
    found = []
    for path in ASSETS.iterdir():
        if not path.is_file():
            continue
        m = pattern.match(path.name)
        if m:
            found.append((int(m.group(1)), path))
    found.sort(key=lambda x: x[0])

    for number, source in found:
        thumb = THUMBS / f'{source.stem}.webp'
        wanted.add(thumb.resolve())
        if not thumb.exists() or thumb.stat().st_mtime < source.stat().st_mtime:
            with Image.open(source) as image:
                image = ImageOps.exif_transpose(image).convert('RGB')
                image.thumbnail(THUMB_MAX, Image.Resampling.LANCZOS)
                image.save(thumb, 'WEBP', quality=WEBP_QUALITY, method=6)

        manifest[key].append({
            'number': number,
            'thumb': f'assets/thumbs/{thumb.name}',
            'full': f'assets/{source.name}',
        })

for thumb in THUMBS.glob('*.webp'):
    lower = thumb.name.lower()
    if (lower.startswith('italyanboya') or lower.startswith('satinart')) and thumb.resolve() not in wanted:
        thumb.unlink()

MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f"Üç Boyutlu Sıva: {len(manifest['italyanboya'])}")
print(f"Kadife Boya: {len(manifest['satinart'])}")
