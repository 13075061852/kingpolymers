/* UI and drawing integration; all additions/removals are project-local. */
function barrelModuleSVG(item){
 const D=item.nominal_diameter,L=Math.max(1,Math.min(Number(item.length)||1,1000)),scale=22/D,visualL=L*scale,W=Math.max(132,visualL+24),x=(W-visualL)/2,y=48;
 return `<svg class="barrel-module-thumb" viewBox="0 0 ${W} 120" role="img" data-machine="${item.machine}" data-nominal-diameter="${D}"><title>${esc(item.name)} · ${item.machine}机 · 机型直径规格 ${D} mm · L ${L} mm；非加工尺寸</title>${BarrelVisuals.module(item,x,visualL,y,22)}<path d="M${x} ${y+11}h${visualL}" stroke="#71838c" stroke-dasharray="8 3 2 3"/></svg>`;
}
function showBarrelModule(item){openModal(`${item.name} · ${state.machine}机`,`<div class="model-detail-preview">${barrelModuleSVG(item)}</div><dl class="model-details"><dt>所属机型</dt><dd>${esc(spec().name)}</dd><dt>功能</dt><dd>${barrelRoleName(item.role)}</dd><dt>轴向节长</dt><dd>${item.length} mm</dd><dt>机型直径规格</dt><dd>${item.nominal_diameter} mm（用于区分机型，不是单个元件实测值）</dd><dt>手册参考直径</dt><dd>螺杆 ${MachineDimensions.refs[state.machine].screw} mm；啮合螺纹块 ${MachineDimensions.refs[state.machine].intermeshing} mm；机筒 ${MachineDimensions.refs[state.machine].barrel} mm</dd><dt>单型号尺寸与公差</dt><dd>以制造图纸和实测验收为准，不根据机型号推算</dd></dl><p class="warn-box">模块仅允许加入本机型；示意图不代表机筒壁厚或配合间隙。改变总长后不会自动延长螺杆轴，生产前必须工程复核。</p>`,[{label:'加入机筒',primary:true,click:()=>{closeModal();addBarrel(item.key)}},{label:'关闭',click:closeModal}])}
function barrelRoleName(role){return {barrel:'普通机筒',feed:'主喂料',natural:'顶部自然排气',vacuum:'顶部真空',side:'侧喂料',side_vacuum:'侧抽真空',flange:'连接法兰',heat:'隔热片'}[role]||role}
function renderBarrelCatalog(query=''){
 const items=BarrelModels.catalog(spec()).filter(x=>`${x.name} ${barrelRoleName(x.role)} ${x.machine}`.toLowerCase().includes(query.toLowerCase()));
 $('#componentLibrary').innerHTML=MachineDimensions.libraryNote(state.machine)+items.map(x=>`<div class="machine-part-card editable-barrel-card" data-key="${x.key}" draggable="true" tabindex="0" title="${esc(x.name)}：点击加入机筒">${barrelModuleSVG(x)}<b>${esc(x.name)}</b><small>${barrelRoleName(x.role)} · ${state.machine}机<br>节长 ${x.length} mm · ${state.machine}机专用</small><span class="barrel-card-actions"><button data-barrel-action="info" title="尺寸与机型说明">i</button><button data-barrel-action="add" title="加入机筒">＋</button><button data-barrel-action="remove" title="从组合删除最后一个同型号机筒">−</button></span></div>`).join('');
 $$('.editable-barrel-card').forEach(el=>{
  const item=items.find(x=>x.key===el.dataset.key);
  el.onclick=e=>{if(el.dataset.dragging)return;const action=e.target.closest('[data-barrel-action]')?.dataset.barrelAction;if(action==='info')showBarrelModule(item);else if(action==='remove')removeBarrelByKey(item.key);else addBarrel(item.key)};
  el.onkeydown=e=>{if(e.target===el&&['Enter',' '].includes(e.key)){e.preventDefault();addBarrel(item.key)}};
  el.oncontextmenu=e=>{e.preventDefault();removeBarrelByKey(item.key)};
  el.ondragstart=e=>{el.dataset.dragging='1';e.dataTransfer.setData('application/x-barrel-key',item.key);e.dataTransfer.effectAllowed='copy'};
  el.ondragend=()=>setTimeout(()=>delete el.dataset.dragging,0);
 });
 appendCapCatalog();
}
function editBarrels(action){
 try{const layout=BarrelModels.materialize(state.machine,spec(),state.ports),before=new Map(layout.modules.map(x=>[x.uid,{...x}]));action(layout.modules,layout);for(const m of layout.modules){const old=before.get(m.uid);if(old&&m.open!==old.open&&m.cap===old.cap)m.cap=m.open?'open':'closed'}const next=BarrelModels.normalize(state.machine,spec(),layout);pushHistory();state.ports={...state.ports,barrel_layout:next};state.selectedBarrel=Math.min(state.selectedBarrel,next.modules.length-1);renderDesign();}
 catch(e){toast(e.message,true)}
}
function barrelUid(){return 'b-'+(globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`)}
function addBarrel(key,at=null){
 if(!BarrelModels.catalog(spec()).some(x=>x.key===key))return toast('不能混用50机与60机的机筒模块',true);
 if(barrelConfiguration().length>=BarrelModels.MAX_MODULES)return toast(`最多${BarrelModels.MAX_MODULES}个机筒模块`,true);
 const index=at??(state.selectedBarrel>=0?state.selectedBarrel+1:barrelConfiguration().length);
 editBarrels(xs=>xs.splice(Math.max(0,Math.min(xs.length,index)),0,{key,uid:barrelUid(),open:true}));state.selectedBarrel=index;renderBarrelList();renderDrawing();toast('机筒模块已加入；需复核总长和开口位置');
}
function removeBarrel(index=state.selectedBarrel){if(index<0||index>=barrelConfiguration().length)return toast('请先选择机筒模块',true);editBarrels(xs=>xs.splice(index,1));toast('已从当前机筒配置移除，模块库保留')}
function removeBarrelByKey(key){const layout=BarrelModels.materialize(state.machine,spec(),state.ports);let i=state.selectedBarrel>=0&&layout.modules[state.selectedBarrel]?.key===key?state.selectedBarrel:layout.modules.findLastIndex(x=>x.key===key);removeBarrel(i)}
function moveBarrel(from,to){if(from<0||to<0||from>=barrelConfiguration().length||to>=barrelConfiguration().length)return;editBarrels(xs=>xs.splice(to,0,xs.splice(from,1)[0]));state.selectedBarrel=to;renderBarrelList();renderDrawing()}
function resetBarrels(){if(!confirm('恢复本机标准机筒配置？螺杆排列保持不变。'))return;pushHistory();state.ports={natural4:true,natural7:true};$('#natural4').checked=$('#natural7').checked=true;state.selectedBarrel=-1;renderDesign();toast('已恢复当前机型的标准机筒')}
function barrelWarningText(){return BarrelModels.warnings(state.machine,spec(),state.ports).join('；')}
function renderEditableBarrels(){
 for(const id of ['natural4','natural7']){const el=$('#'+id);el.disabled=state.ports.barrel_layout!=null;el.title=el.disabled?'自定义机筒请通过右侧模块配置开口和堵头':'标准自然排气开闭'}
 const rows=barrelConfiguration();if(state.selectedBarrel>=rows.length)state.selectedBarrel=-1;
 if(state.libraryMode==='barrel')$('#catalogDeleteBtn').disabled=state.selectedBarrel<0;
 $('#barrelUndoBtn').disabled=!state.undo.length;$('#barrelRedoBtn').disabled=!state.redo.length;
 const summary=BarrelModels.summary(state.machine,spec(),state.ports);$('#barrelStatus').textContent=`${state.machine}机 · ${summary.process_d}D / ${summary.sections}节 · ${summary.barrel_length} mm`;
 $('#barrelPortBtn').disabled=$('#barrelCloseBtn').disabled=!rows[state.selectedBarrel]?.portKey;
 for(const id of ['barrelDeleteBtn','barrelDuplicateBtn','barrelMoveUpBtn','barrelMoveDownBtn','barrelConfigureBtn']){const b=$('#'+id);if(b)b.disabled=state.selectedBarrel<0;}
 $('#barrelList').innerHTML=rows.map((r,i)=>`<div class="barrel-row barrel-${r.role} ${i===state.selectedBarrel?'selected':''}" data-index="${i}" draggable="true" tabindex="0"><span class="barrel-mini">${barrelModuleSVG({...r,cap:r.cap})}</span><span>${r.pos}</span><span title="节长 ${r.length} mm">${r.mm}</span><span title="${state.machine}机 · 机型直径规格 ${spec().diameter} mm">${esc(r.name)}</span><span class="barrel-annotation ${r.portKey?'editable':''}">${r.annotation}</span><span class="barrel-row-actions"><button data-barrel-row="up" title="上移">↑</button><button data-barrel-row="down" title="下移">↓</button><button data-barrel-row="delete" title="从机筒删除">×</button></span></div>`).join('')||'<p class="empty">机筒为空，请点击Machine中的机筒模块加入。</p>';
 $$('.barrel-row').forEach(row=>{
  row.onclick=e=>{const i=+row.dataset.index,action=e.target.closest('[data-barrel-row]')?.dataset.barrelRow;state.selectedBarrel=i;if(action==='delete')removeBarrel(i);else if(action==='up')moveBarrel(i,i-1);else if(action==='down')moveBarrel(i,i+1);else{renderBarrelList();renderDrawing()}};
  row.ondblclick=e=>{if(!e.target.closest('button'))configureBarrel(+row.dataset.index)};
  row.ondragstart=e=>{e.dataTransfer.setData('application/x-barrel-index',row.dataset.index);e.dataTransfer.setData('application/x-barrel-machine',state.machine)};
  row.ondragover=e=>e.preventDefault();row.ondrop=e=>{e.preventDefault();e.stopPropagation();const key=e.dataTransfer.getData('application/x-barrel-key'),from=e.dataTransfer.getData('application/x-barrel-index');if(key)addBarrel(key,+row.dataset.index);else if(from!==''&&e.dataTransfer.getData('application/x-barrel-machine')===state.machine)moveBarrel(+from,+row.dataset.index)};
 });
 const list=$('#barrelList');list.ondragover=e=>e.preventDefault();list.ondrop=e=>{e.preventDefault();const key=e.dataTransfer.getData('application/x-barrel-key');if(key)addBarrel(key,rows.length)};
 $('#barrelLayoutNotice').textContent=barrelWarningText()||`标准配置 · ${state.machine}机 · 机型直径规格 ${spec().diameter} mm；实际内径与螺杆间隙需按图纸核对`;
}
function bindBarrelEditing(){
 $('#barrelConfigureBtn').onclick=()=>configureBarrel();$('#barrelPlanBtn').onclick=configureBarrelPlan;
 $('#barrelResetBtn').onclick=resetBarrels;
 $('#barrelCloseBtn').onclick=()=>{const r=barrelConfiguration()[state.selectedBarrel];if(!r||!BarrelModels.PORT_ROLES.includes(r.role))return;editBarrels(xs=>{xs[state.selectedBarrel].cap='closed';xs[state.selectedBarrel].open=false})};
 $('#barrelDeleteBtn').onclick=()=>removeBarrel();
 $('#barrelDuplicateBtn').onclick=()=>{const layout=BarrelModels.materialize(state.machine,spec(),state.ports),m=layout.modules[state.selectedBarrel];if(!m)return;editBarrels(xs=>xs.splice(state.selectedBarrel+1,0,{...m,uid:barrelUid()}))};
 $('#barrelMoveUpBtn').onclick=()=>moveBarrel(state.selectedBarrel,state.selectedBarrel-1);
 $('#barrelMoveDownBtn').onclick=()=>moveBarrel(state.selectedBarrel,state.selectedBarrel+1);
 $('#barrelClearBtn').onclick=()=>{if(confirm('清空当前机筒配置？螺杆排列和模块库不变。'))editBarrels(xs=>xs.splice(0))};
 $('#barrelUndoBtn').onclick=undoConfiguration;$('#barrelRedoBtn').onclick=redoConfiguration;
 $('#barrelCheckBtn').onclick=()=>{const text=barrelWarningText();openModal('机筒配置校验',`<p>${state.machine}机 · 机型直径规格 ${spec().diameter} mm · 当前总长 ${barrelConfiguration().at(-1)?.mm||0} mm</p><p class="${text?'warn-box':'ok-box'}">${esc(text||'与本机标准布局一致。实际螺杆外径、机筒内径及配合间隙仍应以图纸为准。')}</p>`,[{label:'关闭',click:closeModal}])};
 $('#barrelResetPortsBtn').onclick=()=>{if(!state.ports.barrel_layout){$('#natural4').checked=$('#natural7').checked=true;state.ports={...state.ports,natural4:true,natural7:true};renderDesign();return;}editBarrels(xs=>xs.forEach(x=>{x.open=true;x.cap='open'}))};
 document.addEventListener('keydown',e=>{if(!e.target.closest('.barrel-card')||e.target.closest('input,textarea,select')||!['Delete','Backspace'].includes(e.key))return;e.preventDefault();e.stopImmediatePropagation();removeBarrel()},true);
}
function editableDrawingSVG(exportMode=false,compact=false){
 const s=spec(),rows=barrelConfiguration(),v=calculate(),bad=new Set(v.violations.map(x=>x.index)),barrelLength=rows.at(-1)?.mm||0;
 const extent=Math.max(s.element_length,barrelLength+s.entry_offset,v.total,1),right=1150,left=50,scale=(right-left)/extent,bandY=exportMode&&!compact?150:108,bandH=s.diameter*scale;
 const showModels=!exportMode||!compact,labelY=bandY+bandH+40,labelFont=12,labelGap=17,labelLanes=Math.max(1,Math.ceil(state.sequence.length/66));
 // Reserve real space for full vertical model names without moving the screw.
 const longest=Math.max(0,...state.sequence.map(name=>[...name].reduce((sum,c)=>sum+(c.codePointAt(0)>255?1:.62),0)*labelFont));
 const H=Math.max(exportMode&&!compact?485:330,showModels&&state.sequence.length?Math.ceil(labelY+labelLanes*(longest+18)+45):0);
 const reference=DrawingAppearance.referenceView(),zeroX=right-s.entry_offset*scale;
 const bx=mm=>right-(mm+s.entry_offset)*scale,fit=BarrelVisuals.axialFit(s,rows,v.total,v.target),entry=!reference&&rows[0]?.role==='feed'?BarrelVisuals.inlet(bx(0),s.entry_offset*scale,bandY,bandH,s.entry_offset):'';let barrel='',elements='',labels='';
 for(const [i,r] of rows.entries()){
  const x=bx(r.mm),w=r.length*scale,cx=x+w/2,selected=!exportMode&&state.selectedBarrel===i;
  barrel+=`<g data-barrel-index="${i}" data-machine="${state.machine}" data-length="${r.length}"><title>${r.pos} ${esc(r.name)} · L ${r.length} mm · ${barrelRoleName(r.role)}</title>${BarrelVisuals.module(r,x,w,bandY,bandH,selected)}`;
  barrel+='</g>';
  if(w>8)labels+=`<text x="${cx}" y="${bandY-38}" text-anchor="middle" font-size="10">${r.pos}</text>`;
 }
 let labelCum=0;const labelXs=state.sequence.map(name=>{const length=comp(name).length,span=DrawingAppearance.visibleSpan(labelCum-s.entry_offset,length),x=right-(s.entry_offset+(span.start+span.end)/2)*scale;labelCum+=length;return x}),order=labelXs.map((_,i)=>i).sort((a,b)=>labelXs[a]-labelXs[b]);
 const labelRows=[];order.forEach((i,rank)=>labelRows[i]=rank%labelLanes);
 for(let lane=0;lane<labelLanes;lane++){
  const indices=order.filter(i=>labelRows[i]===lane);
  let rail=20;for(const i of indices){labelXs[i]=Math.max(labelXs[i],rail);rail=labelXs[i]+labelGap}
  rail=1180;for(const i of [...indices].reverse()){labelXs[i]=Math.min(labelXs[i],rail);rail=labelXs[i]-labelGap}
 }
 let cum=0;for(const [i,name] of state.sequence.entries()){
  const c=comp(name),w=c.length*scale,x=right-(cum+c.length)*scale,span=DrawingAppearance.visibleSpan(cum-s.entry_offset,c.length);elements+=`<g data-visible-element-index="${i}" data-full-length="${c.length}" data-visible-length="${span.length}">${exactElementImage(x,w,c,i,bad.has(i),bandY,bandH,!exportMode,span.length*scale)}</g>`;
  if(showModels){const cx=right-(s.entry_offset+(span.start+span.end)/2)*scale,lx=labelXs[i],ly=labelY+labelRows[i]*(longest+18);labels+=`<g class="installed-model-label" data-model-label-index="${i}" pointer-events="none"><path d="M${cx} ${bandY+bandH+19}L${lx} ${ly-5}" fill="none" stroke="#596772" stroke-width=".8"/><text x="${lx}" y="${ly}" transform="rotate(-90 ${lx} ${ly})" text-anchor="end" font-family="Arial,Microsoft YaHei,sans-serif" font-size="${labelFont}" font-weight="600" fill="${bad.has(i)?'#c22':'#111'}">${esc(name)}</text></g>`}cum+=c.length;
 }
 if(reference)elements=DrawingAppearance.clip(elements,zeroX,H,'entry-view-'+(++thumbnailSerial))+DrawingAppearance.plate(zeroX,bandY,bandH);
 labels+=`<text data-view-note="true" x="24" y="${H-3}" font-size="8" fill="#536978">${esc(DrawingAppearance.note())}</text>`;
 const tipX=right-v.total*scale,tipW=Math.min(12,bandH*.5),tip=v.total?`<g class="screw-tip"><path d="M${tipX} ${bandY}L${tipX-tipW} ${bandY+bandH/2}L${tipX} ${bandY+bandH}Z" fill="white" stroke="#263d47" stroke-width=".8"/><path d="M${tipX-tipW} ${bandY+bandH/2}H${tipX}" stroke="#75858c" stroke-width=".6"/></g>`:'';
 const warning=barrelWarningText(),title=exportMode?`<text x="600" y="24" text-anchor="middle" font-size="16">${esc(state.metadata.drawing_name||s.name)}</text>`:'';
 let axis=`<line x1="${bx(barrelLength)}" y1="${H-35}" x2="${bx(0)}" y2="${H-35}" stroke="#333"/>`;
 for(let mm=0;mm<=barrelLength;mm+=Math.max(500,Math.ceil(barrelLength/10000)*500)){const x=bx(mm);axis+=`<path d="M${x} ${H-40}v10" stroke="#333"/><text x="${x}" y="${H-17}" text-anchor="middle" font-size="9">${mm}</text>`;}
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 ${H}" preserveAspectRatio="xMidYMid meet" data-band-y="${bandY}" data-band-h="${bandH}" data-screw-left="${left}" data-screw-right="${right}" data-drawing-length="${extent}" data-machine="${state.machine}" data-nominal-diameter="${s.diameter}"><rect width="1200" height="${H}" fill="white"/>${title}<text x="24" y="${exportMode?45:25}" font-size="12">${esc(s.name)} · 直径规格 ${s.diameter} mm · 机筒 ${barrelLength} mm · ${BarrelModels.summary(state.machine,s,state.ports).process_d}D / ${BarrelModels.summary(state.machine,s,state.ports).sections}节 · 方案螺杆 ${v.target} mm</text><text x="24" y="${exportMode?63:43}" font-size="10" fill="${warning?'#b53a2e':'#64727a'}">${warning?'自定义机筒 · 非标准方案，需工程复核；轴长不自动延长':'标准机筒 · 实际内径、外径及间隙以供应商图纸为准'}</text><text data-axial-fit="${fit.status}" data-length-delta="${fit.delta}" data-target-delta="${fit.targetDelta}" x="24" y="${exportMode?81:58}" font-size="9" fill="${['long','short','no-barrel'].includes(fit.status)||fit.targetDelta!==0?'#b43a26':'#536978'}">${esc(fit.text)}${rows.length&&rows[0].role!=='feed'?'；首节非主喂料，入口连接外形需复核':''}</text>${barrel}${entry}${elements}${tip}${labels}${!rows.length?`<text x="600" y="${bandY+60}" text-anchor="middle" font-size="15" fill="#b33">机筒配置为空</text>`:''}${axis}<line id="dropMarker" x1="0" y1="${bandY-10}" x2="0" y2="${bandY+bandH+10}" stroke="#087db8" stroke-width="2.5" style="display:none"/><rect id="replaceMarker" x="0" y="${bandY-2}" width="0" height="${bandH+4}" fill="#168cc122" stroke="#087db8" style="display:none"/></svg>`;
}
