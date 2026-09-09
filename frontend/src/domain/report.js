import ComponentModels from './component-models.js';
import BarrelModels from './barrel-models.js';
import BarrelVisuals from './barrel-visuals.js';
/* A4 landscape reference layout, measured from the user's 2024-03-13 60CC PDF.
 * Parametric drawings remain engineering illustrations; no raster copying of the old document.
 */
export function createReport(context) {
  const {
    state,
    spec,
    calculate,
    barrelConfiguration,
    DrawingAppearance,
    comp,
    comps,
    displayPosition,
    exactElementImage,
    esc,
  } = context;
  let serial = 0;
  const units = (s) => [...String(s)].reduce((n, c) => n + (c.codePointAt(0) > 255 ? 2 : 1), 0);
  function wrap(value, limit = 140) {
    const lines = [];
    let line = '';
    for (const c of String(value)) {
      if (c === '\n' || units(line + c) > limit) {
        lines.push(line);
        line = '';
        if (c === '\n') continue;
      }
      line += c;
    }
    if (line) lines.push(line);
    return lines;
  }
  const text = (x, y, value, size = 8, extra = '') =>
    `<text x="${x}" y="${y}" font-size="${size}" font-family="Courier New, SimSun, monospace" letter-spacing="${-size * 0.1}" ${extra}>${esc(value)}</text>`;
  const line = (x1, y1, x2, y2) =>
    `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="#333" stroke-width=".45"/>`;
  const gray = (x, y, w, h, title) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#c0c0c0"/>${text(x + 8, y + h - 4, title, 10)}`;
  function header() {
    return (
      text(56.4, 71, 'KP', 5.5, 'fill="#24526a" font-weight="bold"') +
      text(
        738.48,
        77,
        'kingpolymer',
        17,
        'text-anchor="end" font-style="italic" font-weight="bold" fill="#545454"',
      )
    );
  }
  function page(content, number) {
    return `<section class="print-page reference-page page-${['one', 'two', 'three'][number - 1] || number}" data-reference-page="${number}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 841.92 595.32" font-family="Times New Roman, Songti SC, SimSun, serif" role="img" aria-label="工程图第${number}页"><rect width="841.92" height="595.32" fill="white"/>${header()}${content}</svg></section>`;
  }
  function assembly(y, numbered = false) {
    const s = spec(),
      v = calculate(),
      rs = barrelConfiguration(),
      reference = DrawingAppearance.referenceView(),
      offset = reference ? s.entry_offset : 0,
      extent = Math.max(
        s.element_length - offset,
        (rs.at(-1)?.mm || 0) + s.entry_offset - offset,
        v.total - offset,
        1,
      ),
      left = 68.16,
      end = 733,
      scale = (end - left) / extent,
      right = end + offset * scale,
      h = s.diameter * scale,
      depth = 0.62,
      bx = (mm) => right - (mm + s.entry_offset) * scale,
      bad = new Set(v.violations.map((x) => x.index));
    let shape = '',
      labels = '';
    for (const [index, r] of rs.entries()) {
      const x = bx(r.mm),
        w = r.length * scale,
        cx = x + w / 2;
      shape += `<g data-barrel-index="${index}" transform="translate(${x} ${y}) scale(${depth})">${BarrelVisuals.module(r, 0, w / depth, 0, h / depth)}</g>`;
      const labelY = y - (numbered ? 32 : 36);
      labels += line(cx, y - 10, cx, labelY - 1);
      labels += numbered
        ? text(cx, labelY - 3, r.pos, 8, 'text-anchor="middle"')
        : text(cx - 1, labelY - 2, r.name, 8, `transform="rotate(-90 ${cx - 1} ${labelY - 2})"`);
      if (!numbered && r.cap && r.cap !== 'open')
        labels += text(
          cx + 8,
          labelY - 2,
          r.cap.toUpperCase(),
          6.5,
          `transform="rotate(-90 ${cx + 8} ${labelY - 2})"`,
        );
    }
    if (!reference && rs[0]?.role === 'feed')
      shape += `<g transform="translate(${bx(0)} ${y}) scale(${depth})">${BarrelVisuals.inlet(0, (s.entry_offset * scale) / depth, 0, h / depth, s.entry_offset)}</g>`;
    let cumulative = 0;
    state.sequence.forEach((name, i) => {
      const c = comp(name),
        w = c.length * scale,
        x = right - (cumulative + c.length) * scale,
        span = DrawingAppearance.visibleSpan(cumulative - s.entry_offset, c.length),
        cx = right - (s.entry_offset + (span.start + span.end) / 2) * scale;
      shape += `<g data-visible-element-index="${i}" data-full-length="${c.length}" data-visible-length="${span.length}">${exactElementImage(x, w, c, i, bad.has(i), y, h, false)}</g>`;
      const start = y + h + 16,
        end = start + (numbered ? (i % 2 ? 26 : 18) : 11);
      labels += line(cx, start - 2, cx, end);
      labels += numbered
        ? text(cx, end + 6, i + 1, 7, 'text-anchor="middle"')
        : text(cx, end + 1, name, 8, `transform="rotate(-90 ${cx} ${end + 1})" text-anchor="end"`);
      cumulative += c.length;
    });
    if (v.total) {
      const x = right - v.total * scale;
      shape += `<path class="screw-tip" d="M${x} ${y}l-6 ${h / 2} 6 ${h / 2}z" fill="white" stroke="#333" stroke-width=".6"/>`;
    }
    if (reference)
      shape =
        DrawingAppearance.clip(
          shape,
          right - s.entry_offset * scale,
          595,
          'paper-entry-' + ++serial,
        ) + DrawingAppearance.plate(right - s.entry_offset * scale, y, h);
    return `<g data-reference-assembly="${numbered ? 'numbered' : 'named'}" data-extent="${extent}">${shape}${labels}</g>`;
  }
  function machinePage() {
    const s = spec(),
      cs = comps(),
      values = [
        ['Rotation direction:', s.rotation],
        ['Nominal diameter:', s.diameter + '  mm'],
        ['Centerline distance:', s.center_distance + '  mm'],
        ['Standard value:', s.diameter + '  mm'],
        ['Max. drive power:', (state.machine === '60' ? 363 : 65) + '  kW'],
        ['...at screw speed:', (state.machine === '60' ? 1200 : 500) + '  1/min'],
        ['Length of the shaft [mm]:', ''],
        ['Comment:', ''],
      ];
    let out = gray(56.4, 84.12, 682.08, 14.76, s.name);
    values.forEach(
      ([label, value], i) =>
        (out +=
          text(i === 5 ? 84.12 : 68.16, 108.6 + i * 8.28, label) +
          text(172.11, 108.6 + i * 8.28, value)),
    );
    out += text(79.92, 174.84, 'Available machine configurations on request');
    out += gray(56.4, 186.36, 682.08, 12.36, 'Machine configuration');
    const column = (x, title, groups) => {
      let y = 208.2,
        html = text(x - 10, y, title, 8.5);
      for (const [heading, names] of groups) {
        y += 8.28;
        html += text(x, y, heading, 8, 'font-style="italic" fill="#888"');
        for (const name of names) {
          y += 8.28;
          html += text(x, y, name, 8);
        }
      }
      return html;
    };
    const cat = BarrelModels.catalog(s),
      names = (roles) => [...new Set(cat.filter((r) => roles.includes(r.role)).map((r) => r.name))],
      models = (types) => cs.filter((c) => types.includes(c.type)).map((c) => c.name);
    out += column(68.16, 'Barrel elements', [
      ['Element type ‘Zylinder-Adapter’:', names(['heat', 'flange'])],
      ['Element type ‘Zylinder-0’:', names(['barrel'])],
      ['Element type ‘Zylinder-1/1C’:', names(['natural', 'vacuum'])],
      ['Element type ‘Zylinder-E/EB/S’:', names(['feed', 'side', 'side_vacuum'])],
    ]);
    out += column(238.2, 'Threaded elements', [
      ['Element type ‘GFA’:', models(['GFA', 'Spacer'])],
      ['Element type ‘GFF’:', models(['GFF'])],
      ['Element type ‘GFM & SME’:', models(['GFM', 'SME'])],
    ]);
    out += column(408.36, 'Kneading blocks', [['Element type ‘KB’:', models(['KB', 'KBX', 'KS'])]]);
    return out;
  }
  function tables(screwRows, barrelRows) {
    let out =
      gray(56.4, 84.12, 331.32, 14.76, 'Screw configuration') +
      gray(397.2, 84.12, 331.32, 14.76, 'Barrel configuration');
    function table(part, x, isBarrel) {
      let a =
        text(x + 18, 105, 'No.', 5) +
        text(x + 39, 105, 'mm', 5) +
        text(x + 58, 105, 'Name', 5) +
        text(x + 101, 105, 'Annotation', 5) +
        line(x, 107, x + 137, 107);
      part.forEach((r, i) => {
        const y = 112 + i * 8.28;
        a +=
          text(x + 22, y, isBarrel ? r.pos : r.no, 4.92, 'text-anchor="end"') +
          text(x + 47, y, isBarrel ? r.mm : r.coordinate, 4.92, 'text-anchor="end"') +
          text(x + 53, y, r.name, 4.92) +
          text(x + 106, y, isBarrel ? r.annotation : '', 4.7);
        if (isBarrel)
          a += `<g transform="translate(${x + 1} ${y - 4}) scale(.075)">${BarrelVisuals.module(r, 0, 72, 0, 22)}</g>`;
        else
          a += ComponentModels.symbol(comp(r.name), spec(), {
            id: 'report-icon-' + ++serial,
            thumbnail: true,
            color: DrawingAppearance.color(comp(r.name)),
            layout: `x="${x}" y="${y - 5}" width="7" height="6"`,
          });
      });
      return a;
    }
    const split = Math.ceil(screwRows.length / 2),
      bSplit = Math.ceil(barrelRows.length / 2);
    out +=
      table(screwRows.slice(0, split), 71.8, false) +
      table(screwRows.slice(split), 237.1, false) +
      table(barrelRows.slice(0, bSplit), 416.2, true) +
      table(barrelRows.slice(bSplit), 580.36, true);
    return out;
  }
  function render() {
    const m = state.metadata,
      v = calculate(),
      rs = barrelConfiguration(),
      notes = [];
    const short = (value, limit = 140) => {
      value = String(value);
      if (units(value) <= limit) return value;
      notes.push(value);
      return wrap(value, limit - 12)[0] + ' ...[Notes]';
    };
    const title = short(m.drawing_name || spec().name, 160),
      date = (m.date || '')
        .split('-')
        .map((x, i) => (i ? String(Number(x)) : x))
        .join('.'),
      titleSize = Math.min(18.6, 1360 / Math.max(1, units(title)));
    let front = text(397.44, 97, title, titleSize, 'text-anchor="middle"');
    [
      ['Machine number:', m.machine_no],
      ['Geometry:', m.version],
      ['Date/Author:', date + (m.author ? '/' + m.author : '')],
      ['Comment:', [...new Set([m.material, m.comments].filter(Boolean))].join(' ')],
    ].forEach(
      ([k, val], i) =>
        (front += text(
          397.44,
          108 + i * 10,
          short(k + ' ' + (val || '')),
          9,
          'text-anchor="middle"',
        )),
    );
    front += assembly(303, false) + text(56.4, 578, DrawingAppearance.note(), 6);
    DrawingAppearance.legendItems().forEach(([label, color], i) => {
      const x = 56.4 + i * 68;
      front +=
        `<rect x="${x}" y="585" width="4" height="4" fill="${color}"/>` +
        text(x + 6, 589, label, 5.5);
    });
    const issues = [];
    if (v.difference) issues.push(`长度差 ${v.difference} mm`);
    if (v.violations.length) issues.push(`安全冲突 ${v.violations.length} 处`);
    if (v.barrel_warnings.length) issues.push('自定义配置需工程复核');
    if (issues.length)
      front += text(56.4, 558, issues.join('；') + '。本图不是投产批准。', 7, 'fill="#b33"');
    let html = page(front, 1) + page(machinePage(), 2),
      pos = -spec().entry_offset;
    const rows = state.sequence.map((name, i) => {
      pos += comp(name).length;
      return { name, no: i + 1, coordinate: displayPosition(pos) };
    });
    const count = Math.max(1, Math.ceil(rows.length / 60), Math.ceil(rs.length / 26));
    for (let i = 0; i < count; i++) {
      let body =
        tables(rows.slice(i * 60, (i + 1) * 60), rs.slice(i * 26, (i + 1) * 26)) +
        assembly(414, true);
      if (i > 0) body += text(56.4, 548, `配置续页 ${i + 1}/${count}；原编号保持不变`, 7);
      if (issues.length) body += text(56.4, 566, issues.join('；'), 6.5, 'fill="#b33"');
      html += page(body, i + 3);
    }
    const noteLines = notes.flatMap((n) => [...wrap(n), '']);
    for (let i = 0; i < noteLines.length; i += 40) {
      let body = gray(56.4, 84.12, 682.08, 14.76, 'Notes / 完整图纸资料');
      noteLines.slice(i, i + 40).forEach((s, j) => (body += text(68.16, 116 + j * 10, s, 8.5)));
      html += page(body, 3 + count + i / 40);
    }
    return html;
  }
  return { render, assembly };
}
