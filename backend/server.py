#!/usr/bin/env python3
"""Guangjun twin-screw configuration LAN server (stdlib + SQLite).
Run this file, then open the printed URL on macOS or Windows.
"""
from __future__ import annotations
import base64, hashlib, io, json, mimetypes, os, re, shutil, socket, sqlite3, subprocess, sys, tempfile, traceback, uuid
import gzip
from functools import lru_cache
from datetime import datetime
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote, quote
import barrel_models
from web_auth import AuthStore, ClosingConnection
from web_handlers import AuthMixin

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / "frontend" / "dist"
DATA = Path(os.environ.get("GJ_DATA_DIR", str(ROOT / "runtime" / "server" / "data"))).resolve()
BACKUPS = Path(os.environ.get("GJ_BACKUP_DIR", str(ROOT / "runtime" / "server" / "backups"))).resolve()
DB_PATH = DATA / "guangjun_screw.db"
SEED_PATH = ROOT / "backend" / "resources" / "seed.json"

@lru_cache(maxsize=64)
def static_payload(path, modified, size, compressed):
    body = Path(path).read_bytes()
    return gzip.compress(body, compresslevel=6, mtime=0) if compressed else body
HOST = os.environ.get("GJ_HOST", "0.0.0.0")
PORT = int(os.environ.get("GJ_PORT", "8731"))
CONFIRM_CODE = "13566070731"
AUTH_USER = os.environ.get("GJ_AUTH_USER", "")
AUTH_PASSWORD = os.environ.get("GJ_AUTH_PASSWORD", "")
AUTH_REQUIRED = os.environ.get("GJ_AUTH_REQUIRED", "0") == "1"


def now(): return datetime.now().isoformat(timespec="seconds")
def dumps(v): return json.dumps(v, ensure_ascii=False, separators=(",", ":"))
def loads(v, default=None):
    try: return json.loads(v) if v else default
    except Exception: return default

def element_parameters(name: str):
    numeric_name = re.sub(r'\(\d+\)$', '', name or '')
    nums = [int(x) for x in re.findall(r"\d+", numeric_name)]
    kind = element_type(name)
    length = nums[-1] if nums else 0
    pitch = discs = angle = None
    if kind in ("KB", "KBX") and len(nums) >= 4:
        discs, length, angle = nums[0], nums[-2], nums[-1]
    elif kind in ("GFA", "GFF", "GFM", "SME") and len(nums) >= 3:
        pitch = nums[-2]
    direction = "LI" if re.search(r"(?:-|°|度|^)LI?$", name or "", re.I) else ("RE" if re.search(r"(?:-|°|度|^)RE$", name or "", re.I) else "")
    return {"length": length, "pitch": pitch, "discs": discs, "angle": angle, "direction": direction}


def element_length(name: str) -> int:
    return element_parameters(name)["length"]

def element_type(name: str) -> str:
    up = (name or "").upper()
    for kind in ("GFA", "GFF", "GFM", "SME", "KBX", "KB", "KS", "SPACER"):
        if up.startswith(kind): return "Spacer" if kind == "SPACER" else kind
    return "OTHER"

