#!/usr/bin/env python3
"""Extract exact SIGMA/Leistritz appearance samples from archived page-1 drawings.
Sources are read only. Output is used by the interactive SVG editor.
"""
from __future__ import annotations
import base64, glob, hashlib, json, os, re, struct, sys, zlib
from types import SimpleNamespace
from pathlib import Path
import fitz
from build_seed import SOURCE_DIRS, pdf_sequence, element_length

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'static'/'assets'
ELEMENTS=OUT/'elements'
ICONS=OUT/'icons'
REFERENCE={
 '50':'/Users/lsy/Desktop/广俊塑料AI/13.螺杆组合/50CC PRO/2024-7-24-ZSE_50CC Pro_04037198_48D_1C_Ning Bo Guang Jun_PBT+FR+GF.pdf',
 '60':'/Users/lsy/Desktop/广俊塑料AI/13.螺杆组合/60CC PRO/2024-4-2-ZSE_60CC_05047144__48D_1E_Ning Bo Guang Jun__PBT+FR+GF.pdf'
}
SPECS={'50':{'target':2590,'offset':42,'section':210,'heat':1},'60':{'target':2970,'offset':60,'section':240,'heat':0}}
ICON_OVERRIDES={'GFA-2-60-60':OUT/'reference-overrides'/'gfa-2-60-60.png'}

def png_bytes(w,h,raw,n):
    rows=[]
    for y in range(h):
        row=raw[y*w*n:(y+1)*w*n]
        if n==4:row=b''.join(row[i:i+3] for i in range(0,len(row),4))
        elif n==1:row=b''.join(row[i:i+1]*3 for i in range(len(row)))
        rows.append(b'\0'+row)
    def chunk(t,d):return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows),9))+chunk(b'IEND',b'')

def largest_image(doc,page=0):
    images=doc[page].get_images(full=True)
    xref=max(images,key=lambda i:i[2]*i[3])[0]
    data=doc.extract_image(xref)
    return fitz.Pixmap(data['image']),data

def dark_count(pix,y):
    d=pix.samples;n=pix.n;w=pix.width
    return sum(1 for x in range(w) if d[(y*w+x)*n]<105 and d[(y*w+x)*n+1]<105 and d[(y*w+x)*n+2]<105)

def screw_band(pix):
    rows=[(y,dark_count(pix,y)) for y in range(int(pix.height*.40),int(pix.height*.58))]
    strong=[(y,c) for y,c in rows if c>pix.width*.78]
    pairs=[]
    for y1,c1 in strong:
        for y2,c2 in strong:
            if 18<=y2-y1<=27:pairs.append((abs((y2-y1)-22)-(.001*(c1+c2)),y1,y2))
    if not pairs:raise RuntimeError('cannot locate screw band')
    _,top,bottom=min(pairs)
    return top,bottom

def crop(pix,x1,y1,x2,y2):
    x1=max(0,int(x1));x2=min(pix.width,int(x2));y1=max(0,int(y1));y2=min(pix.height,int(y2))
    raw=b''.join(pix.samples[(y*pix.width+x1)*pix.n:(y*pix.width+x2)*pix.n] for y in range(y1,y2))
    return png_bytes(x2-x1,y2-y1,raw,pix.n)

def component_id(machine,name):return hashlib.sha1(f'{machine}:{name}'.encode()).hexdigest()[:16]

INK={
    'GFA':(23,33,38),       # black / self-cleaning conveying
    'GFF':(223,161,43),     # yellow / free-cut conveying
    'KB':(36,68,223),       # blue / kneading block
    'KBX':(36,68,223),
    'GFM':(39,155,85),      # green / mixing conveying
    'SME':(39,155,85),
    'KS':(116,69,163),
    'SPACER':(104,119,126),
    'OTHER':(104,119,126),
}

