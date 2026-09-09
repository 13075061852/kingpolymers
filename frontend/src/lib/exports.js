import { createReport } from '../domain/report.js';
import ComponentModels from '../domain/component-models.js';
import BarrelModels from '../domain/barrel-models.js';
import { appearance, component, validate, esc } from '../domain/design.js';
import { download } from './api.js';

export function reportHtml(data, design) {
  const spec = data.machines[design.machine],
    look = appearance(data, design);
  let serial = 0;
  return createReport({
    state: design,
    spec: () => spec,
    calculate: () => validate(data, design),
    barrelConfiguration: () => BarrelModels.rows(design.machine, spec, design.ports),
    DrawingAppearance: look,
    comp: (name) => component(data, design, name),
    comps: () => data.components.filter((c) => c.machine === design.machine),
    displayPosition: (mm) => Math.round(mm + (spec.position_origin || 0)),
    esc,
    exactElementImage: (x, w, c, index, bad, y, h) =>
      ComponentModels.symbol(c, spec, {
        id: `print-${++serial}`,
        color: look.color(c),
        pad: 0,
        stretch: true,
        thumbnail: true,
        layout: `x="${x}" y="${y}" width="${Math.max(0.1, w)}" height="${h}"`,
      }) +
      (bad ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#d33"/>` : ''),
  }).render();
}
export async function exportPng(svg, name) {
  if (!svg) throw Error('图形尚未加载');
  const copy = svg.cloneNode(true);
  copy.setAttribute('width', '2400');
  const height = Math.round(2400 * (svg.viewBox.baseVal.height / svg.viewBox.baseVal.width));
  copy.setAttribute('height', String(height));
  copy.removeAttribute('style');
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(copy)], {
      type: 'image/svg+xml;charset=utf-8',
    }),
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 2400;
    canvas.height = height;
    canvas.getContext('2d').drawImage(image, 0, 0, 2400, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw Error('图片导出失败');
    download(blob, name + '.png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
