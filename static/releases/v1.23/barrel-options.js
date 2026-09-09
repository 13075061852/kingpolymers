/* Proposed module lengths/caps; all edits participate in project undo/redo. */
function barrelPortMark(r,cx,y,w,h){return BarrelVisuals.port(r,cx,y,w,h)}
function barrelPortMarkLegacy(r,cx,y,w,h){
 if(!BarrelModels.PORT_ROLES.includes(r.role))return '';
 const cap=r.cap||(r.open===false?'closed':'open'),side=['side','side_vacuum'].includes(r.role),py=side?y+h+1:y-19,ink=r.role==='feed'||r.role==='side'?'#b94135':'#206dab';
 let svg=`<g data-port-role="${r.role}" data-cap="${cap}"><title>${barrelRoleName(r.role)} · ${cap==='inject'?'中心注液堵头':cap==='closed'?'配套全封闭堵头':'工作开口'}</title><rect x="${cx-w/2}" y="${py}" width="${w}" height="17" fill="${cap==='open'?'white':'#75858c'}" stroke="#354851" stroke-width=".8"/>`;
 if(cap==='inject')svg+=`<path data-liquid="true" d="M${cx-2} ${py}v17h4v-17M${cx} ${py-12}v20m-3-4l3 4 3-4" fill="white" stroke="#1389ac" stroke-width="1.2"/><text x="${cx}" y="${py-16}" text-anchor="middle" font-size="7" fill="#1389ac">LIQ</text>`;
 else if(cap==='closed')svg+=`<path d="M${cx-w/2-2} ${py-2}h${w+4}v3h-${w+4}zM${cx-w*.22} ${py+5}l${w*.44} 7m0-7l-${w*.44} 7" fill="#657078" stroke="#273d48" stroke-width=".8"/>`;
 else svg+=`<text x="${cx}" y="${py+13}" text-anchor="middle" font-size="12" fill="${ink}">${side?(r.role==='side'?'←':'→'):r.role==='feed'?'↓':'↑'}</text>`;
 if(side)svg+=`<text x="${cx}" y="${py+25}" text-anchor="middle" font-size="6.5" fill="${ink}">${r.role==='side'?'SIDE FEED':'SIDE VAC'}</text>`;
 return svg+'</g>';
}
function appendCapCatalog(){
 const caps=[['side','closed','侧喂料堵头'],['side_vacuum','closed','侧真空堵头'],['vacuum,natural,feed','closed','顶部全封闭堵头'],['vacuum,natural','inject','中心注液堵头']];
 $('#componentLibrary').insertAdjacentHTML('beforeend','<div class="barrel-cap-catalog"><b>配套堵头</b><small>先选中右下方的对应机筒，再安装。孔径和接口须按供应商图纸配套。</small>'+caps.map(([roles,cap,label])=>`<button type="button" data-cap-roles="${roles}" data-install-cap="${cap}" title="${label}"><svg viewBox="0 0 70 58">${barrelPortMark({role:roles.split(',')[0],cap},35,29,30,5)}</svg><span>${label}</span></button>`).join('')+'</div>');
 $$('[data-install-cap]').forEach(b=>b.onclick=()=>{const r=barrelConfiguration()[state.selectedBarrel];if(!r||!b.dataset.capRoles.split(',').includes(r.role))return toast('请先在右下方选择与此堵头兼容的机筒',true);editBarrels(xs=>{xs[state.selectedBarrel].cap=b.dataset.installCap;xs[state.selectedBarrel].open=b.dataset.installCap!=='closed'});toast('已安装配套堵头；中心注液口仍执行GFA安全限制')});
}
function configureBarrel(index=state.selectedBarrel){
 const row=barrelConfiguration()[index];if(!row)return toast('请先选择机筒模块',true);
 const items=BarrelModels.catalog(spec()),current=items.find(x=>x.role===row.role&&x.name===row.name)||items.find(x=>x.role===row.role);
 openModal(`机筒 ${row.pos} · 长度 / 功能 / 堵头`,`<div class="barrel-options-form"><label>功能模块<select id="barrelRole">${items.map(x=>`<option value="${x.key}" ${x.key===current.key?'selected':''}>${barrelRoleName(x.role)} · ${esc(x.name)}</option>`).join('')}</select></label><label>轴向节长（mm）<input id="barrelLength" type="number" step="1" value="${row.length}"></label><label>开口及配套堵头<select id="barrelCap"></select></label><div id="barrelOptionPreview"></div><p class="muted">普通节长可设为标准节长的最多4倍；带开口模块不得短于开口投影宽度。法兰、隔热片保留本机标准尺寸。功能和堵头是设计配置，制造接口及孔径须核对。</p></div>`,[{label:'取消',click:closeModal},{label:'应用配置',primary:true,click:()=>{
  const key=$('#barrelRole').value,length=Number($('#barrelLength').value),cap=$('#barrelCap').value||'open';
  try{const layout=BarrelModels.materialize(state.machine,spec(),state.ports);Object.assign(layout.modules[index],{key,length,cap,open:cap!=='closed'});BarrelModels.normalize(state.machine,spec(),layout);closeModal();editBarrels(xs=>Object.assign(xs[index],{key,length,cap,open:cap!=='closed'}))}catch(e){toast(e.message,true)}
 }}]);
 const preview=()=>{const item=items.find(x=>x.key===$('#barrelRole').value);$('#barrelOptionPreview').innerHTML=barrelModuleSVG({...item,length:Number($('#barrelLength').value)||item.length,cap:$('#barrelCap').value})};
 const update=(initial=false)=>{const item=items.find(x=>x.key===$('#barrelRole').value);if(!initial)$('#barrelLength').value=item.length;$('#barrelLength').disabled=['heat','flange'].includes(item.role);const names={open:'工作开口 / 不装堵头',closed:['side','side_vacuum'].includes(item.role)?'配套侧口全封闭堵头':'顶部全封闭堵头',inject:'中心注液堵头（保留注液通道）'};$('#barrelCap').innerHTML=(item.caps.length?item.caps:['open']).map(c=>`<option value="${c}">${names[c]}</option>`).join('');if(initial&&item.caps.includes(row.cap))$('#barrelCap').value=row.cap;$('#barrelCap').disabled=!item.caps.length;preview()};
 $('#barrelRole').onchange=()=>update();$('#barrelCap').onchange=$('#barrelLength').oninput=preview;update(true);
}
function configureBarrelPlan(){
 const summary=BarrelModels.summary(state.machine,spec(),state.ports);
 openModal('机筒节数与方案轴长',`<div class="barrel-options-form"><p>当前 ${summary.process_d}D / ${summary.sections}节，机筒总坐标 ${summary.barrel_length} mm。工艺D数按每个标准节4D计算，不包含法兰和隔热片。</p><label>目标节数<input id="planSections" type="number" min="1" max="58" step="1" value="${summary.sections}"></label><p class="muted">增加时在法兰前插入普通机筒；减少时只移除末端普通机筒，不自动删除喂料、排气、真空功能模块。</p><label>方案螺杆目标长度（mm）<input id="planScrew" type="number" min="100" step="1" value="${BarrelModels.targetLength(state.machine,spec(),state.ports)}"></label><button id="suggestScrew" type="button">按机筒变化推算方案目标</button><p class="warn-box">方案目标不表示实际设备轴长已改变。调整后必须复核轴长、强度、驱动适配，并经负责人确认后保存或发布。</p></div>`,[{label:'取消',click:closeModal},{label:'应用方案',primary:true,click:()=>{
  const count=Number($('#planSections').value),target=Number($('#planScrew').value);if(!Number.isInteger(count)||count<1||count>58)return toast('目标节数须为1至58的整数',true);
  const action=(xs,layout)=>{let delta=count-xs.filter(x=>!['heat','flange'].includes(BarrelModels.catalog(spec()).find(c=>c.key===x.key).role)).length;
   while(delta>0){const flange=xs.findIndex(x=>x.key===state.machine+':flange');xs.splice(flange<0?xs.length:flange,0,{uid:barrelUid(),key:state.machine+':barrel',open:true,cap:'open'});delta--}
   while(delta<0){const i=xs.findLastIndex(x=>x.key===state.machine+':barrel');if(i<0)throw Error('剩余模块含功能开口，请手动核对后删除');xs.splice(i,1);delta++}
   if(target===spec().element_length)delete layout.screw_length;else layout.screw_length=target;
  };
  try{const l=BarrelModels.materialize(state.machine,spec(),state.ports);action(l.modules,l);BarrelModels.normalize(state.machine,spec(),l);closeModal();editBarrels(action)}catch(e){toast(e.message,true)}
 }}]);
 $('#suggestScrew').onclick=()=>{$('#planScrew').value=summary.suggested_screw_length+(Number($('#planSections').value)-summary.sections)*spec().section_length};
}
