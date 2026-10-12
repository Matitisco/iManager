"""Regenerate checked-in assets with Pillow from proposal 3 PNGs.

python3 scripts/generate-pwa-assets.py /workspace/imanager-logo/propuesta-3/png
The default source is the checked-in 512px icon. No runtime dependency is added.
"""
from pathlib import Path
import re
import sys
from PIL import Image

source = Path(sys.argv[1]) / 'isotipo-512.png' if len(sys.argv) > 1 else Path('public/icons/icon-512.png')
logo = Image.open(source).convert('RGBA')
phones = [(320, 568, 2), (375, 667, 2), (414, 736, 3), (375, 812, 3),
          (390, 844, 3), (393, 852, 3), (402, 874, 3), (414, 896, 2),
          (414, 896, 3), (420, 912, 3), (428, 926, 3), (430, 932, 3), (440, 956, 3)]
Path('public/icons').mkdir(exist_ok=True)
Path('public/splash').mkdir(exist_ok=True)

def render(width, height, icon_size, background, dest):
    canvas = Image.new('RGB', (width, height), background)
    resized = logo.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    canvas.paste(resized, ((width - icon_size) // 2, (height - icon_size) // 2), resized)
    canvas.save(dest, optimize=True)

for size in [16, 32, 48, 72, 96, 120, 144, 152, 167, 180, 192, 256, 384, 512]:
    render(size, size, size, '#FFD000', f'public/icons/icon-{size}.png')
for size in [192, 512]:
    render(size, size, round(size * .72), '#FFD000', f'public/icons/icon-maskable-{size}.png')
render(180, 180, 180, '#FFD000', 'public/apple-touch-icon.png')
for size in [16, 32]:
    render(size, size, size, '#FFD000', f'public/favicon-{size}x{size}.png')

links = []
for width, height, scale in phones:
    for orientation in ['portrait', 'landscape']:
        w, h = (width, height) if orientation == 'portrait' else (height, width)
        w, h = w * scale, h * scale
        name = f'splash-{w}x{h}.png'
        render(w, h, 96 * scale, '#F7F8FA', f'public/splash/{name}')
        links.append(f'    <link rel="apple-touch-startup-image" href="/splash/{name}" media="screen and (device-width: {width}px) and (device-height: {height}px) and (-webkit-device-pixel-ratio: {scale}) and (orientation: {orientation})" />')
html = Path('index.html')
html.write_text(re.sub(r'    <!-- PWA splash images -->[\s\S]*?    <!-- End PWA splash images -->',
                      '    <!-- PWA splash images -->\n' + '\n'.join(links) + '\n    <!-- End PWA splash images -->', html.read_text()))
print('Proposal 3 icons and iPhone launch images generated.')
