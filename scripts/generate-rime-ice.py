#!/usr/bin/env python3
"""Rebuild the static GPL-3.0-only Rime Ice index from pinned local input files.

Fetch once with:
  git clone https://github.com/iDvel/rime-ice.git /path/rime-ice
  git -C /path/rime-ice checkout 99662ba01e3affa6a0f009174ca530b887bac3b6
  python3 scripts/generate-rime-ice.py --input-dir /path/rime-ice/cn_dicts
The generator verifies SHA-256 of every required input. Normal npm test/build
and the browser never fetch upstream.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

PIN = '99662ba01e3affa6a0f009174ca530b887bac3b6'
SOURCE = f'https://github.com/iDvel/rime-ice/tree/{PIN}/cn_dicts'
HASHES = {
    '8105': '1f9a42b91dea6982baee2551981780271aeffd78876662b9c9f324e56b37b120',
    'base': '551cad93c2e74c7325599e0d23afbf71c2d2e57df9af3f8f6fa16d87e60290a3',
    'ext': 'd2d52bf75f7bcdd8a4afb036ab879415a7e620e529a4ecebc71780fe7ccdf648',
}
# No unannotated entries: all selected rows have explicitly supplied pinyin.
# Keep every 8105 reading, base words of up to six characters with weight
# >=1000 (top 24 per spelling), and ext words of up to four characters for
# spellings already covered by base (top 6 per spelling). No claim that this
# covers all Rime Ice words; preserve original weights on selected records.
LIMITS = {'8105': None, 'base': 24, 'ext': 6}
HAN = re.compile(r'^[\u3400-\u9fff\U00020000-\U000323af]+$')
PINYIN = re.compile(r'^[a-z]+(?: [a-z]+)*$')


def generate(input_dir: Path, output: Path, fixture: bool) -> None:
    buckets = {}
    stats = {}
    for name in HASHES:
        path = input_dir / f'{name}.dict.yaml'
        raw = path.read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        if not fixture and digest != HASHES[name]:
            raise ValueError(f'{path}: SHA-256 mismatch {digest} != {HASHES[name]}')
        rows = []
        for line in raw.decode('utf-8-sig').splitlines():
            if line.startswith('#') or '\t' not in line:
                continue
            fields = line.split('\t')
            if len(fields) != 3:
                raise ValueError(f'{path}: invalid Rime tab-separated row: {line[:100]}')
            word, spelling, weight = fields
            # UI is explicitly Han-only, continuous lowercase pinyin without tone,
            # so mixed-script names and nonstandard readings cannot be committed.
            if not HAN.fullmatch(word) or not PINYIN.fullmatch(spelling):
                continue
            if len(word) != len(spelling.split(' ')):
                continue
            try:
                frequency = int(weight)
            except ValueError:
                raise ValueError(f'{path}: invalid weight: {weight}') from None
            if frequency < 0:
                raise ValueError(f'{path}: negative weight: {weight}')
            if not fixture and name == 'base' and (len(word) > 6 or frequency < 1000):
                continue
            if not fixture and name == 'ext' and len(word) > 4:
                continue
            rows.append((spelling.replace(' ', ''), word, frequency))
        stats[name] = {'input_rows': len(rows), 'sha256': digest}
        per_key = {}
        for key, word, weight in rows:
            entry = per_key.setdefault(key, {})
            entry[word] = max(entry.get(word, -1), weight)
        for key, entries in per_key.items():
            if not fixture and name == 'ext' and key not in buckets:
                continue
            ranked = sorted(entries.items(), key=lambda item: (-item[1], item[0]))
            limit = LIMITS[name]
            for word, weight in ranked[:limit]:
                existing = buckets.setdefault(key, {})
                existing[word] = max(existing.get(word, -1), weight)
        stats[name]['selected_before_cross_source_dedupe'] = sum(min(len(v), LIMITS[name] or len(v)) for key, v in per_key.items() if name != 'ext' or fixture or key in buckets)
    # Keep exact Rime numeric weights. Stable tie-break by codepoint, no locale.
    packed = {key: ' '.join(f'{word}:{weight}' for word, weight in sorted(entries.items(), key=lambda item: (-item[1], item[0])))
              for key, entries in sorted(buckets.items())}
    banner = (f'/* GPL-3.0-only derived lexicon: {SOURCE}; pinned commit {PIN}.\n'
              f' * 8105 + bounded base/ext subset (see generator and NOTICE.md).\n'
              f' * Input SHA-256: ' + ', '.join(f'{name}={HASHES[name]}' for name in HASHES) + '\n */\n')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(banner + 'export const PACKED_LEXICON = ' + json.dumps(packed, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    stats['output'] = {'spelling_keys': len(packed), 'word_readings': sum(len(v) for v in buckets.values()),
                       'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'bytes': output.stat().st_size}
    print(json.dumps(stats, ensure_ascii=False, sort_keys=True))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input-dir', type=Path, required=True, help='local pinned cn_dicts directory')
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parent.parent / 'src/lexicon.js')
    parser.add_argument('--fixture', action='store_true', help='unit-test synthetic fixtures only; bypasses pinned hash check')
    args = parser.parse_args()
    generate(args.input_dir, args.output, args.fixture)
