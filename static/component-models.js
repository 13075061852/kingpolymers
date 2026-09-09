/* Full-model parsing and parameterized engineering symbols.
 * Display names are normalized; raw names/IDs remain untouched for persistence.
 * Symbols follow the approved manual's 2D visual language. They illustrate the
 * entered parameters, not certified Erdmenger profiles or manufacturing CAD.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ComponentModels=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const clean=s=>String(s||'').normalize('NFKC').toUpperCase().replace(/[−–—]/g,'-').replace(/度/g,'°').replace(/\s+/g,'');
 const colors={GFA:'#111111',GFF:'#c99516',KB:'#173ad4',KBX:'#173ad4',GFM:'#188842',SME:'#188842',KS:'#6642a0',Spacer:'#596973'};
 function parse(name){
  const raw=String(name||''),s=clean(raw);let m,result={raw,type:'OTHER',label:raw,length:null,pitch:null,discs:null,lobes:null,angle:null,direction:'',suffix:'',valid:false};
  if((m=s.match(/^(KBX?)-?(\d+)-(\d+)-(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)(?:°)?-?(RE|LI|L)?$/))){
   Object.assign(result,{type:m[1],discs:+m[2],lobes:+m[3],length:+m[4],angle:+m[5],direction:m[6]==='L'?'LI':m[6]||''});
   result.label=`${result.type}-${result.discs}-${result.lobes}-${result.length}-${result.angle}°${result.direction?'-'+result.direction:''}`;
  }else if((m=s.match(/^(GFA|GFF|GFM|SME)-(\d+)-(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)(.*)$/))){
   const suffix=m[5];Object.assign(result,{type:m[1],lobes:+m[2],pitch:+m[3],length:+m[4],suffix,direction:/^-?(L|LI)$/.test(suffix)?'LI':/^-?RE$/.test(suffix)?'RE':''});
   result.label=`${m[1]}-${+m[2]}-${+m[3]}-${+m[4]}${suffix}`;
  }else if((m=s.match(/^KS-?(\d+)-(\d+)-(\d+(?:\.\d+)?)-(A\/E|AE|M|A|E)(\(\d+\))?$/))){
   Object.assign(result,{type:'KS',lobes:+m[2],discs:1,length:+m[3],suffix:(m[4]==='AE'?'A/E':m[4])+(m[5]||'')});result.label=`KS-${+m[1]}-${+m[2]}-${+m[3]}-${result.suffix}`;
  }else if((m=s.match(/^SPACER-X-XX-(\d+(?:\.\d+)?)$/))){Object.assign(result,{type:'Spacer',length:+m[1],label:`Spacer-X-XX-${+m[1]}`});}
  result.valid=result.length>0&&result.length<=2000&&(!result.discs||(result.discs>0&&result.discs<=100))&&(!result.angle||result.angle<=180);
  return result;
 }
 function model(component){
  const c=typeof component==='string'?{name:component}:component,p=parse(c.name);
  const mismatches=[];
  for(const key of ['length','pitch','discs','angle'])if(p[key]!=null&&c[key]!=null&&Number(c[key])!==p[key])mismatches.push(`${key}: 型号${p[key]} / 库${c[key]}`);
  return {...p,id:c.id||'',machine:c.machine||'',mismatches};
 }
 function searchKey(name){return clean(parse(name).label).replace(/[^A-Z0-9.]/g,'');}
 function matches(c,query){return searchKey(c.name).includes(searchKey(query));}
 function describe(c){const p=model(c),a=[p.length!=null?`长度 ${p.length} mm`:''];if(p.discs!=null)a.push(`${p.discs}片`);if(p.lobes!=null)a.push(`${p.lobes}头/叶`);if(p.pitch!=null)a.push(`导程 ${p.pitch} mm`);if(p.angle!=null)a.push(`错位角 ${p.angle}°`);if(p.angle===90)a.push('中性错位角');else if(p.direction)a.push(p.direction==='LI'?'LI 反向':'RE 正向');return a.filter(Boolean).join(' · ');}
 function n(x){return Number(x.toFixed(3));}
 function symbol(c,spec={},options={}){
  const p=model(c),D=Number(spec.diameter)||60,L=p.length||60,ink=colors[p.type]||'#888',id='model-'+String(options.id||p.id||p.label).replace(/[^a-zA-Z0-9_-]/g,'_');
  const pad=options.pad===undefined?2:Number(options.pad),W=L+pad*2,H=D+pad*2;
  if(!p.valid)return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><text x="50" y="30" text-anchor="middle" font-size="10">待核对型号</text></svg>`;
  let art='';const line=D*(options.thumbnail?.018:.012);
  if(p.type==='KB'||p.type==='KBX'){
   const step=L/p.discs,minor=D*.29,R=D*.47;
   // Independent axial disc widths = total length / disc count. Heights follow
   // the stagger angle, never reuse a 30° sprite for a 45° model.
   for(let i=0;i<p.discs;i++){
    const theta=i*p.angle*Math.PI/180,r=Math.sqrt((R*Math.cos(theta))**2+(minor*Math.sin(theta))**2),x=i*step,y=D/2-r;
    const groove=Math.min(step*.16,D*.018);
    art+=`<g data-disc="${i+1}" data-phase="${n(i*p.angle%180)}"><path d="M${n(x)} ${n(y+groove)}H${n(x+groove)}V${n(y)}H${n(x+step-groove)}V${n(y+groove)}H${n(x+step)}V${n(D-y-groove)}H${n(x+step-groove)}V${n(D-y)}H${n(x+groove)}V${n(D-y-groove)}H${n(x)}Z" fill="white" stroke="${ink}" stroke-width="${n(line)}"/><path d="M${n(x+groove)} ${n(y+D*.075)}H${n(x+step-groove)}M${n(x+groove)} ${n(D-y-D*.075)}H${n(x+step-groove)}" fill="none" stroke="${ink}" stroke-width="${n(line*.65)}"/></g>`;
   }
  }else if(['GFA','GFF','GFM','SME'].includes(p.type)){
   const period=p.pitch/p.lobes,depth=D*.11,top=D*.035,bottom=D*.965,shift=period*.66,thickness=Math.min(period*.105,D*.027);
   if(!(period>0)||L/period>500)return '';
   let a=`M${-period} ${top}`;
   for(let k=-1;k<Math.ceil(L/period)+1;k++){const x=k*period;a+=` Q${n(x+period*.5)} ${n(top+depth*2)} ${n(x+period)} ${n(top)}`;}
   const right=(Math.ceil(L/period)+1)*period;
   a+=`L${n(right+shift)} ${n(bottom)}`;
   for(let k=Math.ceil(L/period);k>=-2;k--){const x=k*period+shift;a+=` Q${n(x+period*.5)} ${n(bottom-depth*2)} ${n(x)} ${n(bottom)}`;}
   a+='Z';
   art+=`<path d="${a}" fill="white" stroke="${ink}" stroke-width="${n(line)}"/>`;
   for(let k=-2;k<Math.ceil(L/period)+1;k++){
    const x=k*period;
    art+=`<path data-flight="${k}" d="M${n(x)} ${n(top)}L${n(x+shift)} ${n(bottom)}L${n(x+shift+thickness)} ${n(bottom)}L${n(x+thickness)} ${n(top)}Z" fill="white" stroke="${ink}" stroke-width="${n(line*.85)}"/>`;
    if(['GFM','SME'].includes(p.type)){
     const cx=x+shift*.5,cy=D/2,r=Math.min(period*.2,D*.1);
     art+=`<path data-slot="${k}" d="M${n(cx-r)} ${n(cy-r)}Q${n(cx)} ${n(cy-r*2.3)} ${n(cx+r)} ${n(cy+r)}Q${n(cx)} ${n(cy+r*2.3)} ${n(cx-r)} ${n(cy-r)}Z" fill="white" stroke="${ink}" stroke-width="${n(line)}"/>`;
    }
   }
   // End-face bounds follow the same scallops; do not leave open, dangling ends.
   const scallop=x=>{const t=((x%period)+period)%period/period;return 4*depth*t*(1-t)};
   for(const x of [0,L])art+=`<path data-end-face="${x}" d="M${x} ${n(top+scallop(x))}V${n(bottom-scallop(x-shift))}" fill="none" stroke="${ink}" stroke-width="${n(line)}"/>`;
   // GFF relief dimensions and mixing-slot dimensions are not supplied by the
   // model name; these remain illustrative and require a source drawing check.
  }else{
   // Single kneading discs/spacers have no inferred helix or borrowed KB angle.
   art=`<rect data-disc="1" x="0" y="${n(D*.06)}" width="${L}" height="${n(D*.88)}" fill="white" stroke="${ink}" stroke-width="${n(line)}"/>`;
  }
  const flip=p.direction==='LI'&&p.angle!==90?`translate(${L} 0) scale(-1 1)`:'';
  let clipped=`<g clip-path="url(#${id})"><g${flip?` transform="${flip}"`:''}>${art}</g></g>`;
  const axes=`<path d="M0 ${n(D/2)}H${n(L)}" fill="none" stroke="${ink}" stroke-width="${n(line*.65)}" stroke-dasharray="${n(D*.36)} ${n(D*.055)} ${n(D*.055)} ${n(D*.055)}"/>`;
  const layout=options.layout||'';
  return `<svg xmlns="http://www.w3.org/2000/svg" ${layout} viewBox="${-pad} ${-pad} ${n(W)} ${n(H)}" preserveAspectRatio="${options.stretch?'none':'xMidYMid meet'}" data-model="${esc(p.label)}" data-length="${L}" data-discs="${p.discs||''}" data-angle="${p.angle??''}" data-direction="${p.direction}" data-rendering="parameterized-manual-style"><title>${esc(p.label+' | '+describe(c)+' | 参数化工程示意，非制造CAD')}</title><defs><clipPath id="${id}"><rect x="0" y="0" width="${L}" height="${D}"/></clipPath></defs>${clipped}${axes}</svg>`;
 }
 return {parse,model,searchKey,matches,describe,symbol,colors};
});
