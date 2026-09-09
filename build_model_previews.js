'use strict';
// Contact sheets for the unapproved full-model parameter preview, not production assets.
const fs=require('node:fs'),path=require('node:path');
const M=require('./static/component-models.js'),seed=require('./data/seed.json');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const machine of ['50','60']){
 const list=seed.components.filter(c=>c.machine===machine),cols=4,cw=230,ch=140,h=90+Math.ceil(list.length/cols)*ch;
 let body=`<rect width="940" height="${h}" fill="white"/><text x="15" y="26" font-size="18" font-weight="bold">kingpolymer | ZSE ${machine}CC | ${list.length} source records</text><text x="15" y="49" font-size="11" fill="#846629">PARAMETRIC PREVIEW - SHAPES AWAIT DRAWING REVIEW - NOT MANUFACTURING CAD</text>`;
 list.forEach((c,i)=>{const m=M.model(c),x=10+i%cols*cw,y=70+Math.floor(i/cols)*ch,D=seed.machines[machine].diameter,scale=Math.min((cw-25)/(m.length+4),80/(D+4)),inner=M.symbol(c,seed.machines[machine],{id:'sheet-'+c.id}).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
  body+=`<rect x="${x}" y="${y}" width="${cw-5}" height="${ch-5}" fill="white" stroke="#d1dce3"/><g transform="translate(${x+(cw-5-m.length*scale)/2} ${y+6+(80-D*scale)/2}) scale(${scale})">${inner}</g><text x="${x+cw/2-2}" y="${y+103}" font-size="11" font-weight="bold" text-anchor="middle">${esc(m.label)}</text><text x="${x+cw/2-2}" y="${y+121}" font-size="9" fill="#536673" text-anchor="middle">L=${m.length} mm${m.discs?' | N='+m.discs:''}${m.pitch?' | P='+m.pitch+' mm':''}${m.angle!=null?' | stagger='+m.angle+'°':''}${m.direction?' | '+m.direction:''}</text>`;
 });
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 940 ${h}" font-family="Arial,sans-serif">${body}</svg>`;
 const dest=path.join(__dirname,'图形审核',`完整型号参数示意-${machine}CC.svg`);
 fs.writeFileSync(dest,svg);console.log(dest);
}
