#!/usr/bin/env python3
"""Read-only acceptance checks for fixed dimensions, templates and safety rules."""
import hashlib, json
from pathlib import Path
import server


def run():
    server.init_db()
    root=Path(__file__).parent
    seed=json.loads((root/'data/seed.json').read_text(encoding='utf-8'))
    assets=json.loads((root/'static/assets/manifest.json').read_text(encoding='utf-8'))
    assert len(assets['elements'])==70
    for key,item in assets['elements'].items():
        assert item.get('icon_url') and (root/'static'/item['icon_url'].lstrip('/')).is_file(),key
    assert assets['elements']['60:KB-6-2-60-90°']['ink']=='KB'
    assert assets['elements']['60:GFA-2-80-60']['ink']=='GFA'
    # Same engineering model must use the same operator-approved shape.
    i50=assets['elements']['50:GFA-2-60-60'];i60=assets['elements']['60:GFA-2-60-60']
    b50=(root/'static'/i50['icon_url'].lstrip('/')).read_bytes();b60=(root/'static'/i60['icon_url'].lstrip('/')).read_bytes()
    assert hashlib.sha256(b50).digest()==hashlib.sha256(b60).digest()
    assert i50['icon_source']=='用户确认截图 09.52.39'
    assert seed['machines']['50']['section_length']==210
    assert seed['machines']['50']['sections']==12
    assert seed['machines']['50']['element_length']==2590
    assert seed['machines']['60']['section_length']==240
    assert seed['machines']['60']['sections']==12
    assert seed['machines']['60']['element_length']==2970
    barrel50=seed['machines']['50']['barrel_configuration']
    barrel60=seed['machines']['60']['barrel_configuration']
    assert len(barrel50)==14 and [(x['pos'],x['mm']) for x in barrel50][-2:]==[('M',2521),('N',2548)]
    assert barrel50[1]['name']=='Wärmesperre' and barrel50[1]['mm']==211
    assert len(barrel60)==13 and [(x['pos'],x['mm']) for x in barrel60][-2:]==[('L',2880),('M',2910)]
    assert barrel60[4]['name']=='Zyl-S (LSB 56)' and barrel60[7]['name']=='Zyl-S (LSB 56)'
    for machine in ('50','60'):
        latest=next(t for t in seed['templates'] if t['machine']==machine and t['is_default'])
        result=server.validate(machine,latest['sequence'],{'natural4':True,'natural7':True})
        assert result['difference']==0,(machine,result['difference'])
    zones_open=server.restriction_zones('50',{'natural4':True,'natural7':True})
    zones_closed=server.restriction_zones('50',{'natural4':False,'natural7':False})
    assert len(zones_open)==5 and len(zones_closed)==3
    assert all(z['end']-z['start']==132 for z in zones_open)
    with server.db() as c:
        assert c.execute('select count(*) from components').fetchone()[0]>=70
        assert c.execute('select count(*) from templates').fetchone()[0]>=20
        kb=c.execute("select length,discs,angle from components where machine='60' and name='KB-6-2-60-90°'").fetchone()
        assert tuple(kb)==(60,6,90)
        malformed=c.execute("select length,discs,angle from components where machine='50' and name='KB5-2-30-60-RE'").fetchone()
        assert tuple(malformed)==(30,5,60)
    print('PASS: dimensions, latest templates, GFA zones, component library and database')

if __name__=='__main__':run()
