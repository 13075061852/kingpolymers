import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import ComponentModels from '../domain/component-models.js';
import Modal from '../components/Modal.jsx';
export default function Components({ data, onSave, onDelete }) {
  const [machine, setMachine] = useState('50'),
    [query, setQuery] = useState(''),
    [editing, setEditing] = useState(null);
  const rows = data.components.filter(
    (c) => c.machine === machine && ComponentModels.matches(c, query),
  );
  return (
    <section className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">COMPONENT CATALOG</span>
          <h1>元件库</h1>
          <p>按机器分别管理完整型号和参数。</p>
        </div>
        <button className="primary" onClick={() => setEditing({ machine, type: 'GFA' })}>
          <Plus size={16} />
          添加元件
        </button>
      </div>
      <div className="filters">
        <select
          aria-label="元件库机型"
          value={machine}
          onChange={(e) => setMachine(e.target.value)}
        >
          {Object.entries(data.machines).map(([key, s]) => (
            <option key={key} value={key}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="search">
          <Search size={17} />
          <input
            aria-label="搜索元件"
            placeholder="型号、类型或参数"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="panel table-scroll">
        <table>
          <thead>
            <tr>
              <th>图形</th>
              <th>完整型号</th>
              <th>类型</th>
              <th>长度</th>
              <th>参数</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <div
                    className="table-symbol"
                    dangerouslySetInnerHTML={{
                      __html: ComponentModels.symbol(c, data.machines[machine], {
                        id: `catalog-${c.id}`,
                        thumbnail: true,
                      }),
                    }}
                  />
                </td>
                <td>
                  <strong>{c.name}</strong>
                </td>
                <td>{c.type}</td>
                <td>{c.length} mm</td>
                <td className="muted">{ComponentModels.describe(c)}</td>
                <td>
                  <div className="row-actions">
                    <button onClick={() => setEditing(c)}>编辑</button>
                    <button className="danger-text" onClick={() => onDelete(c)}>
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="empty">没有匹配元件</p>}
      </div>
      {editing && (
        <Modal title={editing.id ? '编辑元件' : '添加元件'} onClose={() => setEditing(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fields = Object.fromEntries(new FormData(e.currentTarget));
              for (const key of ['length', 'pitch', 'discs', 'angle'])
                fields[key] = fields[key] === '' ? null : Number(fields[key]);
              if (await onSave({ ...editing, ...fields })) setEditing(null);
            }}
          >
            <div className="form-grid">
              {[
                ['name', '完整型号', 'text'],
                ['length', '长度 / mm', 'number'],
                ['type', '类型', 'text'],
                ['pitch', '导程 / mm', 'number'],
                ['discs', '片数', 'number'],
                ['angle', '错位角 / °', 'number'],
                ['direction', '方向 RE / LI', 'text'],
                ['note', '备注', 'text'],
              ].map(([key, label, type]) => (
                <label key={key}>
                  {label}
                  <input
                    name={key}
                    type={type}
                    step="any"
                    min={['length', 'pitch', 'discs'].includes(key) ? 1 : undefined}
                    defaultValue={editing[key] ?? ''}
                    required={['name', 'length', 'type'].includes(key)}
                  />
                </label>
              ))}
            </div>
            <footer>
              <button type="button" onClick={() => setEditing(null)}>
                取消
              </button>
              <button className="primary">保存元件</button>
            </footer>
          </form>
        </Modal>
      )}
    </section>
  );
}
