#!/usr/bin/env python3
"""Read-only manual extraction for visual review, isolated from production assets.
SVG contours are traced from native raster symbols, not enlarged JPEG crops of an
assembled screw. Tracing does not establish CAD accuracy or missing dimensions.
"""
import hashlib
import json
from pathlib import Path
import fitz

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'static' / 'manual-review' / 'assets'
BASE = Path('/Users/lsy/Library/CloudStorage/OneDrive-个人/文档/挤出机/莱斯特瑞兹')
MANUALS = {
    '50': BASE / '50CC PRO资料/04037198  操作手册/1_挤出机/1.1_挤出机/ZSE50CC 挤出机操作手册.pdf',
    '60': BASE / '05044144  操作手册/1_挤出机/1.1_挤出机/ZSE60CC 挤出机操作手册.pdf',
}
COLORS = {'GFA': '#111111', 'GFF': '#c99516', 'KB': '#173ad4', 'GFM': '#188842'}


def crop_native(pix, rect):
    x0, y0, x1, y1 = rect
    assert 0 <= x0 < x1 <= pix.width and 0 <= y0 < y1 <= pix.height
    raw = pix.samples
    rows = b''.join(raw[(y*pix.width+x0)*pix.n:(y*pix.width+x1)*pix.n] for y in range(y0,y1))
    return fitz.Pixmap(pix.colorspace, x1-x0, y1-y0, rows, pix.alpha)


