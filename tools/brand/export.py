"""Export the approved SVG with Inkscape; assemble native PNG ICO frames."""
import argparse
from pathlib import Path
import struct
import subprocess
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('destination', type=Path, help='Output directory (use a temporary directory to compare exports)')
args = parser.parse_args()
master = Path(__file__).resolve().parents[2] / 'resources/brand/MyTracer-app-icon.svg'
args.destination.mkdir(parents=True, exist_ok=True)
sizes = (16, 24, 32, 48, 64, 128, 256)
frames = []
with tempfile.TemporaryDirectory(prefix='mytracer-brand-') as temporary:
    for size in sizes:
        target = Path(temporary) / f'{size}.png'
        subprocess.run(['inkscape', str(master), f'--export-filename={target}',
                        f'--export-width={size}', f'--export-height={size}'], check=True)
        frames.append(target.read_bytes())
(args.destination / 'MyTracer-app-icon-256.png').write_bytes(frames[-1])
offset = 6 + 16 * len(sizes)
entries = []
for size, frame in zip(sizes, frames):
    entries.append(struct.pack('<BBBBHHII', size % 256, size % 256, 0, 0, 1, 32, len(frame), offset))
    offset += len(frame)
(args.destination / 'MyTracer.ico').write_bytes(struct.pack('<HHH', 0, 1, len(sizes)) + b''.join(entries) + b''.join(frames))
