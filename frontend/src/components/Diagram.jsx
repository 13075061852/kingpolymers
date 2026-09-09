import { memo, useId } from 'react';
import ComponentModels from '../domain/component-models.js';
import BarrelModels from '../domain/barrel-models.js';
import BarrelVisuals from '../domain/barrel-visuals.js';
import { appearance, component, validate } from '../domain/design.js';

function Diagram({ data, design, selected, onSelect, zoom = 1, svgRef }) {
  const id = useId().replace(/:/g, ''),
    spec = data.machines[design.machine],
    check = validate(data, design);
  const rows = BarrelModels.rows(design.machine, spec, design.ports),
    look = appearance(data, design);
  const offset = look.referenceView() ? spec.entry_offset : 0;
  const extent =
    Math.max(check.total, check.target, (rows.at(-1)?.mm || 0) + spec.entry_offset) - offset;
  const scale = 1080 / Math.max(extent, 1),
    right = 1140 + offset * scale,
    height = spec.diameter * scale,
    boreHeight = height * 2 + 7,
    secondAxisY = 82 + height + 7,
    barrelEnd = right - spec.entry_offset * scale,
    fullEntry = !look.referenceView() && rows[0]?.role === 'feed';
  return (
    <div className="drawing-scroll">
      <svg
        ref={svgRef}
        className="drawing"
        role="img"
        aria-label="螺杆和机筒组合图"
        viewBox="0 0 1200 240"
        style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, minWidth: 720 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="1200" height="240" fill="white" />
        <text x="60" y="20" fontSize="12" fill="#223c4b">
          {spec.name} · 螺杆 {check.total} / {check.target} mm
        </text>
        <text x="60" y="36" fontSize="10" fill="#71818c">
          {look.note()}
        </text>
        <defs>
          <clipPath id={`${id}-axis`}>
            <rect x="0" y="40" width={1140} height="160" />
          </clipPath>
        </defs>
        <g clipPath={look.referenceView() ? `url(#${id}-axis)` : undefined}>
          {rows.map((row, i) => {
            const x = right - (row.mm + spec.entry_offset) * scale;
            return (
              <g key={row.uid || row.pos}>
                <g
                  dangerouslySetInnerHTML={{
                    __html: BarrelVisuals.module(row, x, row.length * scale, 82, boreHeight),
                  }}
                />
                <text x={x + (row.length * scale) / 2} y="51" textAnchor="middle" fontSize="10">
                  {row.pos}
                </text>
              </g>
            );
          })}
          {fullEntry && (
            <g
              dangerouslySetInnerHTML={{
                __html: BarrelVisuals.inlet(
                  barrelEnd,
                  spec.entry_offset * scale,
                  82,
                  boreHeight,
                  spec.entry_offset,
                ),
              }}
            />
          )}
          {check.spans.map((span) => {
            const c = component(data, design, span.name),
              x = right - (span.end + spec.entry_offset) * scale,
              w = c.length * scale,
              bad = check.violations.some((v) => v.index === span.index);
            return (
              <g
                key={span.index}
                data-element-index={span.index}
                onClick={() => onSelect?.(span.index)}
                style={{ cursor: 'pointer' }}
              >
                <g
                  dangerouslySetInnerHTML={{
                    __html: ComponentModels.symbol(c, spec, {
                      id: `${id}-element-${span.index}`,
                      color: look.color(c),
                      pad: 0,
                      stretch: true,
                      thumbnail: true,
                      layout: `x="${x}" y="82" width="${w}" height="${height}"`,
                    }),
                  }}
                />
                <g
                  dangerouslySetInnerHTML={{
                    __html: ComponentModels.symbol(c, spec, {
                      id: `${id}-paired-${span.index}`,
                      color: look.color(c),
                      pad: 0,
                      stretch: true,
                      thumbnail: true,
                      layout: `x="${x}" y="${secondAxisY}" width="${w}" height="${height}"`,
                    }),
                  }}
                />
                {(selected === span.index || bad) && (
                  <rect
                    x={x}
                    y="80"
                    width={Math.max(w, 2)}
                    height={boreHeight + 4}
                    fill="none"
                    stroke={bad ? '#d94747' : '#1d7d86'}
                    strokeWidth="2"
                  />
                )}
                <rect
                  x={x}
                  y="80"
                  width={Math.max(w, 3)}
                  height={boreHeight + 4}
                  fill="transparent"
                >
                  <title>
                    {c.name} · {c.length} mm
                  </title>
                </rect>
                <text x={x + w / 2} y={155 + height} textAnchor="middle" fontSize="8">
                  {span.index + 1}
                </text>
              </g>
            );
          })}
        </g>
        {look.referenceView() && (
          <g dangerouslySetInnerHTML={{ __html: look.plate(barrelEnd, 82, boreHeight) }} />
        )}
        <text x="16" y={82 + height * 0.7} fontSize="10" fill="#8195a3">
          A 轴
        </text>
        <text x="16" y={secondAxisY + height * 0.7} fontSize="10" fill="#8195a3">
          B 轴
        </text>
        <line x1="60" x2="1140" y1="196" y2="196" stroke="#a8b6be" />
        {Array.from({ length: 7 }, (_, i) => i).map((i) => (
          <g key={i}>
            <line x1={1140 - i * 180} x2={1140 - i * 180} y1="192" y2="201" stroke="#91a3ad" />
            <text x={1140 - i * 180} y="213" textAnchor="middle" fontSize="9" fill="#5d7480">
              {Math.round((extent * i) / 6)}
            </text>
          </g>
        ))}
        <text x="60" y="232" fontSize="10" fill="#7a8992">
          出料端
        </text>
        <text x="1140" y="232" textAnchor="end" fontSize="10" fill="#7a8992">
          进料端 · mm
        </text>
      </svg>
    </div>
  );
}
export default memo(Diagram);
