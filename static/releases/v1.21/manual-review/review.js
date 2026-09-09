'use strict';
// Visual-review sandbox. No writes to /api/projects, /api/components or inventory.
const q=s=>document.querySelector(s);
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const review={machine:'50',ports:{natural4:true,natural7:true},selected:-1,symbol:null,tile:130};
let catalog={items:[]},machines={};
const Models=typeof ComponentModels!=='undefined'?ComponentModels:(typeof require==='function'?require('../component-models.js'):null);
function makeCatalog(components,manualItems,audit=[]){return components.map(c=>{const m=Models.model(c);const reference=manualItems.find(x=>x.machine===c.machine&&x.kind===c.type&&(m.pitch==null||x.parameters.pitch===m.pitch)&&(m.angle==null||x.parameters.angle===m.angle)&&(m.direction!=='LI'||x.parameters.direction==='LI'));return {...c,label:m.label,kind:c.type,parameters:m,reference:reference||null,audit:audit.find(a=>a.id===c.id&&a.machine===c.machine&&a.raw===c.name)||null}})}
function rowState(row,ports){return row.role==='natural'?(ports[row.port_key]?'ATM':'堵头封闭'):{feed:'喂料口',side:'侧喂（固定）',vacuum:'VAC（固定）',heat:'热隔断',flange:'法兰',barrel:'封闭机筒'}[row.role]||''}
function barrelGeometry(spec,ports,selected=-1){
 const rows=spec.barrel_configuration,right=1160,left=60,scale=(right-left)/spec.barrel_length;
 let body='',start=0;
 for(let i=0;i<rows.length;i++){
  const row=rows[i],end=row.mm,x=right-end*scale,w=(end-start)*scale,cx=x+w/2;
  const opening=row.role==='feed'||row.role==='vacuum'||(row.role==='natural'&&ports[row.port_key]);
  let shape='';
  if(row.role==='heat'||row.role==='flange'){
   shape=`<rect x="${x}" y="83" width="${Math.max(w,1)}" height="79" fill="#c3c3c3" stroke="#222" stroke-width=".7"/><rect x="${x}" y="111" width="${Math.max(w,1)}" height="27" fill="white"/>`;
  }else{
   shape=`<rect x="${x}" y="91" width="${w}" height="20" fill="#bbb" stroke="#222" stroke-width=".8"/><rect x="${x}" y="138" width="${w}" height="20" fill="#bbb" stroke="#222" stroke-width=".8"/><rect x="${x+2}" y="158" width="${Math.max(1,w-4)}" height="5" fill="#777" stroke="#222" stroke-width=".6"/>`;
   if(row.role==='barrel')shape+=`<rect x="${x+2}" y="84" width="${Math.max(1,w-4)}" height="7" fill="#777" stroke="#222" stroke-width=".7"/>`;
   if(row.role==='natural'&&!opening){
    shape+=`<path d="M${cx-17} 84h34v7h-5v20h-24V91h-5z" fill="#909090" stroke="#222" stroke-width=".8"/><line x1="${cx-20}" y1="83" x2="${cx-14}" y2="83" stroke="#222" stroke-width="2"/><line x1="${cx+14}" y1="83" x2="${cx+20}" y2="83" stroke="#222" stroke-width="2"/>`;
   }
   if(opening){
    const ink=row.role==='feed'?'#df1616':'#1c35e0';
    shape+=`<rect x="${cx-15}" y="91" width="30" height="20" fill="white" stroke="#222" stroke-width=".7"/>`;
    shape+=row.role==='feed'?`<path d="M${cx} 94v13m-5-5l5 5 5-5" stroke="${ink}" stroke-width="2.5" fill="none"/>`:`<path d="M${cx} 108V95m-5 5l5-5 5 5" stroke="${ink}" stroke-width="2.5" fill="none"/>`;
   }
   if(row.role==='side'){
    const sw=w*.42;
    for(const y of [106,138]){
     shape+=`<rect x="${cx-sw/2}" y="${y}" width="${sw}" height="5" fill="white" stroke="#a32a2a" stroke-width=".7"/>`;
     for(let dx=0;dx+5<=sw;dx+=5){const hx=cx-sw/2+dx;shape+=`<path d="M${hx} ${y}l5 5m-5 0l5-5" stroke="#c44" stroke-width=".65" fill="none"/>`}
    }
   }
  }
  body+=`<g data-row="${i}" style="cursor:pointer"><title>${row.pos} · ${escapeHTML(row.name)} · ${start}–${end} mm · ${rowState(row,ports)}</title>${shape}<text x="${cx}" y="72" font-size="10" font-family="Arial" text-anchor="middle">${row.pos}</text><rect x="${x}" y="80" width="${Math.max(3,w)}" height="86" fill="#ffffff" fill-opacity="0" pointer-events="all" stroke="${selected===i?'#4576c8':'none'}" stroke-width="1.5"/></g>`;
  start=end;
 }
 let axis=`<path d="M${left} 215H${right}" stroke="#111" stroke-width="1"/>`;
 for(let mm=0;mm<=spec.barrel_length;mm+=500){const x=right-mm*scale;axis+=`<path d="M${x} 212v9" stroke="#111"/><text x="${x}" y="234" text-anchor="middle" font-size="10">${mm}</text>`}
 axis+=`<text x="${left}" y="248" fill="#999" font-size="10">${spec.barrel_length}</text><text x="${right}" y="206" text-anchor="end" font-size="10">[mm]</text>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 255"><rect width="1200" height="255" fill="white"/>${body}${axis}</svg>`;
}
function message(text){q('#feedback').textContent=text;q('#feedback').style.display='block';clearTimeout(message.timer);message.timer=setTimeout(()=>q('#feedback').style.display='none',4000)}
function paintBarrel(){
 const s=machines[review.machine],rows=s.barrel_configuration;
 q('#dimensions').textContent=`${s.name} · 12 × ${s.section_length} mm · 总坐标 ${s.barrel_length} mm · 螺杆为空`;
 q('#barrelDrawing').innerHTML=barrelGeometry(s,review.ports,review.selected);
 q('#barrelRows').innerHTML=rows.map((r,i)=>`<tr data-index="${i}" class="${i===review.selected?'selected':''}"><td>${r.pos}</td><td>${r.mm}</td><td>${escapeHTML(r.name)}</td><td>${rowState(r,review.ports)}</td></tr>`).join('');
 q('#togglePort').disabled=!rows[review.selected]?.port_key;
 q('#natural4').checked=review.ports.natural4;q('#natural7').checked=review.ports.natural7;
 for(const el of document.querySelectorAll('[data-index],[data-row]')){
  const i=Number(el.dataset.index??el.dataset.row);
  el.onclick=()=>{review.selected=i;paintBarrel()};
  el.ondblclick=()=>{review.selected=i;togglePort()};
 }
 q('#barrelSource').href=`assets/${review.machine}-barrel-page26.png`;
 q('#plugSource').href=`assets/${review.machine}-barrel-page28.png`;
}
function togglePort(){const row=machines[review.machine].barrel_configuration[review.selected];if(!row?.port_key){message('固定部件：仅第4、7节自然排气口可切换');return}review.ports[row.port_key]=!review.ports[row.port_key];paintBarrel();message(`${row.pos} · ${rowState(row,review.ports)}（仅预览）`)}
function paintGallery(){
 const text=q('#search').value.trim().toLowerCase(),kind=q('#kind').value;
 const items=catalog.items.filter(x=>x.machine===review.machine&&(!kind||x.kind===kind)&&Models.matches(x,text));
 q('#catalogCount').textContent=`${items.length} / ${catalog.items.filter(x=>x.machine===review.machine).length} 型号`;
 q('#gallery').style.setProperty('--tile',`${review.tile}px`);
 q('#gallery').innerHTML=items.map(x=>`<button class="element ${x.id===review.symbol?'selected':''}" data-symbol="${x.id}" title="${escapeHTML(x.label+' | '+Models.describe(x))}">${Models.symbol(x,machines[x.machine],{id:'review-'+x.id,layout:'class="model-svg"'})}<span>${escapeHTML(x.label)}</span><small>${escapeHTML(Models.describe(x))}</small></button>`).join('')||'<p>无匹配型号</p>';
 for(const el of document.querySelectorAll('[data-symbol]'))el.onclick=()=>showSymbol(el.dataset.symbol);
}
function showSymbol(id){
 const x=catalog.items.find(x=>x.id===id);if(!x)return;review.symbol=id;paintGallery();
 const m=x.parameters,r=x.reference,a=x.audit;
 const sourceInfo=a?`<div class="model-source"><b>完整型号文字核对：${escapeHTML(a.name_status)}</b>${a.drawing_matches.slice(0,3).map(s=>`<p>${escapeHTML(s.file)}<br>第 ${s.pages.join(' / ')} 页 · 原文：${escapeHTML(s.source_models.join(' / '))}</p>`).join('')}${!a.drawing_matches.length?`<p>${a.templates.slice(0,2).map(t=>`${escapeHTML(t.name)} · 位置 ${t.positions.join(', ')}`).join('<br>')}</p>`:''}<small>只核对名称和参数含义，外形仍待逐型号终核。</small></div>`:'<p>未找到当前型号的核对记录（可能是自定义或已修改型号）。</p>';
 q('#comparison').innerHTML=`<h3>${escapeHTML(x.label)} · ${x.machine}CC</h3><div class="side-by-side"><figure>${r?`<img src="${r.source}" alt="手册结构参考"><figcaption>手册第${r.page}页 · 结构参考（未标注完整长度）</figcaption>`:'<div class="missing-reference">手册未列出该参数的独立图。<br>不以邻近角度代替。</div>'}</figure><figure>${Models.symbol(x,machines[x.machine],{id:'detail-'+x.id,layout:'class="detail-symbol"'})}<figcaption>完整型号参数图 · 非制造CAD</figcaption></figure></div><div class="detail"><b>${escapeHTML(Models.describe(x))}</b><br>原始型号：<code>${escapeHTML(x.name)}</code>${m.discs?`<br>单片厚度：${(m.length/m.discs).toFixed(2)} mm`:''}<br>2 = 双头／双叶结构；KB角度 = 相邻片错位角，不是导程。${m.angle===90?'<br>90°为中性错位角；型号中的原方向后缀仍保留。':''}<br>图形根据完整型号的长度、导程或片数、角度、方向生成，不将同一图片拉伸到所有型号。${!r?'<br><strong>该参数图仍需对应实图终核。</strong>':''}${m.mismatches.length?`<br><strong>库参数差异：${escapeHTML(m.mismatches.join('；'))}</strong>`:''}</div>${sourceInfo}`;
}
async function initReview(){
 try{
  const responses=await Promise.all([fetch('manifest.json',{cache:'no-store'}),fetch('/api/bootstrap',{cache:'no-store'}),fetch('model-audit.json',{cache:'no-store'})]);
  if(responses.some(r=>!r.ok))throw Error('资料读取失败');
  const [manifest,data,audit]=await Promise.all(responses.map(r=>r.json()));catalog={manualItems:manifest.items,items:makeCatalog(data.components,manifest.items,audit.models)};machines=data.machines;
  q('#machine').onchange=()=>{review.machine=q('#machine').value;review.selected=-1;review.ports={natural4:true,natural7:true};paintBarrel();showSymbol(catalog.items.find(x=>x.machine===review.machine).id)};
  q('#search').oninput=q('#kind').onchange=paintGallery;
  q('#larger').onclick=()=>{review.tile=Math.min(210,review.tile+20);paintGallery()};q('#smaller').onclick=()=>{review.tile=Math.max(90,review.tile-20);paintGallery()};
  for(const key of ['natural4','natural7'])q('#'+key).onchange=()=>{review.ports[key]=q('#'+key).checked;paintBarrel()};
  q('#resetPorts').onclick=()=>{review.ports={natural4:true,natural7:true};paintBarrel()};q('#togglePort').onclick=togglePort;
  for(const [id,step] of [['prevRow',-1],['nextRow',1]])q('#'+id).onclick=()=>{const count=machines[review.machine].barrel_configuration.length;review.selected=(review.selected+step+count)%count;paintBarrel()};
  q('#checkBarrel').onclick=()=>{const s=machines[review.machine],rows=s.barrel_configuration;const ok=rows.at(-1).mm===s.barrel_length&&rows.every((r,i)=>i===0||r.mm>rows[i-1].mm);message(ok?`位置及总坐标通过：${rows.length}位置 / ${s.barrel_length} mm；开口位置固定`:'机筒数据异常')};
  paintBarrel();showSymbol(catalog.items.find(x=>x.machine===review.machine).id);
 }catch(e){q('#comparison').textContent=e.message;message(e.message)}
}
// Pure renderer is also exercised by test_manual_review.py through Node.
if(typeof module!=='undefined')module.exports={barrelGeometry,rowState,makeCatalog};
if(typeof document!=='undefined')initReview();
