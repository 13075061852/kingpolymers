import ComponentModels from './component-models.js';
import BarrelModels from './barrel-models.js';
export const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
export const emptyDesign = (machine = '50') => ({
  machine,
  sequence: [],
  ports: { natural4: true, natural7: true },
  metadata: { date: new Date().toISOString().slice(0, 10) },
  id: null,
  status: 'draft',
});
export function component(data, design, name) {
  return (
    data.components.find((item) => item.machine === design.machine && item.name === name) || {
      name,
      type: ComponentModels.parse(name).type,
      length: ComponentModels.parse(name).length || 0,
      machine: design.machine,
    }
  );
}
export function validate(data, design) {
  const spec = data.machines[design.machine];
  const zones = BarrelModels.zones(design.machine, spec, design.ports);
  let position = -spec.entry_offset;
  const spans = design.sequence.map((name, index) => {
    const c = component(data, design, name),
      start = position;
    position += c.length;
    return { index, name, type: c.type, length: c.length, start, end: position };
  });
  const violations = spans.flatMap((span) => {
    const zone =
      span.type.toUpperCase() === 'GFA'
        ? null
        : zones.find((z) => Math.max(span.start, z.start) < Math.min(span.end, z.end));
    return zone ? [{ ...span, zone }] : [];
  });
  const total = spans.reduce((sum, item) => sum + item.length, 0),
    target = BarrelModels.targetLength(design.machine, spec, design.ports);
  return {
    total,
    target,
    difference: total - target,
    spans,
    zones,
    violations,
    barrel_warnings: BarrelModels.warnings(design.machine, spec, design.ports),
  };
}
export function cleanStyle(raw = {}) {
  const types = { ...ComponentModels.colors, OTHER: '#888888' },
    directions = { RE: '#173ad4', LI: '#ce2727', neutral: '#646b73', unknown: '#111111' };
  for (const [target, input] of [
    [types, raw.types],
    [directions, raw.directions],
  ])
    for (const key of Object.keys(target))
      if (/^#[0-9a-f]{6}$/i.test(input?.[key])) target[key] = input[key];
  return {
    version: 1,
    axis_view: raw.axis_view === 'full' ? 'full' : 'barrel',
    color_mode: raw.color_mode === 'direction' ? 'direction' : 'type',
    types,
    directions,
  };
}
export function appearance(data, design) {
  const style = cleanStyle(design.metadata.drawing_style),
    spec = data.machines[design.machine];
  const rows = BarrelModels.rows(design.machine, spec, design.ports);
  const reference =
    style.axis_view === 'barrel' &&
    rows[0]?.role === 'feed' &&
    spec.entry_offset > 0 &&
    (!design.sequence.length ||
      component(data, design, design.sequence[0]).length > spec.entry_offset);
  const color = (c) => {
    const p = ComponentModels.model(c),
      direction =
        p.angle === 90
          ? 'neutral'
          : ['LI', 'L'].includes(p.direction)
            ? 'LI'
            : p.direction === 'RE'
              ? 'RE'
              : 'unknown';
    return style.color_mode === 'direction'
      ? style.directions[direction]
      : style.types[p.type] || style.types.OTHER;
  };
  return {
    color,
    referenceView: () => reference,
    visibleSpan: (start, length) => ({
      start: reference ? Math.max(0, start) : start,
      end: start + length,
      length: reference ? Math.max(0, start + length - Math.max(0, start)) : length,
    }),
    clip: (body, x, h, id) =>
      `<defs><clipPath id="${id}"><rect x="-10000" y="-10000" width="${10000 + x}" height="${20000 + h}"/></clipPath></defs><g clip-path="url(#${id})">${body}</g>`,
    plate: (x, y, h) =>
      `<path d="M${x} ${y - 23}h6v${h + 46}h-6z" fill="#78858e" stroke="#34414a"/>`,
    note: () =>
      reference
        ? `入口外 ${spec.entry_offset} mm 偏置段未展开，元件完整长度与校验坐标保持不变`
        : '全轴显示，包含入口偏置段',
    legendItems: () =>
      Object.entries(style.color_mode === 'direction' ? style.directions : style.types),
    style,
  };
}
