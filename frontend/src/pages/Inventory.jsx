import { useState } from 'react';
import { History, Search } from 'lucide-react';
import Modal from '../components/Modal.jsx';
export default function Inventory({ data, onAdjust, onHistory }) {
  const [machine, setMachine] = useState('50'),
    [query, setQuery] = useState(''),
    [item, setItem] = useState(null);
  const rows = data.components.filter(
    (c) => c.machine === machine && c.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">INVENTORY</span>
          <h1>元件库存</h1>
          <p>以实际单件计数；一套螺杆组合位置需要 2 件。</p>
        </div>
        <button onClick={onHistory}>
          <History size={16} />
          出入库记录
        </button>
      </div>
      <div className="filters">
        <select aria-label="库存机型" value={machine} onChange={(e) => setMachine(e.target.value)}>
          {Object.entries(data.machines).map(([key, s]) => (
            <option value={key} key={key}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="search">
          <Search size={17} />
          <input
            aria-label="搜索库存"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索元件型号"
          />
        </div>
      </div>
      <div className="panel table-scroll">
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
                <td>{c.type}</td>
                <td>{c.stock ?? '未录入'}</td>
                <td>{c.stock == null ? '—' : Math.floor(c.stock / 2)}</td>
                <td>
                  <button onClick={() => setItem(c)}>调整库存</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {item && (
        <Modal title={'调整库存 · ' + item.name} onClose={() => setItem(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fields = Object.fromEntries(new FormData(e.currentTarget));
              if (
                await onAdjust({
                  ...fields,
                  component_id: item.id,
                  quantity: Number(fields.quantity),
                })
              )
                setItem(null);
            }}
          >
            <label>
              调整方式
              <select name="mode">
                <option value="set">盘点：设为指定数量</option>
                <option value="add">变动：增加或减少</option>
              </select>
            </label>
            <label>
              数量
              <input
                name="quantity"
                type="number"
                step="1"
                defaultValue={item.stock ?? 0}
                required
              />
            </label>
            <label>
              原因
              <input name="reason" defaultValue="人工盘点" required />
            </label>
            <footer>
              <button type="button" onClick={() => setItem(null)}>
                取消
              </button>
              <button className="primary">保存调整</button>
            </footer>
          </form>
        </Modal>
      )}
    </section>
  );
}
