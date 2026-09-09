'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch();try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const origin='http://127.0.0.1:8732';await page.goto(origin);assert.ok(page.url().endsWith('/login'));
 const login=async password=>{await page.fill('#username','kingpolymer');await page.fill('#password',password);await page.click('#loginSubmit');await page.waitForFunction(()=>typeof DATA!=='undefined'&&DATA.components.length===70)};
 await login('sandbox-login-alpha');
 assert.ok(await page.evaluate(()=>DATA.auth.csrf.length>20));
 await page.click('#saveBtn');await page.fill('#approvalReason','Authenticated sandbox test');await page.fill('#approvalCode','sandbox-only');await page.locator('#modalActions button').last().click();await page.waitForFunction(()=>state.id!==null);
 await page.click('.nav[data-view=settings]');await page.waitForFunction(()=>!document.querySelector('#passwordForm').hidden);
 await page.fill('#passwordForm [name=old_password]','sandbox-login-alpha');await page.fill('#passwordForm [name=new_password]','sandbox-login-beta');await page.fill('#passwordForm [name=confirm_password]','sandbox-login-beta');await page.click('#passwordForm button');await page.waitForURL('**/login');
 await page.fill('#password','sandbox-login-alpha');await page.click('#loginSubmit');await page.waitForFunction(()=>document.querySelector('#loginError').textContent.includes('不正确'));
 await login('sandbox-login-beta');await page.click('.nav[data-view=settings]');await page.click('#logoutBtn');await page.waitForURL('**/login');
 assert.deepEqual(errors,[]);console.log('PASS: mobile branded form login, CSRF-authenticated project save, password change, old-password rejection, new-password login, logout');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
