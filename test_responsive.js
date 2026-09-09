'use strict';
// Run against the local server. All non-GET API requests are blocked; tests only
// edit the browser's unsaved state, never projects, inventory, or the database.
// NODE_PATH=<playwright node_modules> node test_responsive.js
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const origin=process.env.TEST_URL||'http://127.0.0.1:8731';
const output=process.env.SCREENSHOT_DIR||'/tmp/screw-responsive';
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await (process.env.BROWSER==='webkit'?webkit:chromium).launch({headless:true});
 try{
  for(const [width,height] of [[320,740],[375,812],[390,844],[430,932],[768,1024],[844,390],[1024,768],[1440,900],[1920,1080]]){
   const touch=width<=1024;
   const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch,deviceScaleFactor:touch?3:1});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('dialog',d=>d.accept());
   await page.route('**/api/**',route=>route.request().method()==='GET'?route.continue():route.abort());
   await page.goto(origin);
   await page.waitForFunction(()=>document.querySelectorAll('#componentLibrary .component-card').length===40);
   const checkWidth=async label=>{
    const m=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(m.scroll<=width+1,`${width} ${label}: page overflow ${JSON.stringify(m)}`);
   };
   await checkWidth('designer');
   for(const machine of ['50','60']){
    await page.evaluate(m=>newProject(m),machine);
    const stats=await page.locator('#componentLibrary').evaluate(el=>({cards:el.querySelectorAll('.component-card').length,images:el.querySelectorAll('image').length,models:[...el.querySelectorAll('.element-thumb')].map(s=>s.dataset.model)}));
    assert.equal(stats.cards,machine==='50'?40:30);assert.equal(stats.images,0);
    assert.ok(stats.models.every(Boolean));
    if(!await page.locator('#componentSearch').isVisible())await page.click('#catalogSearchBtn');
    await page.fill('#componentSearch','kb-6-2-60-60度re');
    assert.equal(await page.locator('#componentLibrary .component-card').count(),1);
    assert.equal(await page.locator('#componentLibrary [data-disc]').count(),6);
    await page.fill('#componentSearch','ks-1-2-10-ae');
    assert.equal(await page.locator('#componentLibrary .component-card').count(),1);
    const card=page.locator('#componentLibrary .component-card');
    if(touch)await card.locator('[data-action=info]').tap();
    else{await card.hover();await card.locator('[data-action=info]').click();}
    await checkWidth('model details');
    assert.ok((await page.locator('#modalTitle').textContent()).includes('KS-1-2-10-A/E'));
    await page.click('#modalClose');
    if(touch)await card.locator('[data-action=add]').tap();else await card.click();
    assert.equal(await page.locator('#sequenceList .seq-row').count(),1);
    assert.equal(await page.evaluate(()=>state.sequence[0]),machine==='50'?'KS1-2-10-A/E':'KS-1-2-10-A/E');
    await page.locator('#sequenceList [data-act=copy]').click();
    assert.equal(await page.locator('#sequenceList .seq-row').count(),2);
    await page.locator('#sequenceList [data-act=del]').last().click();
    assert.equal(await page.locator('#sequenceList .seq-row').count(),1);
    if(touch)await card.locator('[data-action=remove]').tap();else{await card.hover();await card.locator('[data-action=remove]').click();}
    assert.equal(await page.locator('#sequenceList .seq-row').count(),0);
    await page.fill('#componentSearch','');
    await page.click('#catalogListBtn');await checkWidth('list mode');
    await page.click('#catalogListBtn');
    await page.click('#catalogZoomOutBtn');await checkWidth('compact mode');
    await page.click('#catalogZoomInBtn');
    await page.click('#barrelCatalogBtn');await checkWidth('barrel catalog');
    await page.click('#screwCatalogBtn');
   }
   // Load a full historical sequence into memory only, then check table bounds,
   // zoom and inverse SVG coordinates including letterboxing and local scrolling.
   await page.evaluate(()=>{state.sequence=[...DATA.templates.find(t=>t.machine===state.machine).sequence];renderDesign()});
   await page.click('#zoomIn');await page.click('#zoomIn');await checkWidth('150% zoom');
   const coords=await page.evaluate(()=>{
    const svg=document.querySelector('#drawingWrap svg'),p=svg.createSVGPoint();p.x=600;p.y=200;
    const screen=p.matrixTransform(svg.getScreenCTM());const back=drawingPoint({clientX:screen.x,clientY:screen.y},svg);
    return {x:back.x,y:back.y};
   });
   assert.ok(Math.abs(coords.x-600)<.01&&Math.abs(coords.y-200)<.01);
   await page.click('#zoomReset');
   if(touch){
    // A touch swipe over a screw must never trigger desktop drag-out deletion.
    const before=await page.evaluate(()=>JSON.stringify(state.sequence));
    await page.locator('#drawingWrap').scrollIntoViewIfNeeded();
    await page.evaluate(()=>{
     const svg=document.querySelector('#drawingWrap svg'),hit=svg.querySelector('[data-element-index] .screw-hit');
     const r=hit.getBoundingClientRect(),base={bubbles:true,pointerId:17,pointerType:'touch',isPrimary:true,button:0,clientX:r.x+1,clientY:r.y+1};
     hit.dispatchEvent(new PointerEvent('pointerdown',base));
     svg.dispatchEvent(new PointerEvent('pointermove',{...base,clientY:r.y+120}));
     svg.dispatchEvent(new PointerEvent('pointerup',{...base,clientY:r.y+120}));
    });
    assert.equal(await page.evaluate(()=>JSON.stringify(state.sequence)),before);
   }
   if(!touch){
    const hit=page.locator('#drawingWrap .screw-hit').first();
    await hit.click();assert.equal(await page.evaluate(()=>state.selected),0);
    const count=await page.locator('#sequenceList .seq-row').count();
    const r=await hit.boundingBox(),svg=await page.locator('#drawingWrap > svg').boundingBox();
    await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();
    await page.mouse.move(r.x+r.width/2,svg.y+10,{steps:5});await page.mouse.up();
    assert.equal(await page.locator('#sequenceList .seq-row').count(),count-1,'desktop drag-out deletion');
   }
   for(const view of ['projects','components','inventory','settings']){
    await page.click(`.nav[data-view=${view}]`);await checkWidth(view);
   }
   await page.click('.nav[data-view=designer]');
   await page.click('#drawingInfoBtn');await checkWidth('drawing form');
   await page.click('.collapse');
   if(width===390||width===1440){
    await page.evaluate(()=>{document.querySelector('#componentSearch').value='kb-6-2-60-60度re';renderLibrary()});
    await page.waitForTimeout(3600);
    await page.screenshot({path:path.join(output,`layout-${width}.png`),fullPage:true});
    await page.locator('.palette-card').screenshot({path:path.join(output,`machine-${width}.png`)});
   }
   await page.evaluate(()=>renderReport());
   await page.emulateMedia({media:'print'});
   assert.equal(await page.locator('#printRoot .print-page').count(),3);
   assert.equal(await page.locator('main').isVisible(),false);
   assert.deepEqual(errors,[],`${width}: browser errors`);
   console.log(`PASS ${width}x${height}: both machines, vector previews, search, touch/click add/remove, tables, views, zoom, print`);
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
