#!/usr/bin/env bash
# Private browser dependencies for the Debian 13 validation environment.
set -eu
python3 - <<'PY'
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib
import os
import shutil
import subprocess

root = Path('/tmp/451-webkit-deps/root')
archives = Path('/tmp/451-webkit-deps/https')
archives.mkdir(parents=True, exist_ok=True)
packages = '''libgtk-4-1 libgraphene-1.0-0 libgstreamer-gl1.0-0
libgstreamer-plugins-bad1.0-0 libavif16 libmanette-0.2-0 libenchant-2-2
libsecret-1-0 libwoff1 libgles2 libharfbuzz-subset0 libcairo-script-interpreter2
libhidapi-hidraw0 libevdev2 libegl1 libyuv0 libgav1-1 libglvnd0
libxcb-xfixes0 libegl-mesa0 libgbm1 mesa-libgallium'''.split()

def download(package):
    metadata = subprocess.check_output(['apt-cache', 'show', package], text=True)
    blocks = [dict(line.split(': ', 1) for line in block.splitlines() if ': ' in line and not line.startswith(' ')) for block in metadata.split('\n\n')]
    record = next(block for block in blocks if 'Filename' in block and 'SHA256' in block)
    target = archives / Path(record['Filename']).name
    if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest() != record['SHA256']:
        subprocess.run(['curl', '-fLsS', '--max-time', '25', '--retry', '1', ('https://deb.debian.org/debian-security/' if record['Filename'].startswith('pool/updates/') else 'https://deb.debian.org/debian/') + record['Filename'], '-o', str(target)], check=True)
    if hashlib.sha256(target.read_bytes()).hexdigest() != record['SHA256']:
        raise RuntimeError('Package checksum mismatch: ' + package)
    return target

with ThreadPoolExecutor(max_workers=6) as pool:
    downloaded = list(pool.map(download, packages))
for archive in downloaded:
    subprocess.run(['dpkg-deb', '-x', str(archive), str(root)], check=True)

env = dict(os.environ)
env.pop('PLAYWRIGHT_BROWSERS_PATH', None)
executable = Path(subprocess.check_output(['node', '-p', 'require("playwright").webkit.executablePath()'], env=env, text=True).strip())
cache = executable.parent.parent
target_cache = Path('/tmp/451-browsers')
target_cache.mkdir(exist_ok=True)
for browser in cache.iterdir():
    target = target_cache / browser.name
    if target.exists() or target.is_symlink():
        continue
    if browser == executable.parent:
        shutil.copytree(browser, target)
    else:
        target.symlink_to(browser, target_is_directory=browser.is_dir())
for flavor in ['minibrowser-wpe', 'minibrowser-gtk']:
    wrapper = target_cache / executable.parent.name / flavor / 'MiniBrowser'
    content = wrapper.read_text().replace('export LD_LIBRARY_PATH="${MYDIR}/lib:${MYDIR}/sys/lib"', 'export LD_LIBRARY_PATH="${MYDIR}/lib:${MYDIR}/sys/lib:${LD_LIBRARY_PATH}"')
    wrapper.write_text(content)
print('Private dependencies and browser ready in /tmp/451-webkit-deps and /tmp/451-browsers')
PY
