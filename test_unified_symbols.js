'use strict';
// Read-only browser regression: source files and persisted projects stay untouched.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',r=>r.request().method()==='GET'?r.continue():r.abort());
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:8732');
  await page.waitForFunction(()=>DATA.components.length===70);
  const result=await page.evaluate(()=>{
   const failures=[];
   const parse=html=>new DOMParser().parseFromString(html,'text/html');
   const geometry=svg=>JSON.stringify([...svg.querySelectorAll('path,rect')].map(p=>[p.tagName,...['d','x','y','width','height','stroke','stroke-width','stroke-dasharray','fill'].map(a=>p.getAttribute(a))]));
   for(const c of DATA.components){
    state.machine=c.machine;
    const thumb=parse(elementThumb(c)).querySelector('svg[data-model]');
    const drawing=parse(exactElementImage(10,60,c,0,false,20,50));
    const installed=drawing.querySelector('svg[data-model]');
    if(!thumb||!installed||geometry(thumb)!==geometry(installed)||drawing.querySelector('image'))failures.push(c.name);
   }
   for(const t of DATA.templates){
    state.machine=t.machine;state.sequence=[...t.sequence];state.ports={natural4:true,natural7:true};
    for(const html of [desktopDrawingSVG(),drawingSVG(),drawingSVG(true)]){
     const d=parse(html);
     if(d.querySelectorAll('.screw-element svg[data-model]').length!==t.sequence.length||d.querySelector('.screw-element image'))failures.push(t.name);
    }
   }
   for(const machine of ['50','60']){
    newProject(machine);state.sequence=[...DATA.templates.find(t=>t.machine===machine).sequence];renderReport();
    if(document.querySelectorAll('#printRoot .print-page').length!==3||document.querySelector('#printRoot .screw-element image'))failures.push('print '+machine);
   }
   return {failures,models:DATA.components.length,templates:DATA.templates.length};
  });
  assert.deepEqual(result.failures,[]);assert.deepEqual(errors,[]);
  console.log(`PASS: ${result.models} identical library/installed vector geometries; ${result.templates} historical templates use vectors in live, full and compact exports; both machines print 3 pages; no database writes`);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
