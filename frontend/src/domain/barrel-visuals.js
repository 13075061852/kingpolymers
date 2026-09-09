/* Orthographic engineering cutaway with shallow depth, not manufacturing 3D CAD.
 * Nominal axial boundaries remain at x and x + width; shading never moves a port.
 */
const BarrelVisuals = (() => {
  'use strict';
  let serial = 0;
  const esc = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  function port(r, cx, y, w, h) {
    if (!['feed', 'natural', 'vacuum', 'side', 'side_vacuum'].includes(r.role)) return '';
    const cap = r.cap || (r.open === false ? 'closed' : 'open'),
      side = ['side', 'side_vacuum'].includes(r.role),
      ink =
        r.role === 'feed'
          ? '#d72323'
          : r.role === 'side'
            ? '#b82929'
            : r.role === 'side_vacuum'
              ? '#6246aa'
              : '#183bdf',
      top = y - 16;
    let out = `<g data-port-role="${r.role}" data-cap="${cap}"><title>${esc(r.accessory || r.role)} · ${cap}</title>`;
    if (side) {
      // Source software draws lateral bores as two cross-hatched slits at the bore edges.
      for (const sy of [y - 5, y + h]) {
        out += `<rect x="${cx - w / 2}" y="${sy}" width="${w}" height="5" fill="${cap === 'closed' ? '#818b92' : '#fff'}" stroke="${ink}" stroke-width=".75"/>`;
        if (cap === 'closed')
          out += `<path d="M${cx - w / 2 - 1} ${sy - 1}h${w + 2}M${cx - w / 2 + 2} ${sy + 1}v3M${cx + w / 2 - 2} ${sy + 1}v3" fill="none" stroke="#293640" stroke-width="1.1"/>`;
        else
          for (let dx = 0; dx + 4 <= w; dx += 4)
            out += `<path d="M${cx - w / 2 + dx} ${sy}l4 5m-4 0l4-5" fill="none" stroke="${ink}" stroke-width=".6"/>`;
      }
      if (r.role === 'side_vacuum')
        out += `<path d="M${cx - 5} ${y + h + 11}h10m-3-3 3 3-3 3" fill="none" stroke="${ink}" stroke-width="1.2"/>`;
    } else if (cap === 'open') {
      out += `<path d="M${cx - w / 2} ${y}v-16h${w}v16" fill="white" stroke="#39434a" stroke-width=".75"/><path d="M${cx - w / 2 + 1} ${top + 1}h${w - 2}" stroke="#bec6cb" stroke-width="1.2"/>`;
      out +=
        r.role === 'feed'
          ? `<path d="M${cx} ${top + 2}v11m-4-4 4 4 4-4" fill="none" stroke="${ink}" stroke-width="2"/>`
          : `<path d="M${cx} ${top + 13}V${top + 3}m-4 4 4-4 4 4" fill="none" stroke="${ink}" stroke-width="2"/>`;
      if (r.role === 'vacuum')
        out += `<path d="M${cx - w / 2 - 1} ${top - 2}h${w + 2}" stroke="#52616b" stroke-width="2"/>`;
    } else {
      out += `<path d="M${cx - w / 2 - 2} ${top - 6}h${w + 4}v6h-3v15h${2 - w}v-15h-3z" fill="#858f97" stroke="#35434c" stroke-width=".85"/><path d="M${cx - w / 2 - 1} ${top - 5}h${w + 2}" stroke="#dbe1e5" stroke-width="1.6"/><path d="M${cx - w / 2 + 1} ${top - 3}v2M${cx + w / 2 - 1} ${top - 3}v2" stroke="#26343e" stroke-width="1.2"/>`;
      if (cap === 'inject')
        out += `<path data-liquid="true" d="M${cx - 1.6} ${top - 6}v21h3.2v-21" fill="white" stroke="#116e9c" stroke-width=".8"/><path d="M${cx} ${top - 15}v14m-3-4 3 4 3-4" fill="none" stroke="#087ba3" stroke-width="1.4"/>`;
    }
    return out + '</g>';
  }
  function module(r, x, w, y, h, selected = false) {
    w = Math.max(0.4, w);
    const id = 'barrel-depth-' + ++serial,
      top = y - 16,
      bottom = y + h,
      foot = bottom + 16,
      edge = '#34414a';
    let out = `<g data-barrel-role="${esc(r.role)}" data-axial-start="${x}" data-axial-width="${w}" data-depth-style="engineering-cutaway"><defs><linearGradient id="${id}-wall" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e1e5e8"/><stop offset=".27" stop-color="#c1c7cb"/><stop offset="1" stop-color="#9ca6ad"/></linearGradient><linearGradient id="${id}-base" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#bac2c8"/><stop offset="1" stop-color="#697680"/></linearGradient></defs>`;
    if (r.role === 'heat') {
      out += `<path d="M${x + w / 2} ${top - 3}v19m0 ${h}v21" fill="none" stroke="#3e4850" stroke-width="${Math.max(0.8, w)}"/>`;
    } else if (r.role === 'flange') {
      out += `<rect x="${x}" y="${top - 6}" width="${w}" height="${h + 44}" fill="url(#${id}-base)" stroke="${edge}" stroke-width=".8"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white" stroke="${edge}" stroke-width=".65"/><path d="M${x + Math.min(1, w * 0.2)} ${top - 5}v20m0 ${h + 2}v20" stroke="#e7ecef" stroke-width=".8"/>`;
    } else {
      // Upper/lower walls and separate base rail follow the supplied screenshot.
      out += `<rect x="${x}" y="${top}" width="${w}" height="16" fill="url(#${id}-wall)" stroke="${edge}" stroke-width=".75"/><rect x="${x}" y="${bottom}" width="${w}" height="16" fill="url(#${id}-wall)" stroke="${edge}" stroke-width=".75"/>`;
      const inset = Math.min(2, w * 0.1),
        ww = Math.max(0.2, w - inset * 2),
        depth = Math.min(3, w * 0.12);
      out += `<path d="M${x + inset} ${foot}h${ww}v5h-${ww}z" fill="url(#${id}-base)" stroke="${edge}" stroke-width=".6"/><path d="M${x + inset + 1} ${foot + 5.5}h${Math.max(0.1, ww - 2)}" stroke="#4c5c67" stroke-opacity=".18" stroke-width="2"/><path d="M${x + w - depth} ${top + 1}h${depth}v14h-${depth}zM${x + w - depth} ${bottom + 1}h${depth}v14h-${depth}z" fill="#72808a" fill-opacity=".35"/>`;
      out += `<path d="M${x + 0.5} ${top + 1.2}h${Math.max(0.1, w - 1)}M${x + 0.5} ${bottom + 1.2}h${Math.max(0.1, w - 1)}" stroke="#f5f7f8" stroke-width="1"/>`;
      if (r.role === 'barrel')
        out += `<g data-cover="true"><path d="M${x + inset} ${top}v-6h${ww}v6z" fill="#7c878f" stroke="${edge}" stroke-width=".7"/><path d="M${x + inset} ${top - 6}l${depth} -3h${Math.max(0.1, ww - depth)}v3z" fill="#c2cbd2" stroke="${edge}" stroke-width=".55"/><path d="M${x + inset + depth} ${top - 8}h${Math.max(0.1, ww - depth - 1)}" stroke="#edf1f3" stroke-width=".8"/></g>`;
      out += port(r, x + w / 2, y, Math.min(w * 0.62, 26), h);
    }
    if (selected)
      out += `<rect x="${x}" y="${top - 10}" width="${w}" height="${h + 49}" fill="none" stroke="#258bc0" stroke-width="1.35" stroke-dasharray="4 2"/>`;
    return out + '</g>';
  }
  function inlet(x, w, y, h, offset) {
    if (!(w > 0)) return '';
    return `<g data-entry-connection="true" data-entry-offset="${offset}" data-start-x="${x}" data-end-x="${x + w}"><title>入口连接端示意：${offset} mm 坐标偏置段；不新增工艺机筒，不定义端板加工厚度</title>${module({ role: 'entry_connection' }, x, w, y, h)}<path data-entry-endplate="true" d="M${x + w} ${y - 23}h6v${h + 46}h-6z" fill="#78858e" stroke="#34414a" stroke-width=".85"/><path d="M${x + w + 1} ${y - 22}v${h + 44}" stroke="#c5cdd3" stroke-width="1"/></g>`;
  }
  function axialFit(spec, rows, total, target) {
    const barrel = rows.at(-1)?.mm || 0,
      offset = spec.entry_offset,
      expected = barrel + offset,
      delta = total - expected,
      targetDelta = target - expected;
    const status = !rows.length
      ? 'no-barrel'
      : total === 0
        ? 'empty'
        : delta === 0
          ? 'aligned'
          : delta > 0
            ? 'long'
            : 'short';
    const text =
      status === 'no-barrel'
        ? '机筒为空，无法核对轴向匹配'
        : status === 'empty'
          ? `待装配；入口偏置 ${offset} mm，不计入工艺机筒`
          : status === 'aligned'
            ? `轴向长度对齐：${total} − 入口偏置 ${offset} = 机筒 ${barrel} mm`
            : `轴向长度不符：${total} − 入口偏置 ${offset} = ${total - offset} mm；机筒 ${barrel} mm，${delta > 0 ? '超出' : '尚差'} ${Math.abs(delta)} mm`;
    return {
      status,
      barrel,
      offset,
      expected,
      delta,
      targetDelta,
      text:
        text +
        (rows.length && targetDelta !== 0
          ? `；方案目标与机筒加偏置相差 ${targetDelta > 0 ? '+' : ''}${targetDelta} mm`
          : ''),
    };
  }
  return { module, port, inlet, axialFit };
})();
export default BarrelVisuals;
