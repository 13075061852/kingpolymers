import { useState } from 'react';
import { History, Package, ArrowRight } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import { SearchField, MachineSwitch, EmptyState } from '../components/Ui.jsx';
export default function Inventory({ data, onAdjust, onHistory }) {
  const [machine, setMachine] = useState('50'),
    [query, setQuery] = useState(''),
    [item, setItem] = useState(null),
    [mode, setMode] = useState('set'),
    [quantity, setQuantity] = useState(''),
    [saving, setSaving] = useState(false);
  const rows = data.components.filter(
    (c) => c.machine === machine && c.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const next =
    quantity === ''
      ? null
      : mode === 'set'
        ? Number(quantity)
        : (item?.stock ?? 0) + Number(quantity);
  function adjust(c) {
    setItem(c);
    setMode('set');
    setQuantity(String(c.stock ?? 0));
  }
  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (await onAdjust({ ...fields, component_id: item.id, quantity: Number(quantity), mode }))
        setItem(null);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">INVENTORY</span>
          <h1>元件库存</h1>
          <p>以实际单件计数，每个组合位置需要 2 件。</p>
        </div>
        <button onClick={onHistory}>
          <History size={17} />
          出入库记录
        </button>
      </div>
      <div className="filters">
        <MachineSwitch
          machines={data.machines}
          value={machine}
          onChange={setMachine}
          label="库存机型"
        />
        <SearchField value={query} onChange={setQuery} placeholder="搜索元件型号" />
      </div>
      <div className="panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>元件型号</th>
                <th>类型</th>
                <th>库存 / 件</th>
                <th>折合 / 套</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                  </td>
                  <td>
                    <span className="type-pill">{c.type}</span>
                  </td>
                  <td>
                    <span
                      className={
                        'stock-count ' +
                        (c.stock == null ? 'unknown' : c.stock <= 0 ? 'shortage' : '')
                      }
                    >
                      {c.stock ?? '未录入'}
                    </span>
                  </td>
                  <td className="numeric">{c.stock == null ? '—' : Math.floor(c.stock / 2)}</td>
                  <td>
                    <button onClick={() => adjust(c)}>
                      调整库存
                      <ArrowRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <EmptyState
            icon={Package}
            title="没有匹配的库存"
            description="切换机型或尝试搜索其他型号。"
          />
        )}
        <div className="table-footer">共 {rows.length} 个型号 · 数量未录入时，不等同于零库存</div>
      </div>
      {item && (
        <Modal drawer title="调整库存" onClose={() => setItem(null)} busy={saving}>
          <span className="eyebrow">
            {item.machine}CC / {item.type}
          </span>
          <h3 className="drawer-model">{item.name}</h3>
          <div className="stock-summary">
            <span>当前库存</span>
            <strong>
              {item.stock ?? '未录入'} <small>{item.stock == null ? '' : '件'}</small>
            </strong>
          </div>
          <form onSubmit={submit}>
            <fieldset disabled={saving}>
              <label>
                调整方式
                <select
                  name="mode"
                  value={mode}
                  onChange={(e) => {
                    setMode(e.target.value);
                    setQuantity(e.target.value === 'set' ? String(item.stock ?? 0) : '0');
                  }}
                >
                  <option value="set">盘点：设为指定数量</option>
                  <option value="add">变动：增加或减少</option>
                </select>
              </label>
              <label>
                {mode === 'set' ? '盘点数量 / 件' : '变动数量 / 件'}
                <input
                  autoFocus
                  name="quantity"
                  type="number"
                  step="1"
                  min={mode === 'set' ? 0 : undefined}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </label>
              <p className="muted">
                {mode === 'add' ? '正数入库，负数出库。' : '输入盘点后的实际库存总数。'}
              </p>
              <label>
                原因
                <input name="reason" defaultValue="人工盘点" required maxLength={200} />
              </label>
              <div className={'stock-result ' + (next < 0 ? 'error' : '')}>
                <span>调整后库存</span>
                <strong>{next ?? '—'} 件</strong>
              </div>
              {next < 0 && <p className="form-error">调整后库存不能小于 0，请核对数量。</p>}
              <footer>
                <button type="button" onClick={() => setItem(null)}>
                  取消
                </button>
                <button className="primary" disabled={next == null || next < 0}>
                  {saving ? '保存中…' : '保存调整'}
                </button>
              </footer>
            </fieldset>
          </form>
        </Modal>
      )}
    </section>
  );
}
