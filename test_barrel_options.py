"""Extended layout dimensions, accessory compatibility and frontend/backend parity."""
import json,subprocess,tempfile
from pathlib import Path
import server,barrel_models as B

def run():
 with tempfile.TemporaryDirectory() as temp:
  server.DATA=Path(temp)/'data';server.BACKUPS=Path(temp)/'backups';server.DB_PATH=server.DATA/'test.db';server.init_db()
  for machine,spec in server.machine_specs().items():
   def parity(ports):
    code="const M=require('./static/barrel-models.js'),x=JSON.parse(require('fs').readFileSync(0));console.log(JSON.stringify({layout:M.normalize(x.machine,x.spec,x.ports.barrel_layout),summary:M.summary(x.machine,x.spec,x.ports),zones:M.zones(x.machine,x.spec,x.ports),warnings:M.warnings(x.machine,x.spec,x.ports),target:M.targetLength(x.machine,x.spec,x.ports)}))"
    js=json.loads(subprocess.check_output(['node','-e',code],input=json.dumps(dict(machine=machine,spec=spec,ports=ports)).encode(),cwd=server.ROOT))
    assert js['layout']==B.normalize(machine,spec,ports['barrel_layout'])
    assert js['summary']==B.summary(machine,spec,ports)
    assert js['zones']==server.restriction_zones(machine,ports)
    assert js['warnings']==B.warnings(machine,spec,ports)
    assert js['target']==server.validate(machine,[],ports)['target']
   modules=[]
   for i,r in enumerate(B.rows(machine,spec,{})):
    item=next(c for c in B.catalog(machine,spec) if c['role']==r['role'] and c['name']==r['name'])
    modules.append(dict(uid=f'std-{i}',key=item['key'],open=r['open']))
   modules.insert(len(modules)-1,dict(uid='extra',key=machine+':barrel',open=True))
   ports={'barrel_layout':dict(version=1,machine=machine,modules=modules,screw_length=spec['element_length']+spec['section_length'])}
   assert B.summary(machine,spec,ports)['sections']==13
   assert B.summary(machine,spec,ports)['process_d']==52
   parity(ports)
   for role in ['side','side_vacuum','natural','vacuum']:
    for cap in (['open','closed','inject'] if role in ['natural','vacuum'] else ['open','closed']):
     ports={'barrel_layout':dict(version=1,machine=machine,modules=[dict(uid='module',key=machine+':'+role,open=cap!='closed',cap=cap,length=120)])}
     parity(ports)
     assert len(server.restriction_zones(machine,ports))==(0 if cap=='closed' else 1)
     assert B.rows(machine,spec,ports)[0]['length']==120
   for item in [dict(uid='x',key=machine+':side',cap='inject'),dict(uid='x',key=machine+':flange',length=99),dict(uid='x',key=machine+':natural',length=30),dict(uid='x',key=machine+':barrel',length=True),dict(uid='x',key=machine+':barrel',length=1.5),dict(uid='x',key=('60' if machine=='50' else '50')+':side_vacuum')]:
    try:B.normalize(machine,spec,dict(version=1,machine=machine,modules=[item]))
    except ValueError:pass
    else:raise AssertionError('Invalid module accepted '+str(item))
 print('PASS: 48D→52D/13 sections, proposed shaft targets, custom lengths, top/side caps, injection safety, compatibility, Python/JS parity')
if __name__=='__main__':run()
