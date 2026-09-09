/* Machine-isolated engineering proposals; keep Python/JS validation identical. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BarrelModels=api;})(globalThis,function(){
 'use strict';
 const MAX_MODULES=60,PORT_ROLES=['feed','natural','vacuum','side','side_vacuum'];
 function catalog(spec){return spec.barrel_catalog||[]}
 function position(i){let out='';for(i++;i;i=Math.floor((i-1)/26))out=String.fromCharCode(65+(i-1)%26)+out;return out}
 function normalize(machine,spec,layout){
  if(!layout||layout.version!==1||layout.machine!==machine)throw Error('机筒配置版本或所属机型不符，50/60机模块不能混用');
  if(!Array.isArray(layout.modules)||layout.modules.length>MAX_MODULES)throw Error(`机筒模块最多${MAX_MODULES}个`);
  const known=new Map(catalog(spec).map(x=>[x.key,x])),ids=new Set();
  const result={version:1,machine,modules:layout.modules.map(m=>{
   if(!m||!known.has(m.key))throw Error('机筒模块不属于当前机型或未核对型号');
   const item=known.get(m.key),open=m.open??true;
   if(typeof m.uid!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(m.uid)||ids.has(m.uid))throw Error('机筒模块标识无效或重复');
   if(typeof open!=='boolean')throw Error('排气口状态必须为布尔值');ids.add(m.uid);
   let cap=m.cap??(open?'open':'closed');
   if(item.caps.length){if(!item.caps.includes(cap))throw Error('堵头与当前机筒开口不兼容')}
   else{if((m.cap??'open')!=='open')throw Error('该模块没有可安装堵头的开口');cap='open'}
   const row={uid:m.uid,key:m.key,open:cap!=='closed',cap};
   if(Object.hasOwn(m,'length')){
    const length=m.length;if(!Number.isInteger(length))throw Error('节长必须为整数毫米');
    if(['heat','flange'].includes(item.role)){if(length!==item.length)throw Error('隔热片及法兰长度按本机标准保留')}
    else if(length<Math.max(10,item.caps.length?(machine==='50'?72:80):10)||length>spec.section_length*4)throw Error('节长超出设计范围或小于开口投影宽度');
    row.length=length;
   }
   return row;
  })};
  if(Object.hasOwn(layout,'screw_length')){const n=layout.screw_length;if(!Number.isInteger(n)||n<100||n>MAX_MODULES*spec.section_length*4+1000)throw Error('方案螺杆目标长度无效');result.screw_length=n}
  return result;
 }
 function rows(machine,spec,ports={}){
  let mm=0;const layout=ports.barrel_layout,items=layout==null?spec.barrel_configuration:normalize(machine,spec,layout).modules,known=new Map(catalog(spec).map(x=>[x.key,x]));
  return items.map((x,i)=>{
   let r;if(layout==null){r={...x,start:mm,length:x.mm-mm,machine,nominal_diameter:spec.diameter,open:ports[x.port_key]??true};r.cap=r.open?'open':'closed'}
   else{r={...known.get(x.key),...x,pos:position(i),start:mm};r.mm=mm+r.length;r.port_key=PORT_ROLES.includes(r.role)?'module-'+r.uid:''}
   mm=r.mm;r.annotation=r.cap==='inject'?'INJECT':r.cap==='closed'?'CLOSED':({feed:'FEED',natural:'ATM',side:'SIDE FEED',vacuum:'VAC',side_vacuum:'SIDE VAC'}[r.role]||(r.role==='heat'?`${r.length} mm`:''));
   r.accessory=r.cap==='closed'?(r.role==='side'?'侧喂料堵头':r.role==='side_vacuum'?'侧真空堵头':'顶部全封闭堵头'):r.cap==='inject'?'中心注液堵头':'无堵头';
   r.portKey=r.port_key||(PORT_ROLES.includes(r.role)?'standard-'+i:'');r.fixed=!r.portKey;return r;
  });
 }
 function materialize(machine,spec,ports){
  if(ports.barrel_layout!=null)return normalize(machine,spec,ports.barrel_layout);
  return {version:1,machine,modules:rows(machine,spec,ports).map((r,i)=>{const item=catalog(spec).find(c=>c.name===r.name&&c.role===r.role&&c.length===r.length);if(!item)throw Error('标准机筒模块尚未核对，无法编辑');return {uid:'standard-'+i,key:item.key,open:r.open,cap:r.cap}})};
 }
 function zones(machine,spec,ports){const width=machine==='50'?72:80;return rows(machine,spec,ports).flatMap((r,i)=>{if(!['natural','side','vacuum','side_vacuum'].includes(r.role)||!r.open)return [];const center=r.start+r.length/2;return [{section:i+1,kind:r.role,start:center-width/2-30,end:center+width/2+30}]})}
 function targetLength(machine,spec,ports){return ports.barrel_layout!=null?(normalize(machine,spec,ports.barrel_layout).screw_length??spec.element_length):spec.element_length}
 function summary(machine,spec,ports){const rs=rows(machine,spec,ports),process=rs.filter(r=>!['heat','flange'].includes(r.role)),active=process.reduce((n,r)=>n+r.length,0),length=rs.reduce((n,r)=>n+r.length,0);return {sections:process.length,active_length:active,process_d:Math.round(active/spec.section_length*4*1000)/1000,barrel_length:length,suggested_screw_length:spec.element_length+length-spec.barrel_length}}
 function warnings(machine,spec,ports){
  if(ports.barrel_layout==null)return [];const rs=rows(machine,spec,ports),length=rs.reduce((n,r)=>n+r.length,0),notes=['自定义机筒配置：需复核筒体内径、间隙、轴长及开口位置，未核对前不可直接用于生产'];
  if(!rs.length)notes.push('机筒配置为空');if(length!==spec.barrel_length)notes.push(`机筒总长 ${length} mm，与标准 ${spec.barrel_length} mm 不符；标准螺杆轴长不自动延长`);
  if(rs.filter(r=>r.role==='feed'&&r.open).length!==1)notes.push('主喂料模块数量不为1');if(rs.filter(r=>r.role==='flange').length!==1)notes.push('连接法兰数量不为1');
  if(targetLength(machine,spec,ports)!==spec.element_length)notes.push('已指定方案螺杆目标长度：实际轴长、强度及驱动适配需工程复核');return notes;
 }
 return {MAX_MODULES,PORT_ROLES,catalog,position,normalize,rows,materialize,zones,warnings,targetLength,summary};
});
