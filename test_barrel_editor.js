'use strict';
// Start test_sandbox_server.py first. This test saves ONLY to its temporary DB.
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const fs=require('node:fs');
const url='http://127.0.0.1:8732';
(async()=>{
 const browser=await (process.env.BROWSER==='webkit'?webkit:chromium).launch();
 try{
  for(const width of [390,1440]){
   const context=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390,deviceScaleFactor:2});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.goto(url);await page.waitForFunction(()=>DATA.components.length===70);
   const read=()=>page.evaluate(()=>JSON.stringify(state.ports));
   for(const machine of ['50','60']){
    await page.evaluate(m=>newProject(m),machine);
    await page.click('#barrelCatalogBtn');
    assert.equal(await page.locator('.editable-barrel-card').count(),machine==='50'?8:7);
    const dims=await page.locator('.barrel-module-thumb').first().getAttribute('data-nominal-diameter');assert.equal(dims,machine);
    const D=await page.locator('#drawingWrap>svg').getAttribute('data-nominal-diameter');assert.equal(D,machine);
    const baseline=await page.locator('.barrel-row').count(),original=await read();
    const card=page.locator(`.editable-barrel-card[data-key="${machine}:barrel"]`);
    await card.locator('[data-barrel-action=add]').click();
    assert.equal(await page.locator('.barrel-row').count(),baseline+1);
    assert.equal(await page.locator('#drawingWrap [data-barrel-index]').count(),baseline+1);
    assert.equal(await page.evaluate(()=>barrelConfiguration().at(-1).mm-spec().barrel_length),machine==='50'?210:240);
    assert.ok(await page.evaluate(()=>calculate().barrel_warnings.length>0));
    await page.click('#barrelUndoBtn');assert.equal(await read(),original);
    await page.click('#barrelRedoBtn');assert.equal(await page.locator('.barrel-row').count(),baseline+1);
    await card.locator('[data-barrel-action=remove]').click();assert.equal(await page.locator('.barrel-row').count(),baseline);
    // Independent natural ports must not share the legacy natural4/natural7 flag.
    await page.locator(`.editable-barrel-card[data-key="${machine}:natural"] [data-barrel-action=add]`).click();
    await page.click('#barrelCloseBtn');assert.equal(await page.evaluate(()=>barrelConfiguration().at(-1).annotation),'CLOSED');
    await page.click('#barrelDuplicateBtn');
    assert.equal(await page.evaluate(()=>barrelConfiguration().at(-1).annotation),'CLOSED','copy preserves closed state');
    await page.locator('.barrel-row').last().click();await page.click('#barrelPortBtn');
    const open=await page.evaluate(()=>barrelConfiguration().slice(-2).map(x=>x.annotation));assert.deepEqual(open,['CLOSED','ATM']);
    const uid=await page.evaluate(()=>state.ports.barrel_layout.modules.at(-1).uid);
    await page.click('#barrelMoveUpBtn');assert.equal(await page.evaluate(()=>state.ports.barrel_layout.modules.at(-2).uid),uid);
    const config=await read();
    await page.evaluate(key=>addBarrel(key),machine==='50'?'60:barrel':'50:barrel');assert.equal(await read(),config,'cross-machine addition blocked');
    // Save dialog, actual API persistence, project reopen, JSON download/import.
    await page.click('#saveBtn');await page.fill('#approvalReason','Sandbox engineering review');await page.fill('#approvalCode','sandbox-only');
    await page.locator('#modalActions button').last().click();await page.waitForFunction(()=>state.id!==null);
    const id=await page.evaluate(()=>state.id),saved=await read();
    await page.reload();await page.waitForFunction(()=>DATA.components.length===70);
    await page.evaluate(pid=>projectAction('open',pid),id);assert.equal(await read(),saved);
    const downloadPromise=page.waitForEvent('download');await page.click('#jsonBtn');const download=await downloadPromise;
    const raw=fs.readFileSync(await download.path(),'utf8');assert.equal(JSON.stringify(JSON.parse(raw).project.ports),saved);
    await page.locator('#importFile').setInputFiles({name:'barrel-project.json',mimeType:'application/json',buffer:Buffer.from(raw)});
    await page.locator('#modalActions button').last().click();await page.waitForFunction(()=>state.id===null);assert.equal(await read(),saved);
    await page.evaluate(()=>renderReport());assert.equal(await page.locator('#printRoot .page-three .config-tables [data-barrel-index]').count(),0);
    assert.equal(await page.locator('#printRoot .page-one [data-barrel-index]').count(),await page.locator('.barrel-row').count());
    const beforeClear=await read();await page.click('#barrelClearBtn');assert.equal(await page.locator('.barrel-row').count(),0);
    assert.ok((await page.locator('#barrelLayoutNotice').textContent()).includes('机筒配置为空'));
    await page.click('#barrelUndoBtn');assert.equal(await read(),beforeClear);
    await page.click('#barrelResetBtn');assert.equal(await page.locator('.barrel-row').count(),baseline);
    assert.equal(await page.evaluate(()=>state.ports.barrel_layout??null),null);
    await page.click('#barrelCatalogBtn');await page.locator(`.editable-barrel-card[data-key="${machine}:side"] [data-barrel-action=add]`).click();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth);assert.ok(overflow<=width+1);
    await page.waitForTimeout(3600);
    if(machine==='60')await page.screenshot({path:`/tmp/screw-responsive/barrel-edit-${width}.png`,fullPage:true});
   }
   assert.deepEqual(errors,[]);console.log(`PASS ${width}: machine-isolated add/remove/reorder/copy, independent ports, undo/redo, save/reopen, JSON import/export, drawing/print, clear/reset`);
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
