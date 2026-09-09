#!/usr/bin/env python3
"""Read-only full-model/PDF text audit. Never treats a name match as shape approval."""
import hashlib
import json
import re
import subprocess
import unicodedata
from pathlib import Path

import fitz
from build_seed import SOURCE_DIRS

BASE = Path(__file__).resolve().parent
OUT = BASE / 'static/manual-review/model-audit.json'


def key(name):
    return re.sub(r'[^A-Z0-9.()]', '', unicodedata.normalize('NFKC', name).upper())


def build():
    seed = json.loads((BASE / 'data/seed.json').read_text())
    models = json.loads(subprocess.check_output([
        'node', '-e', "const m=require('./static/component-models.js');const s=require('./data/seed.json');console.log(JSON.stringify(s.components.map(c=>m.model(c))))"
    ], cwd=BASE, text=True))
    lookup = {}
    for m in models:
        m['drawing_matches'] = []
        m['shape_status'] = '待逐型号图形终核；名称匹配不代表外形已验收'
        lookup.setdefault((m['machine'], key(m['raw'])), []).append(m)
    seen = set()
    for machine, directories in SOURCE_DIRS.items():
        for directory in directories:
            for path in sorted(Path(directory).glob('*.pdf')):
                data = path.read_bytes()
                sha = hashlib.sha256(data).hexdigest()
                if (machine, sha) in seen:
                    continue
                seen.add((machine, sha))
                found = {}
                with fitz.open(stream=data, filetype='pdf') as doc:
                    for page_no, page in enumerate(doc, 1):
                        for line in page.get_text().splitlines():
                            for m in lookup.get((machine, key(line)), []):
                                hit = found.setdefault(m['id'], {'file': path.name, 'sha256': sha, 'pages': [], 'source_models': []})
                                if page_no not in hit['pages']:
                                    hit['pages'].append(page_no)
                                if line not in hit['source_models']:
                                    hit['source_models'].append(line)
                for m in models:
                    if m['id'] in found:
                        m['drawing_matches'].append(found[m['id']])
    for m in models:
        m['templates'] = [{'id': t['id'], 'name': t['name'], 'file': t['source'],
                           'positions': [i+1 for i, name in enumerate(t['sequence']) if name == m['raw']]}
                          for t in seed['templates'] if t['machine'] == m['machine'] and m['raw'] in t['sequence']]
        m['name_status'] = 'PDF原文有对应型号' if m['drawing_matches'] else '仅有历史导入记录，待原图核对'
    payload = {'scope': '完整型号与PDF文字核对；非外形/CAD认证', 'models': models}
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    report = ['# 完整型号核对', '', '型号按原文件保存；界面统一KB分隔符、角度符号及方向大小写。原始记录不合并、不删除。',
              '', '核对范围：逐页匹配PDF文字中的完整型号，并记录原文件SHA256；这不等于该型号的图形已逐一验收。',
              '完整型号参数图为另行生成的工程示意；原手册20个SVG描边仍保留。组合总图暂未换用新参数图。', '',
              '数字含义：KB-片数-头数/叶数-长度mm-错位角°-方向。2不是螺杆根数。90°为中性错位角；原文件的RE/LI后缀仍保留。', '']
    for machine in ['50', '60']:
        rows = [m for m in models if m['machine'] == machine]
        report += [f'## {machine}CC：{len(rows)}条原始型号记录', '', '| 完整显示型号 | 原始型号 | 长度mm | 片数 | 导程mm / 错位角° | PDF文字出处（示例） |', '|---|---|---:|---:|---|---|']
        for m in rows:
            sources = m['drawing_matches']
            source = sources[0]['file'] + '，第' + '/'.join(map(str, sources[0]['pages'])) + '页' if sources else '待原图核对（详见JSON历史记录）'
            parameter = f"{m['angle']}°" if m['angle'] is not None else str(m['pitch'] or '—')
            report.append(f"| {m['label']} | {m['raw']} | {m['length']} | {m['discs'] or '—'} | {parameter} | {source} |")
        report += ['']
    (BASE / '图形审核/完整型号核对.md').write_text('\n'.join(report) + '\n')
    print(f"PASS: {len(models)} model records; {sum(bool(m['drawing_matches']) for m in models)} have PDF text matches; {len(seen)} read-only PDF sources")


if __name__ == '__main__':
    build()
