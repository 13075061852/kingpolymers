'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const M=require('./static/component-models.js');
const {makeCatalog}=require('./static/manual-review/review.js');
const seed=require('./data/seed.json');
const manual=require('./static/manual-review/manifest.json');
const audit=require('./static/manual-review/model-audit.json');
const before=JSON.stringify(seed);
assert.equal(seed.components.filter(c=>c.machine==='50').length,40);
assert.equal(seed.components.filter(c=>c.machine==='60').length,30);
for(const c of seed.components){
 const p=M.model(c);
 assert.ok(p.valid,c.name);
 assert.deepEqual(p.mismatches,[],c.name);
 assert.equal(p.raw,c.name);
 assert.ok(M.matches(c,p.label),c.name);
 const svg=M.symbol(c,seed.machines[c.machine]);
 assert.ok(svg.includes('data-length="'+c.length+'"'),c.name);
 assert.ok(!svg.includes('<image'),c.name);
 if(c.type==='KB')assert.equal((svg.match(/<g data-disc=/g)||[]).length,c.discs,c.name);
}
for(const name of ['KB5-2-30-90°-RE','KB-5-2-30-90°-RE','KB5-2-30-90度Re']){
 const p=M.parse(name);
 assert.equal(p.label,'KB-5-2-30-90°-RE');
 assert.deepEqual([p.discs,p.lobes,p.length,p.angle,p.direction],[5,2,30,90,'RE']);
}
assert.equal(M.parse('KB6-2-60-45°-RE').label,'KB-6-2-60-45°-RE');
assert.equal(M.parse('KB-6-2-60-45°-Li').direction,'LI');
assert.equal(M.parse('KB-6-2-60-90°').direction,'');
assert.equal(M.parse('KS1-2-10-M(2)').length,10);
assert.equal(M.parse('ks-1-2-10-ae').label,'KS-1-2-10-A/E');
assert.ok(M.matches({name:'KS1-2-10-A/E'},'ks-1-2-10-ae'));
assert.ok(M.matches({name:'KB-6-2-60-60°-Re'},'kb-6-2-60-60度re'));
// Exercise the actual Machine preview entry point, not just the detail renderer.
const appSource=fs.readFileSync('./static/app.js','utf8');
const thumbSource=appSource.slice(appSource.indexOf('let thumbnailSerial=0;'),appSource.indexOf('function libraryGroup('));
const thumbContext={ComponentModels:M,DATA:seed,state:{machine:'50'}};
vm.createContext(thumbContext);vm.runInContext(thumbSource,thumbContext);
const ids=new Set();
for(const c of seed.components){
 const svg=thumbContext.elementThumb(c);
 assert.ok(!svg.includes('<image'),c.name+' catalog must not upscale a raster');
 assert.ok(svg.includes('data-model="'+M.model(c).label+'"'),c.name);
 const id=svg.match(/<clipPath id="([^"]+)"/)[1];
 assert.ok(!ids.has(id),'catalog clip IDs must be unique across hidden views');ids.add(id);
}
const unknown=thumbContext.elementThumb({name:'UNRECOGNIZED',machine:'50'});
assert.ok(unknown.includes('待核对型号')&&!unknown.includes('<image'),'never borrow a nearby model');
assert.equal(M.parse('GFF-2-72-180').pitch,72);
assert.equal(M.parse('GFF-2-80-180').length,180);
assert.equal(M.parse('invalid').valid,false);
assert.equal(M.model({name:'KB6-2-60-45°-RE',length:30}).mismatches.length,1);
const shapes=[30,45,60,90].map(a=>M.symbol('KB-6-2-60-'+a+'°-RE',{diameter:60}));
assert.equal(new Set(shapes.map(s=>s.match(/<g clip-path[\s\S]*<\/g><path d="M0/)[0])).size,4,'angles must change actual paths');
assert.ok(M.symbol('KB-6-2-60-45°-LI',{diameter:60}).includes('scale(-1 1)'));
assert.notEqual(M.symbol('GFA-2-30-60',{diameter:50}),M.symbol('GFA-2-60-60',{diameter:50}));
const catalog=makeCatalog(seed.components,manual.items,audit.models);
assert.equal(catalog.length,70);
assert.equal(catalog.filter(c=>c.audit?.drawing_matches.length).length,69);
for(const x of catalog){
 assert.equal(x.audit.raw,x.name);
 if(x.reference){assert.equal(x.reference.machine,x.machine);if(x.parameters.angle!=null)assert.equal(x.parameters.angle,x.reference.parameters.angle);}
}
assert.ok(catalog.find(x=>x.label==='KB-5-2-30-90°-RE'&&x.machine==='50'));
assert.ok(!catalog.find(x=>x.label==='KB-5-2-30-90°-RE'&&x.machine==='60'));
assert.equal(makeCatalog([{...seed.components[0],name:'edited name'}],manual.items,audit.models)[0].audit,null);
assert.equal(JSON.stringify(seed),before,'rendering and normalization must not mutate identities or inventory');
// Exercise real review startup, filtering, machine switching and details in a
// small DOM harness. This verifies JS behavior, not browser layout/printing.
(async()=>{
 const elements=new Map();
 const el=id=>{if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',textContent:'',style:{setProperty(){}},checked:false});return elements.get(id)};
 const urls=[];
 const context={ComponentModels:M,document:{querySelector:el,querySelectorAll:()=>[]},fetch:async url=>{urls.push(url);return {ok:true,json:async()=>url.includes('model-audit')?audit:url.includes('bootstrap')?seed:manual}},console,setTimeout,clearTimeout};
 vm.runInNewContext(fs.readFileSync('./static/manual-review/review.js','utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal((el('#gallery').innerHTML.match(/data-symbol=/g)||[]).length,40);
 el('#search').value='KB-5-2-30-90度Re';el('#search').oninput();
 assert.equal((el('#gallery').innerHTML.match(/data-symbol=/g)||[]).length,1);
 el('#search').value='';el('#machine').value='60';el('#machine').onchange();
 assert.equal((el('#gallery').innerHTML.match(/data-symbol=/g)||[]).length,30);
 const target=catalog.find(c=>c.machine==='50'&&c.label==='KB-6-2-60-45°-RE');
 vm.runInNewContext(`review.machine='50';showSymbol('${target.id}')`,context);
 assert.ok(el('#comparison').innerHTML.includes('45°'));
 assert.ok(el('#comparison').innerHTML.includes('PDF原文有对应型号'));
 assert.ok(el('#comparison').innerHTML.includes('不以邻近角度代替'));
 assert.deepEqual(urls.sort(),['/api/bootstrap','manifest.json','model-audit.json'].sort());
 console.log('PASS: 70 complete models; normalized search; actual disc/angle paths; 69 PDF-name matches; machine isolation; read-only review interactions');
})().catch(e=>{console.error(e);process.exitCode=1});
