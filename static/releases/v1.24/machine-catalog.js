const MachineCatalog=(()=>{
 const url=new URL('machine-catalog.json',document.currentScript.src);let data=null;
 async function open(){
  try{if(!data){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('无法读取机型资料');data=await r.json()}
   openModal('莱斯机型参数库',`<p>共 ${data.models.length} 种机型资料。50/60 CC 本机可组合；其他机型只有资料参数，缺少机筒和元件图纸时不开放装配，不套用现有库存。</p><div class="machine-catalog-tools"><select id="machineFamily"><option value="">全部系列</option><option>CC</option><option>MAXX</option><option>PH</option></select><input id="machineCatalogSearch" placeholder="搜索机型，如27、MAXX"></div><div id="machineCatalogGrid" class="machine-catalog-grid"></div>`,[{label:'关闭',click:closeModal}]);
   const render=()=>{
    const family=$('#machineFamily').value,q=$('#machineCatalogSearch').value.toUpperCase();
    $('#machineCatalogGrid').innerHTML=data.models.filter(m=>(!family||m.family===family)&&(!q||m.name.toUpperCase().includes(q))).map(m=>`<article class="machine-profile-card" data-profile="${m.id}"><h3>${esc(m.name)}</h3><span class="machine-profile-status ${m.assembly_machine?'ready':''}">${m.assembly_machine?'本机组合功能已开放':'参数已录入 · 组合库待补充'}</span><p>螺杆直径：${esc(m.values['螺杆外径/mm']??m.values['螺杆直径/mm'])} mm</p>${m.conflicts.length?'<p class="profile-conflict">存在版本/名称差异，需核对</p>':''}<button data-profile-info="${m.id}">参数 / 出处 / 缺少资料</button></article>`).join('')||'<p>没有匹配机型</p>';
    $$('[data-profile-info]').forEach(b=>b.onclick=()=>detail(b.dataset.profileInfo));
   };$('#machineFamily').onchange=$('#machineCatalogSearch').oninput=render;render();
  }catch(e){toast(e.message,true)}
 }
 function detail(id){const m=data.models.find(x=>x.id===id);if(!m)return;
  openModal(m.name,`<dl class="model-details">${Object.entries(m.values).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl><p class="warn-box">以上为资料系列参数，不替代具体设备铭牌、单型号尺寸及制造公差；MAXX、CC、PH 不可按相近型号混用。</p>${m.conflicts.map(x=>`<p class="warn-box">${esc(x)}</p>`).join('')}<h3>资料出处</h3>${m.sources.map(k=>{const s=data.sources[k];return `<p class="muted machine-catalog-source" style="overflow-wrap:anywhere">${esc(s.file)} · PDF第 ${s.page} 页<br>SHA256：${s.sha256}</p>`}).join('')}${m.missing.length?'<h3>开放组合前仍需</h3><ul>'+m.missing.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':''}`,[...(m.assembly_machine?[{label:'切换到此本机',primary:true,click:()=>{closeModal();WorkspaceUI.chooseMachine(m.assembly_machine)}}]:[]),{label:'返回机型库',click:open},{label:'关闭',click:closeModal}]);
 }
 return {open};
})();
