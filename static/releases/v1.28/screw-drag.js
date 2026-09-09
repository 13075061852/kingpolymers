/* Connect fluent gestures to existing insert/replace/undo operations. */
function fluentScrewOptions(source,name,from=null){
 const machine=state.machine,c=comp(name),svg=$('#drawingWrap > svg'),moving=from!==null,transforms=new Map();
 const reset=()=>{for(const [node,value] of transforms)node.style.transform=value;transforms.clear();$('#drawingWrap')?.classList.remove('fluent-reflow')};
 const width=()=>c.length/(+svg.dataset.drawingLength||spec().element_length)*(+svg.dataset.screwRight-+svg.dataset.screwLeft);
 const target=index=>$('#drawingWrap .screw-element[data-element-index="'+index+'"]');
 return {source,label:ComponentModels.model(c).label,html:ComponentModels.symbol(c,spec(),{id:FluentDrag.nextId(),thumbnail:true,color:DrawingAppearance.color(c)}),
  tap:moving?()=>{state.selected=from;renderDrawing();renderSequence();showSelected()}:null,
  preview:e=>{
   const bounds=$('#drawingWrap').getBoundingClientRect(),visible=e.clientX>=bounds.left&&e.clientX<=bounds.right&&e.clientY>=bounds.top&&e.clientY<=bounds.bottom,inside=visible&&pointerInsideBarrel(e,svg),replace=!moving&&$('#dropMode').value==='replace'&&state.sequence.length>0;
   if(!inside||state.machine!==machine)return {inside:false};
   const p=drawingDropPosition(e,replace),matrix=svg.getScreenCTM(),point=svg.createSVGPoint();
   point.x=p.x+(moving&&p.index>from?width():0);point.y=+svg.dataset.bandY-12;const top=point.matrixTransform(matrix);
   point.y=+svg.dataset.bandY+(+svg.dataset.bandH)+12;const bottom=point.matrixTransform(matrix);
   const adjusted=moving&&p.index>from?p.index-1:p.index;
   return {...p,inside:true,replace,label:`${replace?'替换':'插入'}第 ${adjusted+1} 位`,marker:{x:top.x,y:top.y,height:Math.max(28,bottom.y-top.y),width:(p.width||0)*matrix.a}};
  },
  reflow:p=>{
   reset();if(!p.inside||p.replace)return;
   $('#drawingWrap').classList.add('fluent-reflow');
   for(const node of svg.querySelectorAll('.screw-element')){
    const i=Number(node.dataset.elementIndex);let dx=0;
    if(!moving&&i>=p.index)dx=-width();
    if(moving&&p.index>from&&i>from&&i<p.index)dx=width();
    if(moving&&p.index<from&&i>=p.index&&i<from)dx=-width();
    if(dx){transforms.set(node,node.style.transform);node.style.transform=`translateX(${dx}px)`}
   }
  },reset,
  commit:p=>{
   if(state.machine!==machine)return null;
   let index=p.index;if(moving&&from<index)index--;
   if(moving&&index===from){state.selected=from;renderDrawing();renderSequence();showSelected();return target(from)}
   changeSequence(()=>{
    if(moving){const item=state.sequence.splice(from,1)[0];index=Math.max(0,Math.min(state.sequence.length,index));state.sequence.splice(index,0,item)}
    else if(p.replace)state.sequence.splice(index,1,name);
    else state.sequence.splice(index,0,name);
    state.selected=index;
   });return target(index);
  },
  remove:moving?()=>{if(state.machine!==machine)return;changeSequence(()=>{state.sequence.splice(from,1);state.selected=-1});toast('螺纹块已移出组合；可撤销，不删除元件库或库存')}:null
 };
}
function bindFluentScrews(){
 FluentDrag.cancel();const wrap=$('#drawingWrap'),svg=$('svg',wrap),library=$('#componentLibrary');if(!svg)return;
 $('#fitDrawing').onclick=()=>{state.zoom=matchMedia('(max-width:1000px)').matches?Math.max(10,Math.floor(wrap.clientWidth/1000*100)):100;applyDrawingZoom();wrap.scrollLeft=0};
 FluentDrag.bind(svg,e=>{
  const hit=e.target.closest?.('[data-element-index]');
  if(hit){const index=Number(hit.dataset.elementIndex);return fluentScrewOptions(hit.closest('.screw-element')||hit,state.sequence[index],index)}
  const barrel=e.target.closest?.('[data-barrel-index]');if(barrel){state.selectedBarrel=Number(barrel.dataset.barrelIndex);renderBarrelList();renderDrawing()}
  return null;
 });
 FluentDrag.bind(library,e=>{if(e.target.closest('button,input,select'))return null;const card=e.target.closest('.component-card[data-name]');return card?fluentScrewOptions(card,card.dataset.name):null});
 // Retain compatible desktop/native drops from sources outside this controller.
 wrap.ondragover=e=>{if(!e.dataTransfer.types.includes('text/component'))return;e.preventDefault();wrap.classList.add('drop-active');showDrawingDrop(drawingDropPosition(e,$('#dropMode').value==='replace'),$('#dropMode').value==='replace')};
 wrap.ondragleave=e=>{if(!wrap.contains(e.relatedTarget)){wrap.classList.remove('drop-active');hideDrawingDrop()}};
 wrap.ondrop=e=>{const name=e.dataTransfer.getData('text/component');if(!name)return;e.preventDefault();wrap.classList.remove('drop-active','drop-ready');if(!comps().some(c=>c.name===name))return;const replace=$('#dropMode').value==='replace',p=drawingDropPosition(e,replace);changeSequence(()=>{if(replace&&state.sequence.length)state.sequence.splice(p.index,1,name);else state.sequence.splice(p.index,0,name);state.selected=p.index});hideDrawingDrop()};
}