def icon_pixmap(path):
    if path.suffix.lower()=='.svg':
        text=path.read_text(encoding='utf-8')
        encoded=re.search(r'base64,([^"\']+)',text);size=re.search(r'<svg[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"',text);pattern=re.search(r'<pattern[^>]*width="([\d.]+)"',text)
        if encoded and size and pattern:
            donor=fitz.Pixmap(base64.b64decode(encoded.group(1)));w,h=round(float(size.group(1))),round(float(size.group(2)));tile=float(pattern.group(1));flip='scale(-1 1)' in text;raw=bytearray(w*h*3)
            for y in range(h):
                sy=min(donor.height-1,round((y+.5)/h*donor.height-.5))
                for x in range(w):
                    px=w-1-x if flip else x;sx=min(donor.width-1,max(0,round(((px%tile)+.5)/tile*donor.width-.5)));si=(sy*donor.width+sx)*donor.n;di=(y*w+x)*3
                    raw[di:di+3]=donor.samples[si:si+3]
            return SimpleNamespace(width=w,height=h,n=3,samples=bytes(raw))
        doc=fitz.open(path);return doc[0].get_pixmap(matrix=fitz.Matrix(2,2),alpha=True)
    return fitz.Pixmap(path)

def gfa_master_icon(name):
    """Generate GFA variants only from the operator-approved GFA-2-60-60 crop."""
    master=fitz.Pixmap(ICON_OVERRIDES['GFA-2-60-60']);f=features(name);length=f['length'] or 60;pitch=f['pitch'] or 60;tw=max(8,round(master.width*length/60));th=master.height;period=master.width*pitch/60;flip=f['direction']=='LI';src=master.samples;n=master.n;raw=bytearray(tw*th*3)
    for y in range(th):
        for x in range(tw):
            px=tw-1-x if flip else x;fx=(px%period)/period*(master.width-1);x0=int(fx);x1=min(master.width-1,x0+1);dx=fx-x0
            for c in range(3):
                a=src[(y*master.width+x0)*n+c];b=src[(y*master.width+x1)*n+c]
                if n==4:
                    aa=src[(y*master.width+x0)*n+3]/255;ab=src[(y*master.width+x1)*n+3]/255;a=a*aa+255*(1-aa);b=b*ab+255*(1-ab)
                raw[(y*tw+x)*3+c]=round(a*(1-dx)+b*dx)
    return png_bytes(tw,th,bytes(raw),3),tw,th

def colorized_icon(pix,kind,scale=4):
    """Keep the archived line geometry, remove barrel wall rows, apply one ink per type."""
    top,bottom=(1,2) if pix.height>8 else (0,0);left,right=(1,1) if pix.width>6 else (0,0);sw,sh=pix.width-left-right,pix.height-top-bottom;tw,th=sw*scale,sh*scale
    src=pix.samples;n=pix.n;ink=INK.get(kind,INK['OTHER'])
    lum=[]
    for y in range(top,pix.height-bottom):
        row=[]
        for x in range(sw):
            i=(y*pix.width+x+left)*n;r,g,b=src[i],src[i+1],src[i+2]
            if n==4:
                a=src[i+3]/255;r=r*a+255*(1-a);g=g*a+255*(1-a);b=b*a+255*(1-a)
            # Any original engineering ink (black, blue, green, pink or yellow)
            # is significant. Distance from white preserves its full contour.
            row.append(min(r,g,b))
        lum.append(row)
    raw=bytearray(tw*th*3)
    for y in range(th):
        fy=max(0,min(sh-1,(y+.5)/scale-.5));y0=int(fy);y1=min(sh-1,y0+1);dy=fy-y0
        for x in range(tw):
            fx=max(0,min(sw-1,(x+.5)/scale-.5));x0=int(fx);x1=min(sw-1,x0+1);dx=fx-x0
            l0=lum[y0][x0]*(1-dx)+lum[y0][x1]*dx;l1=lum[y1][x0]*(1-dx)+lum[y1][x1]*dx
            whiteness=(l0*(1-dy)+l1*dy)/255;base=max(0,((1-whiteness)-.025)/.975);darkness=min(1,(base**.45)*1.08);i=(y*tw+x)*3
            for c in range(3):raw[i+c]=round(255-(255-ink[c])*darkness)
    return png_bytes(tw,th,bytes(raw),3),tw,th

def features(name):
    up=name.upper();kind=next((k for k in ('GFA','GFF','GFM','SME','KBX','KB','KS','SPACER') if up.startswith(k)),'OTHER');nums=[int(x) for x in re.findall(r'\d+',name)]
    direction='LI' if re.search(r'(?:-|^)LI?$',name,re.I) else ('RE' if re.search(r'(?:-|^)RE$',name,re.I) else '')
    out={'kind':kind,'length':element_length(name),'direction':direction,'pitch':0,'discs':0,'angle':0}
    if kind in ('GFA','GFF','GFM','SME') and len(nums)>=3:out['pitch']=nums[-2]
    if kind in ('KB','KBX') and len(nums)>=4:out.update(discs=nums[0],angle=nums[-1])
    return out

