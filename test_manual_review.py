#!/usr/bin/env python3
"""Review-only checks: no database initialization, inventory writes or deployment."""
import json
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
import fitz

ROOT=Path(__file__).resolve().parent
ASSETS=ROOT/'static/manual-review'

def run():
    manifest=json.loads((ASSETS/'manifest.json').read_text())
    assert len(manifest['items'])==20
    expected={'50':[30,45,60,72],'60':[30,40,60,80]}
    for machine in expected:
        pitches=[x['parameters']['pitch'] for x in manifest['items'] if x['machine']==machine and x['kind']=='GFA']
        assert pitches==expected[machine]
    for item in manifest['items']:
        src=fitz.Pixmap(ASSETS/item['source'])
        assert src.width==item['width']-2 and src.height==item['height']-2
        tree=ET.fromstring((ASSETS/item['svg']).read_text())
        assert not tree.findall('.//{http://www.w3.org/2000/svg}image'), 'Vector must not embed raster'
        paths=tree.findall('.//{http://www.w3.org/2000/svg}path')
        assert paths and all(p.attrib.get('fill-rule')=='evenodd' for p in paths)
        image=fitz.open(ASSETS/item['svg'])[0].get_pixmap(alpha=False)
        pixels=image.samples
        occupied=sum(min(pixels[i:i+3])<230 for i in range(0,len(pixels),image.n))
        fraction=occupied/(image.width*image.height)
        assert .025<fraction<.7,(item['id'],fraction)
    js=r'''
const fs=require('fs'),assert=require('assert');
const {barrelGeometry,rowState}=require('./static/manual-review/review.js');
const specs=JSON.parse(fs.readFileSync('data/seed.json')).machines;
for(const m of ['50','60']) {
 const s=specs[m],rows=s.barrel_configuration;
 assert.strictEqual(rows.length,m==='50'?14:13);
 assert.strictEqual(rows.at(-1).mm,s.barrel_length);
 assert.strictEqual(rows.filter(r=>r.role==='side').length,2);
 assert.strictEqual(rows.filter(r=>r.role==='vacuum').length,1);
 assert.strictEqual(rows.filter(r=>r.port_key).length,2);
 const natural=rows.find(r=>r.port_key==='natural4');
 assert.strictEqual(rowState(natural,{natural4:false}),'堵头封闭');
 assert.strictEqual(rowState(natural,{natural4:true}),'ATM');
 for(const open of [true,false]) {
  const svg=barrelGeometry(s,{natural4:open,natural7:open});
  assert.strictEqual((svg.match(/data-row=/g)||[]).length,rows.length);
  assert(!svg.includes('NaN'));assert(!svg.includes('<image'));
  fs.writeFileSync(`图形审核/机筒-${m}CC-${open?'排气':'堵头'}.svg`,svg);
 }
}
'''
    subprocess.run(['node','-e',js],cwd=ROOT,check=True)
    for p in (ROOT/'图形审核').glob('机筒*.svg'):
        fitz.open(p)[0].get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False).save(p.with_suffix('.png'))
    code=(ASSETS/'review.js').read_text()
    assert 'method:' not in code and '/api/bootstrap' in code
    print('PASS: 20 SVG manual symbols; machine-specific pitches; 14/13 barrel positions; fixed ports; open/plug states; no write API')

if __name__=='__main__':run()