def trace_svg(pix, color, threshold=127.5):
    """Interpolated marching-squares contours with even-odd holes, white padding."""
    w, h = pix.width, pix.height
    samples = pix.samples
    values = [[255.0]*(w+2) for _ in range(h+2)]
    for y in range(h):
        for x in range(w):
            i = (y*w+x)*pix.n
            rgb = samples[i:i+3] if pix.n >= 3 else samples[i:i+1]*3
            values[y+1][x+1] = sum(rgb)/3
    graph = {}
    def link(a,b):
        if a == b: return
        graph.setdefault(a, []).append(b)
        graph.setdefault(b, []).append(a)
    for y in range(h+1):
        for x in range(w+1):
            corners = [(x,y),(x+1,y),(x+1,y+1),(x,y+1)]
            gray = [values[cy][cx] for cx,cy in corners]
            dark = [v < threshold for v in gray]
            intersections = {}
            for e in range(4):
                j = (e+1)%4
                if dark[e] == dark[j]: continue
                t = (threshold-gray[e])/(gray[j]-gray[e])
                ax,ay = corners[e]; bx,by = corners[j]
                intersections[e] = (round(ax+(bx-ax)*t,5),round(ay+(by-ay)*t,5))
            if len(intersections) == 2:
                link(*intersections.values())
            elif len(intersections) == 4:
                # Resolve saddle cells around dark corners rather than merging
                # nearby independent strokes across white space.
                for corner in range(4):
                    if dark[corner]: link(intersections[(corner-1)%4],intersections[corner])
    assert all(len(neighbors)==2 for neighbors in graph.values()), 'Non-closed contour graph'
    contours = []
    seen = set()
    for start in graph:
        if start in seen: continue
        points = [start]; previous = None; current = start
        while True:
            seen.add(current)
            nexts = [p for p in graph[current] if p != previous]
            if not nexts: break
            nxt = nexts[0]
            if nxt == start: break
            if nxt in seen: break
            points.append(nxt); previous,current = current,nxt
        if len(points) >= 3:
            # Remove exactly collinear points only: no contour smoothing or
            # invented geometry, which previously changed the actual symbols.
            simple = []
            for p in points:
                while len(simple)>1:
                    a,b = simple[-2:]
                    cross=(b[0]-a[0])*(p[1]-b[1])-(b[1]-a[1])*(p[0]-b[0])
                    if abs(cross)>1e-5: break
                    simple.pop()
                simple.append(p)
            contours.append('M'+' L'.join(f'{px:.3f},{py:.3f}' for px,py in simple)+' Z')
    path = ' '.join(contours)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w+2} {h+2}" '
           f'width="{w+2}" height="{h+2}" role="img">'
           f'<path fill="{color}" fill-rule="evenodd" d="{path}"/></svg>')
    return svg


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    items=[]
    sources=[]
    for machine, path in MANUALS.items():
        doc=fitz.open(path)
        source={'machine':machine,'name':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
        sources.append(source)
        def image_by_size(page, width, height):
            refs=[i for i in doc[page-1].get_images(full=True) if i[2:4]==(width,height)]
            assert len(refs)==1, (machine,page,width,height)
            return fitz.Pixmap(doc.extract_image(refs[0][0])['image'])
        gfa=image_by_size(34,894 if machine=='50' else 888,817 if machine=='50' else 818)
        kb=image_by_size(35,1007,782)
        gfm=image_by_size(35,1002,444)
        pitch=[30,45,60,72] if machine=='50' else [30,40,60,80]
        definitions=[]
        for index,p in enumerate(pitch):
            y=[68,233,398,563][index]
            definitions.append((f'GFA-2-{p}', 'GFA',34,gfa,(0,y,98,y+59), {'pitch':p}))
        definitions.append((f'GFF-2-{pitch[-1]}','GFF',34,gfa,(0,727,98,786),{'pitch':pitch[-1]}))
        for title,y,angle,direction in [('KB 30° Re',93,30,'RE'),('KB 60° Re',299,60,'RE'),('KB 90°',505,90,''),('KB 60° LI',711,60,'LI')]:
            definitions.append((title,'KB',35,kb,(142,y,214,y+65),{'angle':angle,'direction':direction}))
        definitions.append(('GFM 图示','GFM',35,gfm,(95,25,194,94),{}))
        for index,(label,kind,page,pix,rect,parameters) in enumerate(definitions):
            crop=crop_native(pix,rect)
            key=f'{machine}-{index:02d}'
            original=OUT/f'{key}-source.png';vector=OUT/f'{key}.svg'
            crop.save(original)
            threshold=200.5 if kind=='GFM' else 127.5
            vector.write_text(trace_svg(crop,COLORS[kind],threshold),encoding='utf-8')
            items.append({'id':key,'machine':machine,'label':label,'kind':kind,'parameters':parameters,
                          'page':page,'crop':rect,'trace_threshold':threshold,'source':f'assets/{original.name}','svg':f'assets/{vector.name}',
                          'width':crop.width+2,'height':crop.height+2,
                          'status':'手册符号描边样张；手册未标注此图的完整长度，不作完整型号映射'})
        # Barrel anatomy reference, viewable beside proposed UI-state symbols.
        for page in (26,28):
            # Crop diagrams without instructional text to keep review focused.
            rect=fitz.Rect(85,130,210,740) if page==26 else doc[page-1].rect
            doc[page-1].get_pixmap(matrix=fitz.Matrix(1.5,1.5),clip=rect,alpha=False).save(OUT/f'{machine}-barrel-page{page}.png')
    manifest={'sources':sources,'items':items,'notice':'审核页，不替换生产元件库；SVG为原始手册符号轮廓描边，不是制造图。'}
    (OUT.parent/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    # Portable side-by-side review sheets, renderable without a browser.
    import base64
    import xml.etree.ElementTree as ET
    review_dir=ROOT/'图形审核'
    review_dir.mkdir(exist_ok=True)
    for machine in MANUALS:
        selected=[item for item in items if item['machine']==machine]
        parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1060" height="1320"><rect width="1060" height="1320" fill="white"/>',
               f'<text x="25" y="30" font-family="Arial" font-size="22">kingpolymer | {machine}CC manual symbol review</text>',
               '<text x="25" y="55" font-family="Arial" font-size="12">Native manual symbol (left) / SVG traced contour (right). Not production CAD.</text>']
        for i,item in enumerate(selected):
            y=85+i*120
            raw=(OUT.parent/item['source']).read_bytes()
            svg=ET.fromstring((OUT.parent/item['svg']).read_text())
            content=''.join(ET.tostring(child,encoding='unicode') for child in svg)
            parts.append(f'<text x="25" y="{y+40}" font-family="Arial" font-size="17">{item["label"]}</text><text x="25" y="{y+64}" font-family="Arial" font-size="12">Manual page {item["page"]}</text>')
            source_w,source_h=item['width']-2,item['height']-2
            rs=min(200/source_w,95/source_h);rw,rh=source_w*rs,source_h*rs
            parts.append(f'<image x="{290+(200-rw)/2}" y="{y+(95-rh)/2}" width="{rw}" height="{rh}" href="data:image/png;base64,{base64.b64encode(raw).decode()}"/>')
            scale=min(200/item['width'],95/item['height'])
            dx=600+(200-item['width']*scale)/2;dy=y+(95-item['height']*scale)/2
            parts.append(f'<g transform="translate({dx} {dy}) scale({scale})">{content}</g>')
            parts.append(f'<path d="M25 {y+108}H1020" stroke="#ddd"/>')
        parts.append('</svg>')
        dest=review_dir/f'手册图形对照-{machine}CC.svg'
        dest.write_text(''.join(parts),encoding='utf-8')
        rendered=fitz.open(dest)
        rendered[0].get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False).save(dest.with_suffix('.png'))
    print(f'Wrote {len(items)} manual symbol comparisons to {OUT.parent}')

if __name__=='__main__':main()
