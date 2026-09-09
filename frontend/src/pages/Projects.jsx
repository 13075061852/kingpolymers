import { useState } from 'react';
import { FolderOpen, RefreshCw, Search } from 'lucide-react';
const statusName = { draft: '草稿', released: '已发布', void: '已作废' };
export default function Projects({ data, onOpen, onAction, onRefresh }) {
  const [query, setQuery] = useState('');
  const rows = data.projects.filter((p) =>
    `${p.name} ${p.machine}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">PROJECT LIBRARY</span>
          <h1>项目方案</h1>
          <p>螺杆排列与机筒配置，一起保存。</p>
        </div>
        <button onClick={onRefresh}>
          <RefreshCw size={16} />
          刷新
        </button>
      </div>
      <div className="search">
        <Search size={17} />
        <input
          aria-label="搜索方案"
          placeholder="搜索方案名称或机型"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span>{rows.length} 个方案</span>
      </div>
      <div className="panel table-scroll">
        <table>
          <thead>
            <tr>
              <th>方案名称</th>
              <th>机器</th>
              <th>状态</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.name}</strong>
                </td>
                <td>{p.machine}CC</td>
                <td>
                  <span className={`badge ${p.status}`}>{statusName[p.status] || p.status}</span>
                </td>
                <td>{p.updated_at?.replace('T', ' ')}</td>
                <td>
                  <div className="row-actions">
                    <button onClick={() => onOpen(p.id)}>
                      <FolderOpen size={14} />
                      打开
                    </button>
                    {p.status === 'draft' && (
                      <button onClick={() => onAction('release', p)}>发布</button>
                    )}
                    {p.status === 'released' ? (
                      <button onClick={() => onAction('void', p)}>作废退库</button>
                    ) : (
                      <button className="danger-text" onClick={() => onAction('delete', p)}>
                        删除
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="empty">
            <FolderOpen size={32} />
            <h3>还没有匹配的方案</h3>
            <p>在设计工作台中创建并保存第一个方案。</p>
          </div>
        )}
      </div>
    </section>
  );
}