def donor_score(target_machine,target_name,donor_machine,donor_name):
    a,b=features(target_name),features(donor_name)
    if a['kind']!=b['kind']:return 10**9
    score=0 if target_machine==donor_machine else 45
    if a['direction']!=b['direction']:score+=15
    score+=abs(a['pitch']-b['pitch'])*2+abs(a['discs']-b['discs'])*12+abs(a['angle']-b['angle'])*3
    return score

def derived_svg(machine,name,donor_machine,donor_name,donor):
    _,data,dw,dh,_=donor;a,b=features(name),features(donor_name);px_per_mm=1115/SPECS[machine]['target'];tw=max(4,round(a['length']*px_per_mm))
    if a['kind'] in ('GFA','GFF','GFM','SME') and a['pitch'] and b['pitch']:tile=max(3,dw*a['pitch']/b['pitch'])
    elif a['kind'] in ('KB','KBX') and a['discs'] and b['discs'] and a['length'] and b['length']:tile=max(3,dw*(a['length']/a['discs'])/(b['length']/b['discs']))
    else:tile=tw
    encoded=base64.b64encode(data).decode();flip=a['direction']!=b['direction'] and a['direction'] and b['direction']
    rect=f'<rect width="{tw}" height="{dh}" fill="url(#p)"/>'
    if flip:rect=f'<g transform="translate({tw} 0) scale(-1 1)">{rect}</g>'
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="{tw}" height="{dh}" viewBox="0 0 {tw} {dh}"><defs><pattern id="p" width="{tile:.3f}" height="{dh}" patternUnits="userSpaceOnUse"><image href="data:image/png;base64,{encoded}" width="{tile:.3f}" height="{dh}" preserveAspectRatio="none"/></pattern></defs>{rect}</svg>'''
    return svg.encode(),tw,dh

def score_span(machine,start,end):
    s=SPECS[machine];score=0
    for sec in (4,5,7,8,11):
        ss=(sec-1)*s['section']+(s['heat'] if sec>1 else 0);center=ss+s['section']/2
        if max(start,center-55)<min(end,center+55):score+=1000
    for sec in range(1,13):
        boundary=sec*s['section']+(s['heat'] if sec>=1 else 0)
        if start+5<boundary<end-5:score+=30
    return score

def main():
    OUT.mkdir(parents=True,exist_ok=True);ELEMENTS.mkdir(parents=True,exist_ok=True)
    # Exact fixed barrel references requested by the operator.
    refs={}
    for machine,path in REFERENCE.items():
        doc=fitz.open(path);pix,data=largest_image(doc);ext=data['ext'];dest=OUT/f'barrel-reference-{machine}.{ext}';dest.write_bytes(data['image']);top,bottom=screw_band(pix)
        refs[machine]={'url':f'/assets/{dest.name}','width':pix.width,'height':pix.height,'band_top':top,'band_bottom':bottom,'crop_top':190,'crop_bottom':425,'source':Path(path).name}
    candidates={}
    for machine,folders in SOURCE_DIRS.items():
        spec=SPECS[machine]
        for folder in folders:
            for path in glob.glob(os.path.join(folder,'*.pdf')):
                if Path(path).name.startswith('Schnecken'):continue
                try:
                    seq=pdf_sequence(path)
                    if not seq or sum(element_length(n) for n in seq)!=spec['target']:continue
                    doc=fitz.open(path);pix,_=largest_image(doc);top,bottom=screw_band(pix)
                    left,right=20,pix.width-20
                    usable=right-left;cum=0;physical=-spec['offset']
                    for name in seq:
                        length=element_length(name);x1=round(right-(cum+length)/spec['target']*usable);x2=round(right-cum/spec['target']*usable)
                        start,end=physical,physical+length;quality=score_span(machine,start,end)
                        # Prefer source samples with a few extra pixels of width and no openings.
                        sample=crop(pix,x1,top,x2,bottom+1);key=(machine,name)
                        if key not in candidates or quality<candidates[key][0]:candidates[key]=(quality,sample,x2-x1,bottom-top+1,Path(path).name)
                        cum+=length;physical=end
                except Exception as exc:print('skip',Path(path).name,exc)
    manifest={'references':refs,'elements':{}}
    for (machine,name),(quality,data,w,h,source) in candidates.items():
        folder=ELEMENTS/machine;folder.mkdir(parents=True,exist_ok=True);cid=component_id(machine,name);dest=folder/f'{cid}.png';dest.write_bytes(data)
        manifest['elements'][f'{machine}:{name}']={'url':f'/assets/elements/{machine}/{cid}.png','width':w,'height':h,'source':source,'exact':True}
    # Every selectable catalog model must use the same original visual language.
    # For models never installed in an archived full-length drawing, derive a
    # self-contained sprite from the closest exact Leistritz sample.
    seed=json.loads((ROOT/'data'/'seed.json').read_text(encoding='utf-8'))
    for item in seed['components']:
        machine,name=item['machine'],item['name'];key=f'{machine}:{name}'
        if key in manifest['elements']:continue
        pool=[(donor_score(machine,name,dm,dn),dm,dn,d) for (dm,dn),d in candidates.items() if donor_score(machine,name,dm,dn)<10**9]
        folder=ELEMENTS/machine;folder.mkdir(parents=True,exist_ok=True);cid=component_id(machine,name);dest=folder/f'{cid}.svg'
        if not pool:
            if features(name)['kind']!='SPACER':continue
            w=max(4,round(element_length(name)*1115/SPECS[machine]['target']));h=23;data=f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}"><rect x=".5" y=".5" width="{w-1}" height="{h-1}" fill="#d8dcdd" stroke="#222"/></svg>'.encode();source='按莱斯间隔套标准外观生成'
        else:
            _,dm,dn,donor=min(pool,key=lambda x:x[0]);data,w,h=derived_svg(machine,name,dm,dn,donor);source=f'按原图 {dn} 派生'
        dest.write_bytes(data);manifest['elements'][key]={'url':f'/assets/elements/{machine}/{cid}.svg','width':w,'height':h,'source':source,'exact':False}
    # Build clear catalog/drawing icons from the archived geometry. The only
    # transformation is removal of the two barrel-wall rows and one fixed ink
    # colour per engineering element type; no generic screw shape is introduced.
    for key,info in manifest['elements'].items():
        machine,name=key.split(':',1);cid=component_id(machine,name);folder=ICONS/machine;folder.mkdir(parents=True,exist_ok=True);source_folder=ICONS/'sources'/machine;source_folder.mkdir(parents=True,exist_ok=True);dest=folder/f'{cid}.png'
        if name in ICON_OVERRIDES:
            source_path=ICON_OVERRIDES[name];pix=fitz.Pixmap(source_path);dest.write_bytes(source_path.read_bytes());info.update(icon_url=f'/assets/icons/{machine}/{cid}.png',icon_width=pix.width,icon_height=pix.height,ink=features(name)['kind'],icon_source='用户确认截图 09.52.39');continue
        if features(name)['kind']=='GFA':
            data,iw,ih=gfa_master_icon(name);dest.write_bytes(data);info.update(icon_url=f'/assets/icons/{machine}/{cid}.png',icon_width=iw,icon_height=ih,ink='GFA',icon_source='用户确认GFA-2-60-60母版按导程/长度生成');continue
        # The 60CC archived drawing is the operator-approved visual master.
        # Always select the nearest 60CC element of the same engineering kind,
        # then change only pitch/length and mirror LI from the matching Re shape.
        pool=[(donor_score('60',name,dm,dn),dm,dn,d) for (dm,dn),d in candidates.items() if dm=='60' and features(name)['kind']==features(dn)['kind']]
        if pool:
            _,dm,dn,donor=min(pool,key=lambda x:x[0]);source_data,_,_=derived_svg('60',name,dm,dn,donor);source_path=source_folder/f'{cid}.svg';source_path.write_bytes(source_data);info['icon_source']=f'60CC原图 {dn}'
        else:
            source_path=ROOT/'static'/info['url'].lstrip('/');info['icon_source']=info['source']
        pix=icon_pixmap(source_path);data,iw,ih=colorized_icon(pix,features(name)['kind']);dest.write_bytes(data)
        info.update(icon_url=f'/assets/icons/{machine}/{cid}.png',icon_width=iw,icon_height=ih,ink=features(name)['kind'])
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print('references',len(refs),'element sprites',len(candidates))

if __name__=='__main__':main()
