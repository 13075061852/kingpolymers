/* Visible workflow controls; keep the established server-side project format. */
const WorkspaceUI=(()=>{
 let baseline=null;
 const snapshot=(p=null)=>JSON.stringify(p?{machine:p.machine,sequence:p.sequence,ports:p.ports,metadata:p.metadata}:{machine:state.machine,sequence:state.sequence,ports:state.ports,metadata:state.metadata});
 function dirty(){return baseline!==null&&snapshot()!==baseline}
 function refresh(){
  const select=$('#quickMachineSelect'),label=$('#saveLocation');if(!select)return;
  select.value=state.machine;
  label.textContent=(state.id?(dirty()?'有未保存修改':'已保存到项目'):'新方案 · 尚未保存')+'｜螺杆＋机筒一起保存';
  label.classList.toggle('unsaved',dirty());
  const local=$('#assemblySaveState');if(local){local.textContent=!state.id?'未保存':dirty()?'有修改未保存':'已保存';local.classList.toggle('unsaved',!state.id||dirty())}
 }
 function markClean(p=null){baseline=snapshot(p);refresh()}
 function chooseMachine(machine){
  if(machine===state.machine){refresh();return}
  if(dirty()&&!confirm('切换机型会新建空方案。当前修改尚未保存，请先保存；确定放弃这些修改？')){refresh();$('#machineSelect').value=state.machine;return}
  newProject(machine);
 }
 function install(){
  const bar=document.createElement('div');bar.className='workspace-commands';
  bar.innerHTML='<label>当前机型 <select id="quickMachineSelect"><option value="50">50机 · ZSE 50CC Pro</option><option value="60">60机 · ZSE 60CC</option></select></label><button id="otherMachinesBtn">其他莱斯机型</button><button id="newPlanBtn">新建方案</button><button id="savePlanBtn" class="primary">保存方案</button><button id="savePlanAsBtn">另存方案</button><button id="openPlanBtn">打开方案</button><button id="drawingFieldsBtn">图纸资料 / 历史模板</button><button id="referencePrintBtn">三页图纸 / PDF</button><span id="saveLocation" role="status"></span>';
  $('#view-designer').insertBefore(bar,$('.design-grid'));
  $('#quickMachineSelect').onchange=e=>chooseMachine(e.target.value);$('#machineSelect').onchange=e=>chooseMachine(e.target.value);
  $('#newPlanBtn').onclick=()=>{if(!dirty()||confirm('当前修改未保存，确定新建空方案？'))newProject(state.machine)};
  $('#savePlanBtn').onclick=()=>saveProject(false);$('#savePlanAsBtn').onclick=()=>saveProject(true);
  $('#openPlanBtn').onclick=async()=>{try{await reloadData();renderProjects();switchView('projects')}catch(e){toast(e.message,true)}};
  $('#drawingFieldsBtn').onclick=()=>{$('.left-panel').classList.remove('hidden');$('[data-meta=drawing_name]').focus()};
  $('#referencePrintBtn').onclick=()=>$('#pdfBtn').click();$('#otherMachinesBtn').onclick=()=>MachineCatalog.open();
  const toolbar=$('.barrel-toolbar'),primaryIds=['barrelPlanBtn','barrelConfigureBtn','barrelDuplicateBtn','barrelDeleteBtn','barrelUndoBtn','barrelRedoBtn','barrelResetBtn','barrelCheckBtn'];
  const primary=primaryIds.map(id=>document.getElementById(id));
  // Keep the same DOM nodes and event handlers; only reorganize their placement.
  const names=['节数 / 轴长','配置 / 堵头','复制','删除','撤销','恢复','标准机筒','校验'];
  const more=document.createElement('details');more.className='barrel-more';more.innerHTML='<summary>更多操作</summary><div class="barrel-more-actions"></div>';
  for(const button of [...toolbar.querySelectorAll('button')])if(!primaryIds.includes(button.id)){button.textContent=button.title;more.lastElementChild.append(button)}
  const status=$('#barrelStatus');toolbar.closest('.barrel-card').querySelector('.pane-title').append(status);
  toolbar.replaceChildren(...primary,more);primary.forEach((button,i)=>button.textContent=names[i]);
  $('.barrel-card .pane-title').firstChild.textContent='机筒配置 / Barrel ';
  $('.sequence-card .pane-title').innerHTML='<span>螺杆组合 / Screw</span><button id="saveAssemblyBtn" class="primary" title="保存螺杆排列和机筒配置；异常配置仍需工程确认">保存组合</button><button id="openAssemblyBtn" title="打开之前保存的组合方案">打开方案</button><small id="assemblySaveState" role="status"></small>';
  $('#saveAssemblyBtn').onclick=async()=>{const b=$('#saveAssemblyBtn');b.disabled=true;try{await saveProject(false)}finally{b.disabled=false}};
  $('#openAssemblyBtn').onclick=()=>$('#openPlanBtn').click();
  window.onbeforeunload=e=>{if(dirty()){e.preventDefault();e.returnValue='当前方案有未保存修改';return e.returnValue}};
 }
 return {install,refresh,markClean,dirty,chooseMachine};
})();
