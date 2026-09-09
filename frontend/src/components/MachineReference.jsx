import { useState } from 'react';
import catalog from '../data/machine-catalog.json';
import Modal from './Modal.jsx';

export default function MachineReference() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  return (
    <>
      <button onClick={() => setOpen(true)}>查看其他莱斯机型资料</button>
      {open && (
        <Modal title="机型参数资料" wide onClose={() => setOpen(false)}>
          <p className="muted">资料参数库；未核对完整元件和机筒尺寸的机器不作为可编辑生产方案。</p>
          <input
            aria-label="搜索机型资料"
            placeholder="搜索机型名称"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="machine-reference-list">
            {catalog.models
              .filter((model) => model.name.toLowerCase().includes(query.toLowerCase()))
              .map((model) => (
                <article key={model.id}>
                  <h3>{model.name}</h3>
                  <dl>
                    {Object.entries(model.values).map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                  {!!model.missing?.length && (
                    <p className="muted">待核对：{model.missing.join('；')}</p>
                  )}
                  {!!model.conflicts?.length && (
                    <p className="warning">
                      资料差异：
                      {model.conflicts
                        .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
                        .join('；')}
                    </p>
                  )}
                </article>
              ))}
          </div>
        </Modal>
      )}
    </>
  );
}
