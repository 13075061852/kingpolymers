import {test,expect} from '@playwright/test';
test('screw head follows last element without adding length',async({page})=>{
 await page.goto('/');await expect(page.locator('.drawing .screw-tip')).toHaveCount(0);
 await page.getByRole('button',{name:'加入 GFA-2-30-30',exact:true}).click();
 await expect(page.locator('.drawing .screw-tip')).toBeVisible();
 await expect(page.locator('.sequence-row')).toHaveCount(1);
 const d=await page.locator('.screw-tip').getAttribute('d');
 await page.getByRole('button',{name:'加入 GFA-2-30-30',exact:true}).click();
 expect(await page.locator('.screw-tip').getAttribute('d')).not.toBe(d);
 await page.screenshot({path:'runtime/ui-checks/screw-tip.png'});
});
