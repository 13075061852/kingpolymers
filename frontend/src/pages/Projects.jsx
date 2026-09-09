import { useState } from 'react';
import {
  FolderOpen,
  RefreshCw,
  Plus,
  FileText,
  CheckCircle2,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import { SearchField, EmptyState } from '../components/Ui.jsx';
const labels = { draft: '草稿', released: '已发布', void: '已作废' };
export default function Projects({ data, onOpen, onAction, onRefresh, onNew }) {
  const [query, setQuery] = useState(''),
    [status, setStatus] = useState('all'),
    [machine, setMachine] = useState('');
  const rows = data.projects.filter(
    (p) =>
      (status === 'all' || p.status === status) &&
      (!machine || p.machine === machine) &&
      (p.name + ' ' + p.machine).toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <section className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">PROJECT LIBRARY</span>
          <h1>项目方案</h1>
          <p>螺杆排列与机筒配置，一起保存，有序交付。</p>
        </div>
        <div className="row-actions">
          <button onClick={onRefresh}>
            <RefreshCw size={16} />
            刷新
          </button>
          <button className="primary" onClick={onNew}>
            <Plus size={17} />
            新建方案
          </button>
        </div>
      </div>
      <div className="panel projects-panel">
        <div className="list-toolbar">
          <div className="tabs" role="group" aria-label="方案状态">
            {[['all', '全部'], ...Object.entries(labels)].map(([value, label]) => (
              <button key={value} aria-pressed={status === value} onClick={() => setStatus(value)}>
                {label}
                <span>
                  {data.projects.filter((p) => value === 'all' || p.status === value).length}
                </span>
              </button>
            ))}
          </div>
          <div className="filters compact">
            <SearchField value={query} onChange={setQuery} placeholder="搜索方案名称或机型" />
            <select
              aria-label="方案机型"
              value={machine}
              onChange={(e) => setMachine(e.target.value)}
            >
              <option value="">全部机型</option>
              {Object.keys(data.machines).map((m) => (
                <option key={m} value={m}>
                  {m}CC
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>方案名称</th>
                <th>机型</th>
                <th>状态</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button className="project-name text-button" onClick={() => onOpen(p.id)}>
                      <span className={'project-icon ' + p.status}>
                        <FileText size={21} />
                      </span>
                      <span>
                        <strong>{p.name}</strong>
                        <small>双螺杆组合方案</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <span className="machine-tag">{p.machine}CC</span>
                  </td>
                  <td>
                    <span className={'badge ' + p.status}>
                      <i />
                      {labels[p.status] || p.status}
                    </span>
                  </td>
                  <td className="muted numeric">{p.updated_at?.replace('T', ' ')}</td>
                  <td>
                    <div className="row-actions">
                      <button onClick={() => onOpen(p.id)}>
                        <FolderOpen size={14} />
                        打开
                      </button>
                      {p.status === 'draft' && (
                        <button className="text-button" onClick={() => onAction('release', p)}>
                          发布
                        </button>
                      )}
                      {p.status === 'released' ? (
                        <button className="text-button" onClick={() => onAction('void', p)}>
                          作废退库
                        </button>
                      ) : (
                        <button
                          className="danger-text text-button"
                          onClick={() => onAction('delete', p)}
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <EmptyState
            icon={FolderOpen}
            title={data.projects.length ? '没有匹配的方案' : '从第一个方案开始'}
            description={
              data.projects.length
                ? '调整筛选条件，或搜索其他方案名称。'
                : '在工作台选择模板，组合元件并保存。'
            }
            action={
              !data.projects.length && (
                <button className="primary" onClick={onNew}>
                  开始设计
                  <ArrowRight size={16} />
                </button>
              )
            }
          />
        )}
        {rows.length > 0 && (
          <div className="table-footer">共 {rows.length} 个方案 · 已发布方案以副本继续编辑</div>
        )}
      </div>
      <div className="workflow-strip">
        <div>
          <FileText />
          <span>
            <strong>草稿设计</strong>
            <small>完善排列与机筒配置</small>
          </span>
        </div>
        <ArrowRight />
        <div>
          <CheckCircle2 />
          <span>
            <strong>发布生产</strong>
            <small>扣减元件库存，锁定方案</small>
          </span>
        </div>
        <ArrowRight />
        <div>
          <RotateCcw />
          <span>
            <strong>作废退库</strong>
            <small>按实际扣库记录退回</small>
          </span>
        </div>
      </div>
    </section>
  );
}
