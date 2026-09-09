import { useState } from 'react';
import { Plus, Pencil, Box, SlidersHorizontal } from 'lucide-react';
import ComponentModels from '../domain/component-models.js';
import Modal from '../components/Modal.jsx';
import ScrewPreview from '../components/ScrewPreview.jsx';
import { SearchField, MachineSwitch, EmptyState } from '../components/Ui.jsx';
export default function Components({ data, onSave, onDelete }) {
  const [machine, setMachine] = useState('50'),
    [query, setQuery] = useState(''),
    [type, setType] = useState(''),
    [selected, setSelected] = useState(null),
    [editing, setEditing] = useState(null),
    [saving, setSaving] = useState(false);
  const library = data.components.filter((c) => c.machine === machine);
  const rows = library.filter(
    (c) => (!type || c.type === type) && ComponentModels.matches(c, query),
  );
  const item = rows.find((c) => c.id === selected) || rows[0];
  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    for (const key of ['length', 'pitch', 'discs', 'angle'])
      fields[key] = fields[key] === '' ? null : Number(fields[key]);
    try {
      if (await onSave({ ...editing, ...fields })) setEditing(null);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="page">
      <div className="page-toolbar" role="toolbar" aria-label="元件库工具栏">
        <h1>元件库</h1>
        <MachineSwitch
          machines={data.machines}
          value={machine}
          onChange={(m) => {
            setMachine(m);
            setType('');
            setSelected(null);
          }}
          label="元件库机型"
        />
        <SearchField value={query} onChange={setQuery} placeholder="搜索型号、类型或参数" />
        <select aria-label="筛选元件类型" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">全部类型</option>
          {[...new Set(library.map((c) => c.type))].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <span className="toolbar-count">{rows.length} 型号</span>
        <button
          className="primary toolbar-end"
          onClick={() => setEditing({ machine, type: 'GFA' })}
        >
          <Plus size={15} />
          添加元件
        </button>
      </div>
      <div className={'catalog-layout ' + (!item ? 'no-detail' : '')}>
        <div className="panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>图形</th>
                  <th>完整型号</th>
                  <th>类型</th>
                  <th>长度</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className={item?.id === c.id ? 'selected' : ''}>
                    <td>
                      <div
                        className="table-symbol"
                        dangerouslySetInnerHTML={{
                          __html: ComponentModels.symbol(c, data.machines[machine], {
                            id: 'catalog-' + c.id,
                            thumbnail: true,
                          }),
                        }}
                      />
                    </td>
                    <td>
                      <button
                        className="text-button model-select"
                        aria-pressed={item?.id === c.id}
                        onClick={() => setSelected(c.id)}
                      >
                        {c.name}
                      </button>
                    </td>
                    <td>
                      <span className="type-pill">{c.type}</span>
                    </td>
                    <td className="numeric">
                      {c.length} <small>mm</small>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={'编辑 ' + c.name}
                        onClick={() => setEditing(c)}
                      >
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <EmptyState icon={Box} title="没有匹配元件" description="尝试其他型号、类型或机器。" />
          )}
        </div>
        {item && (
          <aside className="panel component-detail" key={item.id}>
            <div className="section-head">
              <h2>
                <SlidersHorizontal size={17} />
                元件参数
              </h2>
              <span>{machine}CC</span>
            </div>
            <div className="detail-body">
              <h3>{item.name}</h3>
              <ScrewPreview item={item} spec={data.machines[machine]} />
              <dl className="parameter-list">
                {[
                  ['所属机型', data.machines[machine].name],
                  ['长度', item.length + ' mm'],
                  ['导程', item.pitch ? item.pitch + ' mm' : '—'],
                  ['片数', item.discs ?? '—'],
                  ['错位角', item.angle != null ? item.angle + '°' : '—'],
                  ['方向', ComponentModels.model(item).direction || '—'],
                  ['备注', item.note || '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="detail-actions">
                <button className="primary" onClick={() => setEditing(item)}>
                  <Pencil size={15} />
                  编辑元件
                </button>
                <button className="text-button danger-text" onClick={() => onDelete(item)}>
                  删除
                </button>
              </div>
              <p className="panel-note">立体模型为参数示意，制造尺寸以工程图纸为准。</p>
            </div>
          </aside>
        )}
      </div>
      {editing && (
        <Modal
          drawer
          title={editing.id ? '编辑元件' : '添加元件'}
          onClose={() => setEditing(null)}
          busy={saving}
        >
          <form onSubmit={submit}>
            <fieldset disabled={saving}>
              <span className="badge">{machine}CC 专用元件</span>
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
                ].map(([key, label, inputType]) => (
                  <label key={key}>
                    {label}
                    <input
                      name={key}
                      type={inputType}
                      step={['discs', 'length'].includes(key) ? '1' : 'any'}
                      min={['length', 'pitch', 'discs'].includes(key) ? 1 : undefined}
                      max={key === 'angle' ? 180 : undefined}
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
                <button className="primary">{saving ? '保存中…' : '保存元件'}</button>
              </footer>
            </fieldset>
          </form>
        </Modal>
      )}
    </section>
  );
}
