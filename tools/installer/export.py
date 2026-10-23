"""Render the composed SVG to a 3x, 24-bit NSIS bitmap (Inkscape + Pillow)."""
import argparse
from pathlib import Path
import subprocess
import tempfile
from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('destination', type=Path)
args = parser.parse_args()
source = Path(__file__).resolve().parents[2] / 'resources/brand/installer-sidebar.svg'
args.destination.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='mytracer-installer-art-') as temporary:
    png = Path(temporary) / 'sidebar.png'
    subprocess.run(['inkscape', str(source), f'--export-filename={png}',
                    '--export-width=492', '--export-height=942'], check=True)
    with Image.open(png) as image:
        image.convert('RGB').save(args.destination / 'installer-sidebar.bmp')
