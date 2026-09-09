'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const width of [390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:950},isMobile:width<1000,hasTouch:width<1000}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto('http://127.0.0.1:8732');await page.waitForFunction(()=>DATA.components.length===70);
  for(const machine of ['50','60']){
   await page.evaluate(m=>newProject(m),machine);await page.click('#barrelPlanBtn');await page.fill('#planSections','13');await page.click('#suggestScrew');await page.locator('#modalActions button').last().click();
   const state=await page.evaluate(()=>({s:BarrelModels.summary(state.machine,spec(),state.ports),target:calculate().target}));
   assert.equal(state.s.sections,13);assert.equal(state.s.process_d,52);assert.equal(state.target,machine==='50'?2800:3210);
   await page.click('#barrelCatalogBtn');assert.equal(await page.locator('[data-install-cap]').count(),4);
   await page.locator(`.editable-barrel-card[data-key="${machine}:side_vacuum"] [data-barrel-action=add]`).click();
   await page.click('#barrelConfigureBtn');await page.fill('#barrelLength','120');await page.selectOption('#barrelCap','closed');await page.locator('#modalActions button').last().click();
   assert.equal(await page.evaluate(()=>barrelConfiguration()[state.selectedBarrel].length),120);
   assert.equal(await page.locator('#drawingWrap [data-port-role=side_vacuum][data-cap=closed]').count(),1);
   await page.click('#barrelConfigureBtn');await page.selectOption('#barrelRole',machine+':vacuum');await page.selectOption('#barrelCap','inject');await page.locator('#modalActions button').last().click();
   assert.equal(await page.locator('#drawingWrap [data-cap=inject] [data-liquid]').count(),1);
   assert.ok(await page.evaluate(()=>calculate().zones.some(z=>z.section===state.selectedBarrel+1)));
   await page.locator('[data-install-cap=closed][data-cap-roles="vacuum,natural,feed"]').click();
   assert.equal(await page.evaluate(()=>barrelConfiguration()[state.selectedBarrel].cap),'closed');
   await page.click('#barrelUndoBtn');assert.equal(await page.evaluate(()=>barrelConfiguration()[state.selectedBarrel].cap),'inject');
   // Persist the extended proposal only to the disposable sandbox database.
   await page.click('#saveBtn');await page.fill('#approvalReason','Sandbox extended layout');await page.fill('#approvalCode','sandbox-only');await page.locator('#modalActions button').last().click();await page.waitForFunction(()=>state.id!==null);
   const id=await page.evaluate(()=>state.id),saved=await page.evaluate(()=>JSON.stringify(state.ports));
   await page.reload();await page.waitForFunction(()=>DATA.components.length===70);await page.evaluate(id=>projectAction('open',id),id);assert.equal(await page.evaluate(()=>JSON.stringify(state.ports)),saved);
   await page.evaluate(()=>renderReport());assert.equal(await page.locator('#printRoot .page-one [data-cap=inject]').count(),1);
   const promise=page.waitForEvent('download');await page.click('#xlsxBtn');const download=await promise;assert.ok(fs.statSync(await download.path()).size>1000);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  assert.deepEqual(errors,[]);console.log(`PASS ${width}: 52D/13 sections, proposed shaft lengths, side vacuum, custom length, compatible caps, injection restrictions, undo, save/reopen, Excel/print`);await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto('http://127.0.0.1:8732/login');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'/tmp/kingpolymer-login-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'/tmp/kingpolymer-login-desktop.png',fullPage:true});
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