def db():
    conn = sqlite3.connect(DB_PATH, timeout=20, factory=ClosingConnection)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    DATA.mkdir(parents=True, exist_ok=True); BACKUPS.mkdir(parents=True, exist_ok=True)
    with db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS components(
          id TEXT PRIMARY KEY, machine TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL,
          length INTEGER NOT NULL, pitch INTEGER, discs INTEGER, angle INTEGER, direction TEXT,
          stock INTEGER, note TEXT, active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
          UNIQUE(machine,name)
        );
        CREATE TABLE IF NOT EXISTS templates(
          id TEXT PRIMARY KEY, machine TEXT NOT NULL, name TEXT NOT NULL, version TEXT,
          drawing_date TEXT, material TEXT, source TEXT, sequence_json TEXT NOT NULL,
          total_length INTEGER NOT NULL, is_default INTEGER NOT NULL DEFAULT 0, note TEXT
        );
        CREATE TABLE IF NOT EXISTS projects(
          id TEXT PRIMARY KEY, name TEXT NOT NULL, machine TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
          metadata_json TEXT NOT NULL, sequence_json TEXT NOT NULL, ports_json TEXT NOT NULL,
          violations_json TEXT, override_reason TEXT, stock_applied INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL, released_at TEXT, voided_at TEXT
        );
        CREATE TABLE IF NOT EXISTS inventory_transactions(
          id INTEGER PRIMARY KEY AUTOINCREMENT, component_id TEXT NOT NULL, delta INTEGER NOT NULL,
          reason TEXT NOT NULL, project_id TEXT, created_at TEXT NOT NULL,
          FOREIGN KEY(component_id) REFERENCES components(id)
        );
        CREATE TABLE IF NOT EXISTS audit_log(
          id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, detail TEXT,
          project_id TEXT, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
        """)
        if c.execute("SELECT COUNT(*) FROM components").fetchone()[0] == 0:
            seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
            t = now()
            for x in seed["components"]:
                c.execute("INSERT OR IGNORE INTO components VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (
                    x["id"],x["machine"],x["name"],x["type"],x["length"],x.get("pitch"),x.get("discs"),
                    x.get("angle"),x.get("direction",""),x.get("stock"),x.get("note",""),1,t,t))
            for x in seed["templates"]:
                c.execute("INSERT OR IGNORE INTO templates VALUES(?,?,?,?,?,?,?,?,?,?,?)", (
                    x["id"],x["machine"],x["name"],x.get("version",""),x.get("date",""),x.get("material",""),
                    x.get("source",""),dumps(x["sequence"]),x["total_length"],int(x.get("is_default",False)),x.get("note","")))
        defaults = {
            "confirm_code_hash": hashlib.sha256(CONFIRM_CODE.encode()).hexdigest(),
            "confirm_hint": "负责人电话号码，尾号0731",
            "company_cn": "宁波广俊塑料科技有限公司",
            "company_en": "Ningbo Guangjun Plastics Technology Co., Ltd.",
            "drawing_language": "zh",
            "schema_version": "1"
        }
        for k,v in defaults.items(): c.execute("INSERT OR IGNORE INTO settings VALUES(?,?)",(k,v))
        # Repair imported engineering fields from the model name. Older builds
        # left pitch/disc/angle empty and misread malformed KB names without °.
        for row in c.execute("SELECT id,name,note FROM components").fetchall():
            if (row["note"] or "").startswith("由莱斯特瑞兹"):
                p = element_parameters(row["name"])
                c.execute("UPDATE components SET length=?,pitch=?,discs=?,angle=?,direction=?,updated_at=? WHERE id=?",
                          (p["length"],p["pitch"],p["discs"],p["angle"],p["direction"],now(),row["id"]))

    AuthStore(DATA).initialize(AUTH_USER, AUTH_PASSWORD)
    if AUTH_REQUIRED and not AuthStore(DATA).enabled():
        raise RuntimeError('云端登录凭据缺失；拒绝以无保护模式启动')

def automatic_backup(force=False):
    """Create one consistent SQLite backup per day and retain the newest 30."""
    if not DB_PATH.exists(): return None
    stamp=datetime.now().strftime("%Y%m%d-%H%M%S" if force else "%Y%m%d")
    dest=BACKUPS/f"guangjun-screw-{stamp}.db"
    if not dest.exists():
        source=sqlite3.connect(DB_PATH); target=sqlite3.connect(dest)
        try: source.backup(target)
        finally: target.close(); source.close()
    auth_source=DATA/'web_auth.db';auth_dest=BACKUPS/f'web-auth-{stamp}.db'
    if auth_source.exists() and not auth_dest.exists():
        with sqlite3.connect(auth_source, factory=ClosingConnection) as source, sqlite3.connect(auth_dest, factory=ClosingConnection) as target:source.backup(target)
        auth_dest.chmod(0o600)
    for pattern in ('guangjun-screw-*.db','web-auth-*.db'):
        files=sorted(BACKUPS.glob(pattern),key=lambda p:p.stat().st_mtime,reverse=True)
        for old in files[30:]:old.unlink(missing_ok=True)
    return dest

def machine_specs():
    seed=json.loads(SEED_PATH.read_text(encoding="utf-8"))
    machines=seed["machines"]
    for machine,spec in machines.items():
        spec['barrel_catalog']=barrel_models.catalog(machine,spec)
        spec['diameter_note']='名义直径；实际螺杆外径、机筒内径及间隙须以供应商图纸核对'
    return machines

def barrel_configuration(machine, ports=None):
    return barrel_models.rows(machine,machine_specs()[machine],ports)

def normalize_ports(machine, ports):
    if not isinstance(ports,dict): raise ValueError('开口配置必须为对象')
    result=dict(ports)
    if result.get('barrel_layout') is not None:
        result['barrel_layout']=barrel_models.normalize(machine,machine_specs()[machine],result['barrel_layout'])
    return result

def component_rows(c):
    return [dict(r) for r in c.execute("SELECT * FROM components WHERE active=1 ORDER BY machine,type,length,name")]

def template_rows(c):
    out=[]
    for r in c.execute("SELECT * FROM templates ORDER BY machine,drawing_date,version"):
        x=dict(r); x["sequence"]=loads(x.pop("sequence_json"),[]); x["is_default"]=bool(x["is_default"]); out.append(x)
    return out

def project_rows(c, full=True):
    out=[]
    cols="*" if full else "id,name,machine,status,metadata_json,created_at,updated_at,released_at,voided_at"
    for r in c.execute(f"SELECT {cols} FROM projects ORDER BY updated_at DESC"):
        x=dict(r); x["metadata"]=loads(x.pop("metadata_json"),{})
        if full:
            x["sequence"]=loads(x.pop("sequence_json"),[]); x["ports"]=loads(x.pop("ports_json"),{})
            x["violations"]=loads(x.pop("violations_json"),[])
        out.append(x)
    return out

def restriction_zones(machine, ports):
    if ports.get('barrel_layout') is not None:
        width={'50':72,'60':80}[machine];zones=[]
        for i,row in enumerate(barrel_configuration(machine,ports)):
            if row['role'] not in ('natural','side','vacuum','side_vacuum') or not row['open']:continue
            center=row['start']+row['length']/2
            zones.append(dict(section=i+1,kind=row['role'],start=center-width/2-30,end=center+width/2+30))
        return zones
    spec=machine_specs()[machine]; L=spec["section_length"]; heat=spec["heat_barrier"]
    widths={"50":72,"60":80}; width=widths[machine]; extra=30
    kinds={4:"natural",5:"side",7:"natural",8:"side",11:"vacuum"}
    zones=[]
    for sec,kind in kinds.items():
        if kind=="natural" and not ports.get(f"natural{sec}",True): continue
        start=(sec-1)*L + (heat if sec>1 else 0)
        center=start+L/2
        zones.append({"section":sec,"kind":kind,"start":center-width/2-extra,"end":center+width/2+extra})
    return zones

def validate(machine, sequence, ports):
    spec=machine_specs()[machine];ports=normalize_ports(machine,ports)
    with db() as c:
        cm={(r["name"]):(r["length"],r["type"]) for r in c.execute("SELECT name,length,type FROM components WHERE machine=?",(machine,))}
    pos=-spec["entry_offset"]; spans=[]
    for i,name in enumerate(sequence):
        length,typ=cm.get(name,(element_length(name),element_type(name)))
        spans.append({"index":i,"name":name,"type":typ,"start":pos,"end":pos+length,"length":length}); pos+=length
    violations=[]
    for span in spans:
        if span["type"].upper() == "GFA": continue
        for zone in restriction_zones(machine,ports):
            if max(span["start"],zone["start"]) < min(span["end"],zone["end"]):
                violations.append({**span,"zone":zone}); break
    total=sum(x["length"] for x in spans)
    return {"total":total,"target":barrel_models.target_length(machine,spec,ports),"difference":total-barrel_models.target_length(machine,spec,ports),"spans":spans,"zones":restriction_zones(machine,ports),"violations":violations,"barrel_warnings":barrel_models.warnings(machine,spec,ports),"barrel_length":sum(r['length'] for r in barrel_configuration(machine,ports))}

def parse_import(filename, raw):
    ext=Path(filename).suffix.lower(); result={"filename":filename,"sequence":[],"metadata":{},"warnings":[]}
    if ext==".json":
        obj=json.loads(raw.decode("utf-8")); p=obj.get("project",obj)
        result.update({"machine":str(p.get("machine","50")),"sequence":p.get("sequence",[]),"metadata":p.get("metadata",{}),"ports":p.get("ports",{})})
        result['ports']=normalize_ports(result['machine'],result['ports'])
        if result['ports'].get('barrel_layout') is not None:result['warnings'].append('包含自定义机筒布局；生产前需工程复核')
        return result
    if ext==".pdf":
        try: import fitz
        except ImportError: raise RuntimeError("未安装PyMuPDF，暂时不能导入PDF")
        doc=fitz.open(stream=raw,filetype="pdf")
        if len(doc)<3: result["warnings"].append("PDF少于3页，将尝试从全部页面识别")
        text="\n".join(p.get_text("text") for p in doc)
        result["machine"]="60" if re.search(r"(?:60CC|diameter:\s*60)",text,re.I) else "50"
        page=doc[min(2,len(doc)-1)]; words=page.get_text("words")
        pattern=re.compile(r"^(?:GFA|GFF|GFM|SME|KBX?|KS|Spacer)[A-Za-z0-9°()/_+.\-]*$",re.I)
        cand=[(w[0],w[1],w[4]) for w in words if w[1]<350 and w[0]<410 and pattern.match(w[4])]
        groups=[]
        for item in sorted(cand,key=lambda z:z[0]):
            for g in groups:
                if abs(g[0][0]-item[0])<45: g.append(item); break
            else: groups.append([item])
        groups.sort(key=lambda g:min(x for x,_,_ in g))
        result["sequence"]=[s for g in groups for _,_,s in sorted(g,key=lambda z:z[1])]
        if not result["sequence"]:
            result["warnings"].append("没有识别到元件，请人工检查或改用Excel导入")
        result["metadata"]={"drawing_name":Path(filename).stem,"source_file":filename}
        return result
    if ext in (".xlsx",".xlsm"):
        try: from openpyxl import load_workbook
        except ImportError: raise RuntimeError("未安装openpyxl，暂时不能导入Excel")
        wb=load_workbook(io.BytesIO(raw),read_only=True,data_only=True); pat=re.compile(r"^(?:GFA|GFF|GFM|SME|KBX?|KS|Spacer)",re.I)
        ws=wb.active
        for row in ws.iter_rows(values_only=True):
            for val in row:
                s=str(val).strip() if val is not None else ""
                if pat.match(s): result["sequence"].append(s); break
        result["machine"]="60" if any("80-" in s or "120-A" in s for s in result["sequence"]) else "50"
        result["metadata"]={"drawing_name":f"{Path(filename).stem}-{ws.title}","source_file":filename}
        return result
    raise RuntimeError("仅支持PDF、XLSX和软件JSON工程文件")

class Handler(AuthMixin, BaseHTTPRequestHandler):
    server_version="GuangjunScrew/1.0"
    def end_headers(self):
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('X-Frame-Options','DENY')
        self.send_header('Referrer-Policy','same-origin')
        super().end_headers()
    def log_message(self, fmt, *args): print("[%s] %s"%(self.log_date_time_string(),fmt%args))
    def send_json(self,obj,status=200):
        body=json.dumps(obj,ensure_ascii=False).encode(); self.send_response(status); self.send_header("Content-Type","application/json; charset=utf-8"); self.send_header("Content-Length",len(body)); self.send_header("Cache-Control","no-store"); self.end_headers(); self.wfile.write(body)
    def send_bytes(self,body,ctype,name=None):
        self.send_response(200); self.send_header("Content-Type",ctype); self.send_header("Content-Length",len(body));
        if name:self.send_header("Content-Disposition",f"attachment; filename*=UTF-8''{quote(name)}")
        self.end_headers();self.wfile.write(body)
    def body_json(self):
        n=int(self.headers.get("Content-Length","0"));
        if n>30*1024*1024: raise ValueError("文件过大")
        return json.loads(self.rfile.read(n) or b"{}")
    def do_GET(self):
        if self.auth_public_get():return
        if not self.require_auth():return
        try:
            p=urlparse(self.path).path
            if p=="/api/bootstrap":
                with db() as c:
                    settings={r["key"]:r["value"] for r in c.execute("SELECT key,value FROM settings") if r["key"]!="confirm_code_hash"}
                    self.send_json({"machines":machine_specs(),"components":component_rows(c),"templates":template_rows(c),"projects":project_rows(c,False),"settings":settings,"auth":self.auth_context()}); return
            if p.startswith("/api/projects/"):
                pid=p.rsplit("/",1)[-1]
                with db() as c:
                    rows=[]
                    for r in c.execute("SELECT * FROM projects WHERE id=?",(pid,)):
                        x=dict(r);x["metadata"]=loads(x.pop("metadata_json"),{});x["sequence"]=loads(x.pop("sequence_json"),[]);x["ports"]=loads(x.pop("ports_json"),{});x["violations"]=loads(x.pop("violations_json"),[]);rows.append(x)
                    if not rows:self.send_json({"error":"项目不存在"},404)
                    else:self.send_json(rows[0])
                return
            if p=="/api/inventory/history":
                with db() as c:self.send_json([dict(r) for r in c.execute("SELECT t.*,c.name,c.machine FROM inventory_transactions t JOIN components c ON c.id=t.component_id ORDER BY t.id DESC LIMIT 500")]);return
            self.serve_static(p)
        except Exception as e: self.fail(e)
    def do_POST(self):
        if self.auth_public_post():return
        if not self.require_auth():return
        if (DATA/'.deploying').exists() and urlparse(self.path).path!='/api/auth/logout':
            self.send_json({'error':'正在校验升级，请稍后重试；当前操作尚未保存'},503);return
        try:
            path=urlparse(self.path).path; data=self.body_json()
            if self.auth_private_post(path,data):return
            if path=="/api/validate": self.send_json(validate(str(data["machine"]),data.get("sequence",[]),data.get("ports",{})));return
            if path=="/api/verify-code":
                with db() as c:h=c.execute("SELECT value FROM settings WHERE key='confirm_code_hash'").fetchone()[0]
                self.send_json({"ok":hashlib.sha256(str(data.get("code","")).encode()).hexdigest()==h});return
            if path=="/api/projects": self.save_project(data);return
            if path.endswith("/release") and path.startswith("/api/projects/"): self.release_project(path.split("/")[3],data);return
            if path.endswith("/void") and path.startswith("/api/projects/"): self.void_project(path.split("/")[3],data);return
            if path=="/api/components": self.save_component(data);return
            if path=="/api/inventory/adjust": self.adjust_stock(data);return
            if path=="/api/import":
                raw=base64.b64decode(data.get("data","").split(",")[-1]);self.send_json(parse_import(data.get("filename",""),raw));return
            if path=="/api/export/xlsx": self.export_xlsx(data);return
            if path=="/api/backup":
                dest=automatic_backup(force=True);self.send_json({"ok":True,"file":str(dest)});return
            self.send_json({"error":"接口不存在"},404)
        except Exception as e:self.fail(e)
    def do_DELETE(self):
        if not self.require_auth():return
        if (DATA/'.deploying').exists():
            self.send_json({'error':'正在校验升级，请稍后重试；当前操作尚未执行'},503);return
        try:
            p=urlparse(self.path).path
            if p.startswith("/api/components/"):
                cid=p.rsplit("/",1)[-1]
                with db() as c:
                    row=c.execute("SELECT name FROM components WHERE id=? AND active=1",(cid,)).fetchone()
                    if not row:self.send_json({"error":"元件不存在或已删除"},404);return
                    t=now();c.execute("UPDATE components SET active=0,updated_at=? WHERE id=?",(t,cid));c.execute("INSERT INTO audit_log(action,detail,created_at) VALUES('delete_component',?,?)",(row["name"],t))
                self.send_json({"ok":True});return
            if p.startswith("/api/projects/"):
                pid=p.rsplit("/",1)[-1]
                with db() as c:
                    c.execute("BEGIN IMMEDIATE")
                    r=c.execute("SELECT status FROM projects WHERE id=?",(pid,)).fetchone()
                    if not r:self.send_json({"error":"项目不存在"},404);return
                    if r[0]=="released":self.send_json({"error":"已发布项目请先作废，不能直接删除"},409);return
                    c.execute("DELETE FROM projects WHERE id=?",(pid,));c.execute("INSERT INTO audit_log(action,project_id,created_at) VALUES('delete',?,?)",(pid,now()))
                self.send_json({"ok":True});return
            self.send_json({"error":"接口不存在"},404)
        except Exception as e:self.fail(e)
    def save_project(self,data):
        machine=str(data.get("machine","50"));seq=data.get("sequence",[]);ports=normalize_ports(machine,data.get("ports",{}))
        check=validate(machine,seq,ports); override=(data.get("override_reason") or "").strip(); code=str(data.get("confirm_code", ""))
        if check['difference']>0:
            self.send_json({"error":f"组合总长 {check['total']} mm 超过螺杆可用长度 {check['target']} mm（超出 {check['difference']} mm），请删减元件后保存","validation":check},422);return
        needs=bool(check["violations"] or check["difference"] or check['barrel_warnings'])
        if needs:
            with db() as c:h=c.execute("SELECT value FROM settings WHERE key='confirm_code_hash'").fetchone()[0]
            if not override or hashlib.sha256(code.encode()).hexdigest()!=h:
                self.send_json({"error":"存在长度、安全规则异常或自定义机筒，需要填写复核原因并输入负责人确认码","validation":check},409);return
        pid=data.get("id") or str(uuid.uuid4()); t=now();meta=data.get("metadata",{});name=meta.get("drawing_name") or data.get("name") or f"未命名-{t[:10]}"
        with db() as c:
            c.execute("BEGIN IMMEDIATE")
            old=c.execute("SELECT status,created_at FROM projects WHERE id=?",(pid,)).fetchone()
            if old and old["status"]=="released":self.send_json({"error":"已发布项目不能直接修改，请另存为新版本"},409);return
            created=old["created_at"] if old else t
            c.execute("INSERT OR REPLACE INTO projects(id,name,machine,status,metadata_json,sequence_json,ports_json,violations_json,override_reason,stock_applied,created_at,updated_at,released_at,voided_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",(
                pid,name,machine,"draft",dumps(meta),dumps(seq),dumps(ports),dumps(check["violations"]),override,0,created,t,None,None))
            c.execute("INSERT INTO audit_log(action,detail,project_id,created_at) VALUES(?,?,?,?)",("save",override,pid,t))
        self.send_json({"ok":True,"id":pid,"validation":check})
    def release_project(self,pid,data):
        code=str(data.get("confirm_code",""));reason=(data.get("reason") or "正式发布").strip()
        with db() as c:
            c.execute("BEGIN IMMEDIATE")
            row=c.execute("SELECT * FROM projects WHERE id=?",(pid,)).fetchone()
            if not row:self.send_json({"error":"项目不存在"},404);return
            if row["status"]!="draft":self.send_json({"error":"只有草稿可以发布；已发布或作废方案请先另存"},409);return
            seq=loads(row["sequence_json"],[]); ports=loads(row["ports_json"],{}); check=validate(row["machine"],seq,ports)
            if check['difference']>0:
                self.send_json({"error":f"组合超长 {check['difference']} mm，不能发布，请先修正方案","validation":check},422);return
            h=c.execute("SELECT value FROM settings WHERE key='confirm_code_hash'").fetchone()[0]
            shortages=[]; counts={n:seq.count(n)*2 for n in set(seq)}
            for name,qty in counts.items():
                comp=c.execute("SELECT id,stock FROM components WHERE machine=? AND name=?",(row["machine"],name)).fetchone()
                if comp and comp["stock"] is not None and comp["stock"]<qty:shortages.append({"name":name,"need":qty,"stock":comp["stock"]})
            if (check["violations"] or check["difference"] or check['barrel_warnings'] or shortages) and (not reason or hashlib.sha256(code.encode()).hexdigest()!=h):
                self.send_json({"error":"存在异常或库存不足，需要负责人确认码","validation":check,"shortages":shortages},409);return
            t=now()
            for name,qty in counts.items():
                comp=c.execute("SELECT id,stock FROM components WHERE machine=? AND name=?",(row["machine"],name)).fetchone()
                if comp and comp["stock"] is not None:
                    c.execute("UPDATE components SET stock=stock-?,updated_at=? WHERE id=?",(qty,t,comp["id"]));c.execute("INSERT INTO inventory_transactions(component_id,delta,reason,project_id,created_at) VALUES(?,?,?,?,?)",(comp["id"],-qty,"项目正式发布",pid,t))
            c.execute("UPDATE projects SET status='released',stock_applied=1,released_at=?,updated_at=?,override_reason=CASE WHEN ?<>'' THEN ? ELSE override_reason END WHERE id=?",(t,t,reason,reason,pid))
            c.execute("INSERT INTO audit_log(action,detail,project_id,created_at) VALUES('release',?,?,?)",(reason,pid,t))
        self.send_json({"ok":True,"shortages":shortages})
    def void_project(self,pid,data):
        with db() as c:
            c.execute("BEGIN IMMEDIATE")
            row=c.execute("SELECT * FROM projects WHERE id=?",(pid,)).fetchone()
            if not row:self.send_json({"error":"项目不存在"},404);return
            if row["status"]!="released":self.send_json({"error":"只有已发布项目可以作废"},409);return
            t=now()
            if row["stock_applied"]:
                # Refund the actual net deductions, including older release/void cycles.
                # Unknown stock at release must never create phantom stock on cancellation.
                applied=c.execute("SELECT component_id,-SUM(delta) AS quantity FROM inventory_transactions WHERE project_id=? GROUP BY component_id HAVING SUM(delta)<0",(pid,)).fetchall()
                for txn in applied:
                    qty=txn["quantity"];cid=txn["component_id"]
                    c.execute("UPDATE components SET stock=COALESCE(stock,0)+?,updated_at=? WHERE id=?",(qty,t,cid))
                    c.execute("INSERT INTO inventory_transactions(component_id,delta,reason,project_id,created_at) VALUES(?,?,?,?,?)",(cid,qty,"生产单作废退回",pid,t))
            reason=(data.get("reason") or "生产单作废").strip();c.execute("UPDATE projects SET status='void',stock_applied=0,voided_at=?,updated_at=? WHERE id=?",(t,t,pid));c.execute("INSERT INTO audit_log(action,detail,project_id,created_at) VALUES('void',?,?,?)",(reason,pid,t))
        self.send_json({"ok":True})
    def save_component(self,x):
        machine=str(x.get("machine","50"));name=str(x.get("name","")).strip();raw_length=x.get("length") or element_length(name);length=int(raw_length)
        if not name or length<=0 or isinstance(raw_length,bool) or float(raw_length)!=length:self.send_json({"error":"型号必须填写，长度应为正整数毫米"},400);return
        if machine not in machine_specs():self.send_json({"error":"不支持的机器型号"},400);return
        cid=x.get("id") or hashlib.sha1(f"{machine}:{name}".encode()).hexdigest()[:16];t=now()
        with db() as c:
            c.execute("BEGIN IMMEDIATE")
            old=c.execute("SELECT created_at,stock,name,machine,active FROM components WHERE id=?",(cid,)).fetchone();created=old["created_at"] if old else t;stock=old["stock"] if old else x.get("stock")
            if old and old["active"] and not x.get("id"):
                self.send_json({"error":"该机器中已存在同名型号，请编辑已有元件或使用新型号"},409);return
            if old and (name!=old["name"] or machine!=old["machine"]):
                refs=c.execute("SELECT sequence_json FROM projects WHERE machine=? UNION ALL SELECT sequence_json FROM templates WHERE machine=?",(old["machine"],old["machine"])).fetchall()
                if any(old["name"] in loads(r[0],[]) for r in refs):
                    self.send_json({"error":"该型号已用于方案或模板，不能直接更名或更换机型；请添加新元件"},409);return
            values=(machine,name,x.get("type") or element_type(name),length,x.get("pitch"),x.get("discs"),x.get("angle"),x.get("direction",""),stock,x.get("note",""),1,t)
            try:
                if old:
                    c.execute("UPDATE components SET machine=?,name=?,type=?,length=?,pitch=?,discs=?,angle=?,direction=?,stock=?,note=?,active=?,updated_at=? WHERE id=?",values+(cid,))
                else:
                    c.execute("INSERT INTO components VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",(cid,)+values[:-1]+(created,t))
            except sqlite3.IntegrityError:self.send_json({"error":"该机器中已存在同名型号"},409);return
        self.send_json({"ok":True,"id":cid})
    def adjust_stock(self,x):
        cid=x.get("component_id");mode=x.get("mode","set");raw_qty=x.get("quantity",0);qty=int(raw_qty);reason=(x.get("reason") or "人工盘点").strip();t=now()
        if mode not in ("set","add") or isinstance(raw_qty,bool) or float(raw_qty)!=qty:
            self.send_json({"error":"请填写整数数量并选择有效调整方式"},400);return
        with db() as c:
            c.execute("BEGIN IMMEDIATE")
            row=c.execute("SELECT stock FROM components WHERE id=? AND active=1",(cid,)).fetchone()
            if not row:self.send_json({"error":"元件不存在"},404);return
            old=row["stock"] or 0;new=qty if mode=="set" else old+qty;delta=new-old
            if new<0:self.send_json({"error":"调整后库存不能小于 0"},400);return
            c.execute("UPDATE components SET stock=?,updated_at=? WHERE id=?",(new,t,cid));c.execute("INSERT INTO inventory_transactions(component_id,delta,reason,created_at) VALUES(?,?,?,?)",(cid,delta,reason,t))
        self.send_json({"ok":True,"stock":new})
    def export_xlsx(self,x):
        try:from openpyxl import Workbook
        except ImportError:self.send_json({"error":"服务器未安装openpyxl"},500);return
        p=x.get("project",x);seq=p.get("sequence",[]);machine=str(p.get("machine","50"));meta=p.get("metadata",{});ports=p.get("ports",{})
        with db() as c: comps={r["name"]:dict(r) for r in c.execute("SELECT * FROM components WHERE machine=?",(machine,))}
        wb=Workbook();ws=wb.active;ws.title="元件汇总";ws.append(["kingpolymer Twin-Screw Configurator"]);ws.append(["图纸名称",meta.get("drawing_name","")]);ws.append(["机器型号",machine_specs()[machine]["name"]]);ws.append([]);ws.append(["序号","元件型号","组合位置/套","实际单件/件","库存/件","缺少/件"])
        for i,name in enumerate(sorted(set(seq)),1):
            sets=seq.count(name);stock=comps.get(name,{}).get("stock");need=sets*2;ws.append([i,name,sets,need,"未录入" if stock is None else stock,"未录入" if stock is None else max(0,need-stock)])
        ws2=wb.create_sheet("安装顺序");ws2.append(["序号","轴向坐标/mm","型号","长度/mm","类型","导程/mm","片数","错位角/°","方向"]);position=-machine_specs()[machine]["entry_offset"];origin=machine_specs()[machine].get("position_origin",0)
        for i,name in enumerate(seq,1):
            item=comps.get(name,{});length=item.get("length",element_length(name));position+=length
            ws2.append([i,position+origin,name,length,item.get("type",element_type(name)),item.get("pitch"),item.get("discs"),item.get("angle"),item.get("direction","")])
        ports=normalize_ports(machine,ports)
        ws3=wb.create_sheet("机筒配置");ws3.append(["Pos.","轴向坐标/mm","Label","Annotation","类型","节长/mm","所属机型","名义直径/mm","配套堵头"])
        caps={}
        for row in barrel_configuration(machine,ports):
            ws3.append([row["pos"],row["mm"],row["name"],row["annotation"],row.get("role",""),row['length'],machine,row['nominal_diameter'],row['accessory']])
            if row['cap']!='open':caps.setdefault(row['accessory'],[]).append(row['pos'])
        cap_sheet=wb.create_sheet('堵头清单');cap_sheet.append(['所属机型','堵头类型','配置数量','安装位置','说明'])
        for cap,positions in caps.items():cap_sheet.append([machine,cap,len(positions),', '.join(positions),'配置用量，非库存；接口孔径需核对'])
        ws4=wb.create_sheet('工程复核');ws4.append(['参数说明','名义直径不等于加工内径；实际螺杆外径、机筒内径及间隙须核对供应商图纸'])
        ws4.append(['标准螺杆总长/mm',machine_specs()[machine]['element_length']])
        ws4.append(['方案螺杆目标/mm',barrel_models.target_length(machine,machine_specs()[machine],ports)])
        summary=barrel_models.summary(machine,machine_specs()[machine],ports)
        ws4.append(['工艺D数（标准节4D）',summary['process_d']]);ws4.append(['机筒节数（不含法兰隔热片）',summary['sections']])
        for warning in barrel_models.warnings(machine,machine_specs()[machine],ports):ws4.append(['待复核',warning])
        out=io.BytesIO();wb.save(out);self.send_bytes(out.getvalue(),"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",(meta.get("drawing_name") or "螺杆组合")+".xlsx")
    def serve_static(self,p):
        if p=="/":p="/index.html"
        target=(STATIC/unquote(p.lstrip("/"))).resolve()
        if STATIC.resolve() not in target.parents and target!=STATIC.resolve():self.send_error(403);return
        if not target.is_file():
            if Path(p).suffix or p.startswith('/api/'):
                self.send_error(404);return
            target=STATIC/"index.html"
        if not target.is_file():self.send_error(503,'Build the React frontend first');return
        stat=target.stat()
        ctype=mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        encodings=self.headers.get('Accept-Encoding','')
        compressed=target.suffix in ('.js','.css','.html','.json','.svg') and stat.st_size>1024 and any(part.strip().split(';')[0]=='gzip' and not re.search(r';\s*q=0(?:\.0*)?\s*$',part) for part in encodings.split(','))
        etag=f'"{stat.st_mtime_ns:x}-{stat.st_size:x}{"-gz" if compressed else ""}"'
        immutable=target.parent==STATIC/'assets' and bool(re.search(r'-[A-Za-z0-9_-]{8,}\.(?:js|css)$',target.name))
        cache='public, max-age=31536000, immutable' if immutable else 'no-cache'
        unchanged=etag in [tag.strip().removeprefix('W/') for tag in self.headers.get('If-None-Match','').split(',')]
        self.send_response(304 if unchanged else 200)
        self.send_header('Cache-Control',cache);self.send_header('ETag',etag);self.send_header('Vary','Accept-Encoding')
        if unchanged:self.end_headers();return
        body=static_payload(str(target),stat.st_mtime_ns,stat.st_size,compressed)
        self.send_header('Content-Type',ctype+('; charset=utf-8' if ctype.startswith('text/') else ''))
        if compressed:self.send_header('Content-Encoding','gzip')
        self.send_header('Content-Length',len(body));self.end_headers();self.wfile.write(body)
    def fail(self,e):
        traceback.print_exc();self.send_json({"error":str(e)},400 if isinstance(e,ValueError) else 500)

def local_ip():
    candidates=[]
    if sys.platform=="darwin":
        for interface in ("en0","en1"):
            try:
                ip=subprocess.check_output(["ipconfig","getifaddr",interface],text=True,stderr=subprocess.DEVNULL).strip()
                if ip:candidates.append(ip)
            except Exception: pass
    try:candidates.extend(socket.gethostbyname_ex(socket.gethostname())[2])
    except Exception:pass
    try:
        s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM);s.connect(("8.8.8.8",80));candidates.append(s.getsockname()[0]);s.close()
    except Exception:pass
    # Prefer ordinary factory/home LAN ranges over VPN tunnel addresses.
    for prefix in ("192.168.","10.","172.16.","172.17.","172.18.","172.20.","172.21.","172.22.","172.23.","172.24.","172.25.","172.26.","172.27.","172.28.","172.29.","172.30.","172.31."):
        if any(ip.startswith(prefix) for ip in candidates):return next(ip for ip in candidates if ip.startswith(prefix))
    return next((ip for ip in candidates if ip!="127.0.0.1"),"127.0.0.1")

def main():
    init_db();automatic_backup();httpd=ThreadingHTTPServer((HOST,PORT),Handler)
    print("\nkingpolymer Twin-Screw Configurator 已启动")
    print(f"本机访问: http://127.0.0.1:{PORT}")
    if HOST not in ('127.0.0.1', '::1'):
        print(f"局域网访问: http://{local_ip()}:{PORT}")
    print("停止软件请按 Ctrl+C\n")
    try:httpd.serve_forever()
    except KeyboardInterrupt:print("\n软件已停止")
    finally:httpd.server_close()

if __name__=="__main__":main()
