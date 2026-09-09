/* Lift / follow / preview / settle. Pointer moves never rebuild the SVG or save data. */
(function(root){
 'use strict';let active=null,serial=0;const bindings=new WeakMap();
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const contains=(r,p)=>p.clientX>=r.left&&p.clientX<=r.right&&p.clientY>=r.top&&p.clientY<=r.bottom;
 function suppressClick(waitForRelease=false){const clear=()=>{document.removeEventListener('click',handler,true);document.removeEventListener('pointerdown',clear,true);document.removeEventListener('pointerup',released,true)},released=()=>setTimeout(clear,350),handler=e=>{if(e.detail===0)return;e.preventDefault();e.stopImmediatePropagation();clear()};document.addEventListener('click',handler,true);document.addEventListener('pointerdown',clear,true);if(waitForRelease)document.addEventListener('pointerup',released,true);else released()}
 function settle(d,target){
  if(!d.ghost)return;
  if(!target?.isConnected||reduced()){d.ghost.remove();return}
  const r=target.getBoundingClientRect(),to=`translate3d(${r.left+r.width/2-d.width/2}px,${r.top+r.height/2-d.height/2}px,0) scale(${Math.min(1,r.width/d.width,r.height/d.height)})`;
  const anim=d.ghost.animate([{transform:d.ghost.style.transform,opacity:+getComputedStyle(d.ghost).opacity},{transform:to,opacity:0}],{duration:230,easing:'cubic-bezier(.18,.8,.22,1)',fill:'forwards'});
  anim.finished.catch(()=>{}).finally(()=>d.ghost.remove());
  target.animate([{opacity:.55},{opacity:1}],{duration:reduced()?0:220});
 }
 function end(commit=false,event){
  const d=active;if(!d)return;active=null;clearTimeout(d.timer);cancelAnimationFrame(d.frame);d.abort.abort();
  try{d.root.releasePointerCapture(d.pointerId)}catch{}
  d.source.classList.remove('fluent-origin','fluent-holding');d.source.removeAttribute('aria-grabbed');document.body.classList.remove('fluent-grabbing');
  d.line?.remove();d.trash?.remove();d.options.reset?.();
  if(!d.lifted){if(!d.moved&&event?.type==='pointerup')d.options.tap?.();return}
  suppressClick(event?.type!=='pointerup');let target=d.source;
  try{if(commit&&d.preview?.inside)target=d.options.commit(d.preview);else if(commit&&d.preview?.remove){d.options.remove();target=null}}
  finally{settle(d,target)}
 }
 function autoScroll(d){
  const p=d.point,wrap=document.querySelector('#drawingWrap');let changed=false;
  if(wrap&&contains(wrap.getBoundingClientRect(),p)){
   const r=wrap.getBoundingClientRect(),before=wrap.scrollLeft;
   if(p.clientX<r.left+36)wrap.scrollLeft-=Math.ceil((r.left+36-p.clientX)/3);
   else if(p.clientX>r.right-36)wrap.scrollLeft+=Math.ceil((p.clientX-r.right+36)/3);
   changed=before!==wrap.scrollLeft;
  }
  if(d.touch){const before=scrollY;if(p.clientY<60)scrollBy(0,-Math.ceil((60-p.clientY)/4));else if(p.clientY>innerHeight-60)scrollBy(0,Math.ceil((p.clientY-innerHeight+60)/4));changed=changed||before!==scrollY}
  return changed;
 }
 function update(d){
  if(active!==d||!d.lifted)return;
  autoScroll(d);
  const p=d.point;d.ghost.style.transform=`translate3d(${p.clientX-d.width/2}px,${Math.max(6,p.clientY-d.height-(d.touch?26:18))}px,0)`;
  const preview=d.options.preview(p),overTrash=d.trash&&contains(d.trash.getBoundingClientRect(),p);
  preview.remove=!preview.inside&&!!d.options.remove&&(!d.touch||overTrash);d.preview=preview;
  d.ghost.classList.toggle('fluent-delete',preview.remove);if(d.trash)d.trash.classList.toggle('over',preview.remove);
  const text=preview.inside?preview.label:preview.remove?'松手删除 · 可撤销':d.touch&&d.options.remove?'移入机筒调整；拖到下方可删除':'移入机筒；松手返回';
  if(d.badge.textContent!==text)d.badge.textContent=text;
  if(preview.inside&&preview.marker){const m=preview.marker;d.line.hidden=false;d.line.classList.toggle('replace',!!preview.replace);d.line.style.transform=`translate3d(${m.x}px,${m.y}px,0)`;d.line.style.height=m.height+'px';d.line.style.width=Math.max(preview.replace?m.width:3,3)+'px'}else d.line.hidden=true;
  const slot=preview.inside?`${preview.index}:${preview.replace}`:'none';if(slot!==d.slot){d.slot=slot;d.options.reflow?.(preview)}
  d.frame=requestAnimationFrame(()=>update(d));
 }
 function lift(d){
  if(active!==d)return;if(!d.source.isConnected||!d.source.getClientRects().length){end(false);return}
  d.lifted=true;d.source.classList.remove('fluent-holding');d.source.classList.add('fluent-origin');d.source.setAttribute('aria-grabbed','true');document.body.classList.add('fluent-grabbing');
  try{d.root.setPointerCapture(d.pointerId)}catch{}
  const portal=document.fullscreenElement||document.body;
  d.ghost=document.createElement('div');d.ghost.className='fluent-ghost';d.ghost.dataset.fluentGhost='true';d.ghost.innerHTML='<div class="fluent-ghost-face"><div class="fluent-ghost-symbol">'+d.options.html+'</div><b></b><small role="status" aria-live="polite"></small></div>';
  d.ghost.querySelector('b').textContent=d.options.label;d.badge=d.ghost.querySelector('small');portal.append(d.ghost);d.width=d.ghost.offsetWidth;d.height=d.ghost.offsetHeight;
  d.ghost.firstElementChild.animate([{transform:'scale(.93)',opacity:.5},{transform:'scale(1.035)',opacity:1},{transform:'scale(1)',opacity:1}],{duration:reduced()?0:200,easing:'ease-out'});
  d.line=document.createElement('div');d.line.className='fluent-drop-line';d.line.setAttribute('aria-hidden','true');portal.append(d.line);
  if(d.options.remove){d.trash=document.createElement('div');d.trash.className='fluent-trash';d.trash.textContent='拖到这里删除 · 可撤销';portal.append(d.trash)}
  update(d);
 }
 function bind(element,resolve){
  bindings.get(element)?.abort();const binding=new AbortController();bindings.set(element,binding);
  element.addEventListener('dragstart',e=>{if(e.target.closest?.('.component-card,.screw-element')){e.preventDefault();e.stopImmediatePropagation()}},{capture:true,signal:binding.signal});
  element.addEventListener('contextmenu',e=>{if(active?.root===element){e.preventDefault();e.stopImmediatePropagation()}},{capture:true,signal:binding.signal});
  element.addEventListener('pointerdown',e=>{
   if(active){if(e.pointerType==='touch'&&e.pointerId!==active.pointerId)end(false);return}
   if(!e.isPrimary||e.button!==0)return;const options=resolve(e);if(!options)return;
   const d={root:element,options,source:options.source,pointerId:e.pointerId,touch:e.pointerType==='touch',point:e,startX:e.clientX,startY:e.clientY,moved:false,lifted:false,abort:new AbortController()};active=d;
   d.scrollPositions=new Map([[document,[scrollX,scrollY]]]);for(let node=d.source;node;node=node.parentElement)d.scrollPositions.set(node,[node.scrollLeft,node.scrollTop]);
   if(d.touch){d.source.classList.add('fluent-holding');d.timer=setTimeout(()=>lift(d),260)}
   const opts={capture:true,signal:d.abort.signal};
   document.addEventListener('pointermove',ev=>{if(ev.pointerId!==d.pointerId)return;d.point=ev;const distance=Math.hypot(ev.clientX-d.startX,ev.clientY-d.startY);if(distance>(d.touch?9:5))d.moved=true;if(d.touch&&!d.lifted&&d.moved){end(false);return}if(!d.touch&&!d.lifted&&d.moved)lift(d);if(d.lifted)ev.preventDefault()},opts);
   document.addEventListener('pointerup',ev=>{if(ev.pointerId!==d.pointerId)return;d.point=ev;if(d.lifted){cancelAnimationFrame(d.frame);update(d)}end(d.lifted,ev)},opts);
   document.addEventListener('pointercancel',ev=>{if(ev.pointerId===d.pointerId)end(false)},opts);
   document.addEventListener('lostpointercapture',ev=>{if(active===d&&ev.pointerId===d.pointerId)end(false)},opts);
   document.addEventListener('touchmove',ev=>{if(active!==d)return;if(ev.touches.length>1){end(false);return}if(d.lifted)ev.preventDefault()},{...opts,passive:false});
   document.addEventListener('scroll',ev=>{if(active!==d||d.lifted)return;const old=d.scrollPositions.get(ev.target),now=ev.target===document?[scrollX,scrollY]:[ev.target.scrollLeft,ev.target.scrollTop];if(!old||old[0]!==now[0]||old[1]!==now[1])end(false)},opts);
   document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();end(false)}},opts);
   window.addEventListener('blur',()=>end(false),{signal:d.abort.signal});
   document.addEventListener('visibilitychange',()=>{if(document.hidden)end(false)},{signal:d.abort.signal});
  },{signal:binding.signal});
 }
 root.FluentDrag={bind,cancel:()=>end(false),get active(){return !!active},nextId:()=>`fluent-${++serial}`};
})(globalThis);
