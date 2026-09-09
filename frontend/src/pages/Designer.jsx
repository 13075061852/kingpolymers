import { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Save,
  FolderOpen,
  Upload,
  Download,
  Undo2,
  Redo2,
  Search,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
  FileText,
  Palette,
  ZoomIn,
  ZoomOut,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import useAnimatedSort from '../hooks/useAnimatedSort.js';
import useSequenceKeys from '../hooks/useSequenceKeys.js';
import WorkspaceSplitter from '../components/WorkspaceSplitter.jsx';
import Diagram from '../components/Diagram.jsx';
import Modal from '../components/Modal.jsx';
import { useConfirm } from '../components/ConfirmProvider.jsx';
import ScrewPreview from '../components/ScrewPreview.jsx';
import MetadataForm from '../components/MetadataForm.jsx';
import BarrelPanel from '../components/BarrelPanel.jsx';
import ComponentModels from '../domain/component-models.js';
import BarrelModels from '../domain/barrel-models.js';
import { appearance, component, validate, emptyDesign, cleanStyle } from '../domain/design.js';
import { api, readFile, download } from '../lib/api.js';
import { exportPng, reportHtml } from '../lib/exports.js';

export default function Designer({ data, editor, onSave, onProjects, run, notify, onPrint }) {
  const ask = useConfirm();
  const { design, edit: applyEdit, dirty } = editor,
    spec = data.machines[design.machine],
    check = validate(data, design),
    look = appearance(data, design);
  const readOnly = design.status === 'released';
  const edit = (update) => {
    if (readOnly) {
      notify('已发布方案已锁定，请先创建可编辑副本', true);
      return;
    }
    applyEdit(update);
  };
  const [query, setQuery] = useState(''),
    [type, setType] = useState(''),
    [selected, setSelected] = useState(-1),
    [zoom, setZoom] = useState(1),
    [modal, setModal] = useState(null);
  const file = useRef(null),
    svg = useRef(null);
  const rowKeys = useSequenceKeys(design.sequence);
  const sort = useAnimatedSort({
    ids: rowKeys.ids,
    names: design.sequence,
    disabled: readOnly,
    onMove: move,
    onInsert: add,
  });
  const items = data.components.filter(
    (c) =>
      c.machine === design.machine &&
      (!type || c.type === type) &&
      ComponentModels.matches(c, query),
  );
  const valid = !check.difference && !check.violations.length && !check.barrel_warnings.length;
  const summary = BarrelModels.summary(design.machine, spec, design.ports);
  const replace = async (next) => {
    if (
      dirty &&
      !(await ask('当前方案有未保存的修改，继续会丢弃这些修改。', {
        title: '替换当前方案',
        action: '放弃修改并继续',
      }))
    )
      return;
    editor.load(next);
    setSelected(-1);
    setModal(null);
    return true;
  };
  function add(name, index = design.sequence.length) {
    if (readOnly) return;
    sort.capture();
    rowKeys.insert(name, index);
    edit((d) => d.sequence.splice(index, 0, name));
    setSelected(index);
  }
  function move(from, to) {
    if (readOnly || from === to) return;
    sort.capture();
    rowKeys.move(from, to);
    edit((d) => {
      const [item] = d.sequence.splice(from, 1);
      d.sequence.splice(to, 0, item);
    });
    setSelected(to);
  }
  function remove(index) {
    if (readOnly) return;
    sort.capture();
    rowKeys.remove(index);
    edit((d) => d.sequence.splice(index, 1));
    setSelected(-1);
  }
  async function importFile(event) {
    const incoming = event.target.files[0];
    event.target.value = '';
    if (!incoming) return;
    if (incoming.size > 20 * 1024 * 1024) {
      notify('文件超过 20 MB，请压缩后导入', true);
      return;
    }
    if (dirty && !(await ask('导入文件将替换当前未保存方案，是否继续？'))) return;
    await run(async () => {
      const result = await api('/import', {
        filename: incoming.name,
        data: await readFile(incoming),
      });
      if (!data.machines[String(result.machine || design.machine)])
        throw Error('文件中的机器型号尚未支持');
      const next = {
        ...emptyDesign(String(result.machine || design.machine)),
        sequence: result.sequence || [],
        metadata: result.metadata || {},
        ports: result.ports || { natural4: true, natural7: true },
      };
      editor.load(next);
      setSelected(-1);
      setModal(null);
      if (result.warnings?.length) notify(result.warnings.join('；'), true);
    });
  }
  useEffect(() => {
    function keydown(e) {
      if (
        modal ||
        sort.drag ||
        document.querySelector('dialog[open], .print-preview, .workspace-content[inert]') ||
        e.target.closest('input,textarea,select,[contenteditable="true"]')
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (!readOnly) e.shiftKey ? editor.redo() : editor.undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (!readOnly) editor.redo();
      }
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });
  return (
    <section className="designer">
      <div className="workspace-tools" role="toolbar" aria-label="方案工具栏">
        <select
          aria-label="当前机型"
          value={design.machine}
          onChange={(e) => replace(emptyDesign(e.target.value))}
        >
          {Object.entries(data.machines).map(([key, s]) => (
            <option value={key} key={key}>
              {s.name}
            </option>
          ))}
        </select>
        <span className="machine-summary">
          {summary.process_d}D / {summary.sections} 节
        </span>
        <span className="divider" />
        <button onClick={() => replace(emptyDesign(design.machine))}>
          <Plus size={15} />
          新建
        </button>
        <button onClick={onProjects}>
          <FolderOpen size={15} />
          打开
        </button>
        <button
          className="primary"
          title="保存方案 · Ctrl+S"
          disabled={readOnly}
          onClick={() => onSave(false)}
        >
          <Save size={15} />
          保存方案
        </button>
        <button onClick={() => onSave(true)}>另存</button>
        <span className="divider" />
        <button onClick={() => setModal('metadata')}>
          <FileText size={15} />
          图纸资料
        </button>
        <button onClick={() => setModal('templates')}>历史模板</button>
        {!design.sequence.length && (
          <button
            onClick={() => {
              const t = data.templates.find((t) => t.machine === design.machine && t.is_default);
              if (t)
                replace({
                  ...emptyDesign(design.machine),
                  sequence: t.sequence,
                  metadata: {
                    ...emptyDesign().metadata,
                    drawing_name: t.name,
                    version: t.version || '',
                  },
                });
              else setModal('templates');
            }}
          >
            使用标准模板
          </button>
        )}
        <button onClick={() => file.current.click()}>
          <Upload size={15} />
          导入
        </button>
        <input
          ref={file}
          type="file"
          accept=".pdf,.xlsx,.xlsm,.json"
          hidden
          onChange={importFile}
        />
        <button onClick={() => setModal('export')}>
          <Download size={15} />
          导出
        </button>
        <button onClick={() => onPrint(reportHtml(data, design))}>
          <FileText size={15} />
          工程图 / PDF
        </button>
      </div>
      {readOnly && (
        <div className="readonly-notice">
          <span>已发布 · 只读</span>
          <button
            onClick={() =>
              replace({
                ...design,
                id: null,
                status: 'draft',
                metadata: {
                  ...design.metadata,
                  drawing_name: (design.metadata.drawing_name || '方案') + ' · 副本',
                },
              })
            }
          >
            创建可编辑副本
          </button>
        </div>
      )}
      <section className="panel diagram-panel">
        <div className="diagram-tools">
          <div className="row-actions">
            <button
              title="撤销"
              aria-label="撤销"
              disabled={readOnly || !editor.canUndo}
              onClick={editor.undo}
            >
              <Undo2 size={16} />
            </button>
            <button
              title="重做"
              aria-label="重做"
              disabled={readOnly || !editor.canRedo}
              onClick={editor.redo}
            >
              <Redo2 size={16} />
            </button>
            <span className="divider" />
            <button
              title="缩小"
              aria-label="缩小"
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            >
              <ZoomOut size={16} />
            </button>
            <button onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
            <button
              title="放大"
              aria-label="放大"
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            >
              <ZoomIn size={16} />
            </button>
          </div>
          <div className="drawing-title">
            <h1 title={design.metadata.drawing_name}>
              {design.metadata.drawing_name || '新建组合方案'}
            </h1>
            <span className={`badge ${dirty ? 'draft' : ''}`}>
              {dirty ? '未保存' : design.id ? '已保存' : '新方案'}
            </span>
          </div>
          <div className="row-actions">
            <span className="legend">
              {Object.entries(ComponentModels.colors)
                .slice(0, 4)
                .map(([key, color]) => (
                  <span key={key}>
                    <i style={{ background: color }} />
                    {key}
                  </span>
                ))}
            </span>
            <button onClick={() => setModal('appearance')}>
              <Palette size={15} />
              视图与配色
            </button>
          </div>
        </div>
        <Diagram
          data={data}
          design={design}
          selected={selected}
          onSelect={setSelected}
          zoom={zoom}
          svgRef={svg}
        />
        <div className={`validation-bar ${valid ? 'valid' : 'warn'}`}>
          {valid ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
          <strong>
            {check.total} / {check.target} mm
          </strong>
          <span>
            {valid
              ? '长度与工艺校验通过'
              : `长度差 ${check.difference > 0 ? '+' : ''}${check.difference} mm · ${check.violations.length} 处工艺冲突${check.barrel_warnings.length ? ' · 自定义机筒待复核' : ''}`}
          </span>
          <button onClick={() => setModal('validation')}>查看校验</button>
        </div>
      </section>
      <WorkspaceSplitter />
      <div className="editor-grid">
        <section className="panel catalog-panel">
          <div className="section-head">
            <div>
              <h2>元件库</h2>
              <span>
                {design.machine}CC · {items.length} 型号
              </span>
            </div>
          </div>
          <div className="catalog-filter">
            <div className="search">
              <Search size={16} />
              <input
                aria-label="搜索设计元件"
                placeholder="搜索完整型号"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select aria-label="元件类型" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">全部类型</option>
              {[
                ...new Set(
                  data.components.filter((c) => c.machine === design.machine).map((c) => c.type),
                ),
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="catalog-items">
            {items.map((c) => (
              <div
                className="catalog-item"
                key={c.id}
                draggable={!readOnly}
                onDragStart={(e) => sort.startExternal(e, c.name)}
                onDragEnd={sort.cancel}
              >
                <button
                  className="component-add"
                  disabled={readOnly}
                  aria-label={`加入 ${c.name}`}
                  onClick={() => add(c.name)}
                >
                  <span
                    className="catalog-symbol"
                    dangerouslySetInnerHTML={{
                      __html: ComponentModels.symbol(c, spec, {
                        id: `library-${c.id}`,
                        color: look.color(c),
                        thumbnail: true,
                      }),
                    }}
                  />
                  <strong>{c.name}</strong>
                  <small>
                    {c.length} mm · {c.type}
                  </small>
                </button>
                <button
                  className="detail-button"
                  onClick={() => setModal({ component: c })}
                  aria-label={`${c.name} 参数`}
                >
                  参数
                </button>
              </div>
            ))}
          </div>
        </section>
        <section className="panel sequence-panel">
          <div className="section-head">
            <div>
              <h2>安装顺序</h2>
              <span>
                {design.sequence.length} 个位置 · {check.total} mm
              </span>
            </div>
            <button
              disabled={readOnly || !design.sequence.length}
              onClick={async () => {
                if (
                  await ask('清空全部螺纹元件？此操作可以撤销。', {
                    action: '清空元件',
                    danger: true,
                  })
                )
                  edit((d) => {
                    d.sequence = [];
                  });
              }}
            >
              <Trash2 size={15} />
              清空
            </button>
          </div>
          <div className="sequence-columns" aria-hidden="true">
            <span>位置</span>
            <span>型号</span>
            <span>长度</span>
            <span>累计</span>
            <span>操作</span>
          </div>
          <div
            ref={sort.list}
            className={`sequence-list sortable-list ${sort.drag ? 'sorting' : ''}`}
            {...sort.listProps}
            style={{ paddingBottom: sort.extraSpace }}
          >
            {sort.slot && (
              <div
                className="sort-placeholder"
                style={{ top: sort.slot.top, height: sort.slot.height }}
                aria-hidden="true"
              >
                {sort.slot.name}
              </div>
            )}
            {check.spans.map((span, index) => {
              const c = component(data, design, span.name),
                bad = check.violations.some((v) => v.index === index);
              return (
                <div
                  className={`sequence-row ${selected === index ? 'selected' : ''} ${bad ? 'conflict' : ''}`}
                  key={rowKeys.ids[index]}
                  {...sort.rowProps(index)}
                  onClick={() => setSelected(index)}
                  tabIndex={0}
                  aria-label={`选择位置 ${index + 1}，${c.name}`}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      setSelected(index);
                    }
                  }}
                >
                  <span className="position">{String(index + 1).padStart(2, '0')}</span>
                  <div className="sequence-name">
                    <strong>{c.name}</strong>
                  </div>
                  <span className="row-length numeric">{c.length}</span>
                  <span className="row-end numeric">
                    {Math.round(span.end + (spec.position_origin || 0))}
                  </span>
                  <div className="mini-actions">
                    <button
                      aria-label={`上移元件 ${index + 1}`}
                      disabled={readOnly || !index}
                      onClick={(e) => {
                        e.stopPropagation();
                        move(index, index - 1);
                      }}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      aria-label={`下移元件 ${index + 1}`}
                      disabled={readOnly || index === design.sequence.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        move(index, index + 1);
                      }}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      disabled={readOnly}
                      aria-label={`复制元件 ${index + 1}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        add(c.name, index + 1);
                      }}
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      disabled={readOnly}
                      aria-label={`删除元件 ${index + 1}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(index);
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
            <div className="drop-zone" style={{ transform: `translateY(${sort.extraSpace}px)` }}>
              <Plus size={22} />
              <span>{design.sequence.length ? '追加元件' : '暂无元件'}</span>
            </div>
          </div>
          {selected >= 0 && selected < design.sequence.length && (
            <div className="selection-tools">
              <button
                onClick={() =>
                  setModal({ component: component(data, design, design.sequence[selected]) })
                }
              >
                查看选中元件
              </button>
              <button
                onClick={() => {
                  const c = component(data, design, design.sequence[selected]),
                    model = ComponentModels.model(c);
                  const opposite = data.components.find((other) => {
                    const p = ComponentModels.model(other);
                    return (
                      other.machine === design.machine &&
                      p.type === model.type &&
                      p.length === model.length &&
                      p.pitch === model.pitch &&
                      p.discs === model.discs &&
                      p.angle === model.angle &&
                      p.direction !== model.direction &&
                      ['RE', 'LI'].includes(p.direction)
                    );
                  });
                  if (!opposite) notify('元件库没有匹配的反向型号', true);
                  else
                    edit((d) => {
                      d.sequence[selected] = opposite.name;
                    });
                }}
              >
                切换方向 RE / LI
              </button>
            </div>
          )}
        </section>
        <BarrelPanel readOnly={readOnly} data={data} design={design} edit={edit} notify={notify} />
      </div>
      {modal === 'metadata' && (
        <Modal title="图纸资料" onClose={() => setModal(null)} wide>
          <MetadataForm
            design={design}
            onChange={(key, value) =>
              edit((d) => {
                d.metadata[key] = value;
              })
            }
          />
          <footer>
            <button className="primary" onClick={() => setModal(null)}>
              完成
            </button>
          </footer>
        </Modal>
      )}
      {modal === 'templates' && (
        <Modal title="从历史模板创建" onClose={() => setModal(null)} wide>
          <div className="template-list">
            {data.templates
              .filter((t) => t.machine === design.machine)
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() =>
                    replace({
                      ...emptyDesign(design.machine),
                      sequence: t.sequence,
                      metadata: {
                        drawing_name: t.name,
                        date: t.drawing_date || '',
                        version: t.version || '',
                        material: t.material || '',
                      },
                    })
                  }
                >
                  <strong>{t.name}</strong>
                  <span>
                    {t.sequence.length} 个元件 · {t.total_length} mm{' '}
                    {t.is_default ? '· 默认模板' : ''}
                  </span>
                </button>
              ))}
          </div>
        </Modal>
      )}
      {modal === 'validation' && (
        <Modal title="工程校验" onClose={() => setModal(null)}>
          <p>
            总长 {check.total} mm / 目标 {check.target} mm，差值 {check.difference} mm
          </p>
          {check.violations.map((v) => (
            <p className="error" key={v.index}>
              位置 {v.index + 1}：{v.name} 与第 {v.zone.section} 节开口安全区域重叠
            </p>
          ))}
          {check.barrel_warnings.map((w) => (
            <p className="warning" key={w}>
              {w}
            </p>
          ))}
          {valid && <p className="success">当前组合长度和工艺规则校验通过。</p>}
          <p className="muted">图形不是制造 CAD；实际内径、间隙和承载能力仍须按图纸核对。</p>
        </Modal>
      )}
      {modal === 'export' && (
        <Modal title="导出方案" onClose={() => setModal(null)}>
          <div className="export-options">
            <button
              onClick={() =>
                run(async () => {
                  onPrint(reportHtml(data, design));
                  setModal(null);
                })
              }
            >
              <strong>三页工程图 / PDF</strong>
              <span>组合图、机器参数与安装明细；通过浏览器打印保存 PDF</span>
            </button>
            <button
              onClick={() =>
                run(async () =>
                  download(
                    await api('/export/xlsx', design),
                    (design.metadata.drawing_name || '螺杆组合') + '.xlsx',
                  ),
                )
              }
            >
              <strong>Excel 工作簿</strong>
              <span>元件汇总、安装顺序、机筒、堵头和工程复核</span>
            </button>
            <button
              onClick={() =>
                download(
                  new Blob([JSON.stringify(design, null, 2)], { type: 'application/json' }),
                  (design.metadata.drawing_name || '螺杆组合') + '.json',
                )
              }
            >
              <strong>JSON 工程文件</strong>
              <span>完整方案，可再次导入继续编辑</span>
            </button>
            <button
              onClick={() =>
                run(() => exportPng(svg.current, design.metadata.drawing_name || '螺杆组合'))
              }
            >
              <strong>PNG 图形</strong>
              <span>高分辨率组合图</span>
            </button>
          </div>
        </Modal>
      )}
      {modal === 'appearance' && (
        <Modal title="视图与配色" onClose={() => setModal(null)}>
          <label>
            轴向显示
            <select
              value={look.style.axis_view}
              onChange={(e) =>
                edit((d) => {
                  d.metadata.drawing_style = {
                    ...cleanStyle(d.metadata.drawing_style),
                    axis_view: e.target.value,
                  };
                })
              }
            >
              <option value="barrel">原图视图（隐藏入口偏置段）</option>
              <option value="full">全轴视图</option>
            </select>
          </label>
          <label>
            颜色分类
            <select
              value={look.style.color_mode}
              onChange={(e) =>
                edit((d) => {
                  d.metadata.drawing_style = {
                    ...cleanStyle(d.metadata.drawing_style),
                    color_mode: e.target.value,
                  };
                })
              }
            >
              <option value="type">按元件类型</option>
              <option value="direction">按旋转方向</option>
            </select>
          </label>
          <div className="color-grid">
            {Object.entries(
              look.style[look.style.color_mode === 'type' ? 'types' : 'directions'],
            ).map(([key, value]) => (
              <label key={key}>
                {key}
                <input
                  type="color"
                  value={value}
                  onChange={(e) =>
                    edit((d) => {
                      const next = cleanStyle(d.metadata.drawing_style);
                      next[next.color_mode === 'type' ? 'types' : 'directions'][key] =
                        e.target.value;
                      d.metadata.drawing_style = next;
                    })
                  }
                />
              </label>
            ))}
          </div>
        </Modal>
      )}
      {modal?.component && (
        <Modal title={modal.component.name} onClose={() => setModal(null)}>
          <ScrewPreview item={modal.component} spec={spec} />
          <p>{ComponentModels.describe(modal.component)}</p>
          <p>所属机型：{spec.name}</p>
        </Modal>
      )}
    </section>
  );
}
