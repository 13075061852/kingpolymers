import { useState } from 'react';
import { Plus, ArrowUp, ArrowDown, Copy, Trash2 } from 'lucide-react';
import BarrelModels from '../domain/barrel-models.js';
import Modal from './Modal.jsx';
const capNames = { open: '工作开口', closed: '全封闭堵头', inject: '中心注液堵头' };
export default function BarrelPanel({ data, design, edit, notify }) {
  const spec = data.machines[design.machine],
    rows = BarrelModels.rows(design.machine, spec, design.ports);
  const [config, setConfig] = useState(null),
    [add, setAdd] = useState(false);
  function change(fn) {
    try {
      const layout = structuredClone(BarrelModels.materialize(design.machine, spec, design.ports));
      fn(layout);
      const normalized = BarrelModels.normalize(design.machine, spec, layout);
      edit((d) => {
        d.ports.barrel_layout = normalized;
      });
      return true;
    } catch (error) {
      notify(error.message, true);
      return false;
    }
  }
  return (
    <section className="panel barrel-panel">
      <div className="section-head">
        <div>
          <h2>机筒配置</h2>
          <span>
            {rows.length} 个模块 · {rows.at(-1)?.mm || 0} mm
          </span>
        </div>
        <div className="row-actions">
          <button title="添加机筒" aria-label="添加机筒" onClick={() => setAdd(true)}>
            <Plus size={16} />
          </button>
          <button onClick={() => setConfig({ target: true })}>轴长</button>
          <button
            onClick={() => {
              if (confirm('恢复本机标准机筒？当前操作可以撤销。'))
                edit((d) => {
                  d.ports = { natural4: true, natural7: true };
                });
            }}
          >
            标准
          </button>
        </div>
      </div>
      <div className="barrel-rows">
        {rows.map((row, i) => (
          <div className="barrel-row" key={row.uid || row.pos}>
            <span className="position">{row.pos}</span>
            <button className="barrel-name" onClick={() => setConfig({ index: i, row })}>
              <strong>{row.name}</strong>
              <small>
                {row.length} mm · {row.annotation || '普通机筒'}
                {row.cap !== 'open' ? ' · ' + capNames[row.cap] : ''}
              </small>
            </button>
            <div className="mini-actions">
              <button
                aria-label={`上移机筒 ${row.pos}`}
                disabled={!i}
                onClick={() =>
                  change((l) => {
                    [l.modules[i - 1], l.modules[i]] = [l.modules[i], l.modules[i - 1]];
                  })
                }
              >
                <ArrowUp size={13} />
              </button>
              <button
                aria-label={`下移机筒 ${row.pos}`}
                disabled={i === rows.length - 1}
                onClick={() =>
                  change((l) => {
                    [l.modules[i + 1], l.modules[i]] = [l.modules[i], l.modules[i + 1]];
                  })
                }
              >
                <ArrowDown size={13} />
              </button>
              <button
                aria-label={`复制机筒 ${row.pos}`}
                onClick={() =>
                  change((l) =>
                    l.modules.splice(i + 1, 0, { ...l.modules[i], uid: crypto.randomUUID() }),
                  )
                }
              >
                <Copy size={13} />
              </button>
              <button
                aria-label={`删除机筒 ${row.pos}`}
                onClick={() => change((l) => l.modules.splice(i, 1))}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {add && (
        <Modal title="添加机筒模块" onClose={() => setAdd(false)}>
          <p className="muted">仅列出当前 {design.machine} 机已核对的模块。</p>
          <div className="module-grid">
            {spec.barrel_catalog.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  if (
                    change((l) =>
                      l.modules.splice(Math.max(0, l.modules.length - 1), 0, {
                        uid: crypto.randomUUID(),
                        key: item.key,
                        open: true,
                        cap: 'open',
                      }),
                    )
                  )
                    setAdd(false);
                }}
              >
                <strong>{item.name}</strong>
                <small>
                  {item.length} mm · {item.role}
                </small>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {config && (
        <Modal
          title={config.target ? '方案螺杆目标长度' : config.row.name}
          onClose={() => setConfig(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fields = Object.fromEntries(new FormData(e.currentTarget));
              if (
                change((l) => {
                  if (config.target) l.screw_length = Number(fields.length);
                  else {
                    const row = l.modules[config.index];
                    row.length = Number(fields.length);
                    row.cap = fields.cap || 'open';
                    row.open = row.cap !== 'closed';
                  }
                })
              )
                setConfig(null);
            }}
          >
            <label>
              {config.target ? '目标长度 / mm' : '节长 / mm'}
              <input
                name="length"
                type="number"
                min="1"
                step="1"
                required
                defaultValue={
                  config.target
                    ? BarrelModels.targetLength(design.machine, spec, design.ports)
                    : config.row.length
                }
              />
            </label>
            {!config.target && (
              <label>
                开口与堵头
                <select name="cap" defaultValue={config.row.cap}>
                  {(spec.barrel_catalog.find(
                    (c) => c.name === config.row.name && c.role === config.row.role,
                  )?.caps?.length
                    ? spec.barrel_catalog.find(
                        (c) => c.name === config.row.name && c.role === config.row.role,
                      ).caps
                    : ['open']
                  ).map((cap) => (
                    <option key={cap} value={cap}>
                      {capNames[cap]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="muted">自定义节长和布局仍须工程复核，系统保留保存与发布校验。</p>
            <footer>
              <button type="button" onClick={() => setConfig(null)}>
                取消
              </button>
              <button className="primary">应用配置</button>
            </footer>
          </form>
        </Modal>
      )}
    </section>
  );
}
