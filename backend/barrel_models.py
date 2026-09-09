"""Machine-isolated engineering layouts, optional lengths and compatible caps.
Custom dimensions are proposed engineering values, never manufacturing approvals.
"""
import re
MAX_MODULES=60
PORT_ROLES=('feed','natural','vacuum','side','side_vacuum')
CAP_NAMES={'open':'工作开口','closed':'全封闭堵头','inject':'中心注液堵头'}

def catalog(machine,spec):
    prefix='Zylinder ' if machine=='50' else 'Zyl-'
    items=[('barrel',prefix+'0','barrel',spec['section_length']),('feed',prefix+'E','feed',spec['section_length']),('natural',prefix+'1','natural',spec['section_length']),('vacuum',prefix+'1','vacuum',spec['section_length']),('side','Zylinder S (LSB047)' if machine=='50' else 'Zyl-S (LSB 56)','side',spec['section_length']),('side_vacuum','Side vacuum','side_vacuum',spec['section_length']),('flange','Zwischenflansch','flange',spec['flange_length'])]
    if spec['heat_barrier']>0:items.append(('heat','Wärmesperre','heat',spec['heat_barrier']))
    return [dict(key=f'{machine}:{key}',machine=machine,name=name,role=role,length=length,nominal_diameter=spec['diameter'],bore_diameter=None,caps=(['open','closed','inject'] if role in ('natural','vacuum') else ['open','closed'] if role in PORT_ROLES else [])) for key,name,role,length in items]

def position(index):
    out='';index+=1
    while index:index,r=divmod(index-1,26);out=chr(65+r)+out
    return out

def normalize(machine,spec,layout):
    if not isinstance(layout,dict) or layout.get('version')!=1 or layout.get('machine')!=machine:raise ValueError('机筒配置版本或所属机型不符，50/60机模块不能混用')
    modules=layout.get('modules')
    if not isinstance(modules,list) or len(modules)>MAX_MODULES:raise ValueError(f'机筒模块最多{MAX_MODULES}个')
    known={x['key']:x for x in catalog(machine,spec)};ids=set();result=[]
    for m in modules:
        if not isinstance(m,dict) or m.get('key') not in known:raise ValueError('机筒模块不属于当前机型或未核对型号')
        item=known[m['key']];uid=m.get('uid');opened=m.get('open',True)
        if not isinstance(uid,str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,80}',uid) or uid in ids:raise ValueError('机筒模块标识无效或重复')
        if not isinstance(opened,bool):raise ValueError('排气口状态必须为布尔值')
        ids.add(uid);cap=m.get('cap','open' if opened else 'closed')
        if item['caps']:
            if cap not in item['caps']:raise ValueError('堵头与当前机筒开口不兼容')
        else:
            if m.get('cap','open')!='open':raise ValueError('该模块没有可安装堵头的开口')
            cap='open'
        row=dict(uid=uid,key=m['key'],open=cap!='closed',cap=cap)
        if 'length' in m:
            length=m['length']
            if type(length)!=int:raise ValueError('节长必须为整数毫米')
            if item['role'] in ('heat','flange'):
                if length!=item['length']:raise ValueError('隔热片及法兰长度按本机标准保留')
            elif not (max(10,({'50':72,'60':80}[machine] if item['caps'] else 10))<=length<=spec['section_length']*4):raise ValueError('节长超出设计范围或小于开口投影宽度')
            row['length']=length
        result.append(row)
    out=dict(version=1,machine=machine,modules=result)
    if 'screw_length' in layout:
        n=layout['screw_length']
        if type(n)!=int or not 100<=n<=MAX_MODULES*spec['section_length']*4+1000:raise ValueError('方案螺杆目标长度无效')
        out['screw_length']=n
    return out

def rows(machine,spec,ports):
    ports=ports or {};layout=ports.get('barrel_layout');result=[];mm=0
    if layout is None:
        for source in spec['barrel_configuration']:
            r=dict(source);r.update(start=mm,length=r['mm']-mm,machine=machine,nominal_diameter=spec['diameter']);mm=r['mm'];r['open']=ports.get(r.get('port_key'),True);r['cap']='open' if r['open'] else 'closed';result.append(r)
    else:
        layout=normalize(machine,spec,layout);known={x['key']:x for x in catalog(machine,spec)}
        for i,m in enumerate(layout['modules']):
            r={**known[m['key']],**m,'pos':position(i),'start':mm};mm+=r['length'];r['mm']=mm;r['port_key']='module-'+r['uid'] if r['role'] in PORT_ROLES else '';result.append(r)
    for r in result:
        role=r['role'];cap=r['cap']
        r['annotation']='INJECT' if cap=='inject' else 'CLOSED' if cap=='closed' else {'feed':'FEED','natural':'ATM','side':'SIDE FEED','vacuum':'VAC','side_vacuum':'SIDE VAC'}.get(role,f"{r['length']} mm" if role=='heat' else '')
        r['accessory']=('侧喂料堵头' if role=='side' else '侧真空堵头' if role=='side_vacuum' else '顶部全封闭堵头') if cap=='closed' else '中心注液堵头' if cap=='inject' else '无堵头'
    return result

def target_length(machine,spec,ports):
    layout=(ports or {}).get('barrel_layout')
    return normalize(machine,spec,layout).get('screw_length',spec['element_length']) if layout is not None else spec['element_length']

def summary(machine,spec,ports):
    rs=rows(machine,spec,ports);process=[r for r in rs if r['role'] not in ('heat','flange')];active=sum(r['length'] for r in process)
    return dict(sections=len(process),active_length=active,process_d=round(active/spec['section_length']*4,3),barrel_length=sum(r['length'] for r in rs),suggested_screw_length=spec['element_length']+sum(r['length'] for r in rs)-spec['barrel_length'])

def warnings(machine,spec,ports):
    if (ports or {}).get('barrel_layout') is None:return []
    rs=rows(machine,spec,ports);length=sum(r['length'] for r in rs)
    notes=['自定义机筒配置：需复核筒体内径、间隙、轴长及开口位置，未核对前不可直接用于生产']
    if not rs:notes.append('机筒配置为空')
    if length!=spec['barrel_length']:notes.append(f"机筒总长 {length} mm，与标准 {spec['barrel_length']} mm 不符；标准螺杆轴长不自动延长")
    if sum(r['role']=='feed' and r['open'] for r in rs)!=1:notes.append('主喂料模块数量不为1')
    if sum(r['role']=='flange' for r in rs)!=1:notes.append('连接法兰数量不为1')
    if target_length(machine,spec,ports)!=spec['element_length']:notes.append('已指定方案螺杆目标长度：实际轴长、强度及驱动适配需工程复核')
    return notes
