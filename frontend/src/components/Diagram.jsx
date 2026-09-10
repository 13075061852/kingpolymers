import { memo, useCallback, useId, useRef } from 'react';
import ComponentModels from '../domain/component-models.js';
import BarrelModels from '../domain/barrel-models.js';
import BarrelVisuals from '../domain/barrel-visuals.js';
import { appearance, component, validate } from '../domain/design.js';
import useDiagramSort from '../hooks/useDiagramSort.js';

function Diagram({
  data,
  design,
  selected,
  onSelect,
  onMove,
  onRemove,
  onDragChange,
  elementIds = [],
  readOnly = false,
  zoom = 1,
  svgRef,
}) {
  const id = useId().replace(/:/g, ''),
    root = useRef(null),
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
    axisY = 82,
    barrelEnd = right - spec.entry_offset * scale,
    fullEntry = !look.referenceView() && rows[0]?.role === 'feed';
  const elements = check.spans.map((span) => {
    const c = component(data, design, span.name);
    return {
      ...span,
      id: elementIds[span.index] || `diagram-element-${span.index}`,
      component: c,
      x: right - (span.end + spec.entry_offset) * scale,
      width: c.length * scale,
      bad: check.violations.some((violation) => violation.index === span.index),
    };
  });
  const sort = useDiagramSort({
    root,
    items: elements,
    disabled: readOnly,
    visibleRight: look.referenceView() ? barrelEnd : null,
    onMove,
    onSelect,
    onRemove,
    onDragChange,
  });
  const attachSvg = useCallback(
    (node) => {
      root.current = node;
      if (typeof svgRef === 'function') svgRef(node);
      else if (svgRef) svgRef.current = node;
    },
    [svgRef],
  );
  return (
    <div className="drawing-scroll">
      <svg
        ref={attachSvg}
        className="drawing"
        role="group"
        aria-label="螺杆侧视单轴组合图"
        data-axis-view="single"
        data-reference-view={look.referenceView() ? 'barrel' : 'full'}
        data-diagram-dragging={sort.drag?.active || undefined}
        viewBox="0 0 1200 212"
        style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, minWidth: 720 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="1200" height="212" fill="white" />
        <defs>
          <clipPath id={`${id}-axis`}>
            <rect x="0" y="40" width={1140} height="124" />
          </clipPath>
        </defs>
        <g clipPath={look.referenceView() ? `url(#${id}-axis)` : undefined}>
          {rows.map((row) => {
            const x = right - (row.mm + spec.entry_offset) * scale;
            return (
              <g key={row.uid || row.pos}>
                <g
                  dangerouslySetInnerHTML={{
                    __html: BarrelVisuals.module(row, x, row.length * scale, axisY, height),
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
                  axisY,
                  height,
                  spec.entry_offset,
                ),
              }}
            />
          )}
          {elements.map((item) => {
            const hitWidth = Math.max(item.width, 8),
              hitX = item.x - (hitWidth - item.width) / 2,
              showNumber =
                item.width >= 9 || selected === item.index || sort.drag?.from === item.index;
            return (
              <g
                key={item.id}
                data-element-index={item.index}
                role="button"
                tabIndex="0"
                aria-label={`位置 ${item.index + 1}，${item.component.name}，拖拽调整顺序`}
                {...sort.elementProps(item.index)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect?.(item.index);
                  }
                }}
              >
                <g
                  dangerouslySetInnerHTML={{
                    __html: ComponentModels.symbol(item.component, spec, {
                      id: `${id}-element-${item.id}`,
                      color: look.color(item.component),
                      pad: 0,
                      stretch: true,
                      thumbnail: true,
                      layout: `x="${item.x}" y="${axisY}" width="${item.width}" height="${height}"`,
                    }),
                  }}
                />
                {(selected === item.index || item.bad) && (
                  <rect
                    x={item.x}
                    y={axisY - 2}
                    width={Math.max(item.width, 2)}
                    height={height + 4}
                    fill="none"
                    stroke={item.bad ? '#d94747' : '#1d7d86'}
                    strokeWidth="2"
                    pointerEvents="none"
                  />
                )}
                <rect
                  data-element-hitbox="true"
                  x={hitX}
                  y={axisY - 5}
                  width={hitWidth}
                  height={height + 10}
                  fill="transparent"
                >
                  <title>
                    {item.component.name} · {item.component.length} mm
                  </title>
                </rect>
                {showNumber && (
                  <text
                    x={item.x + item.width / 2}
                    y={axisY + height + 27}
                    textAnchor="middle"
                    fontSize="8"
                    pointerEvents="none"
                  >
                    {item.index + 1}
                  </text>
                )}
              </g>
            );
          })}
          {sort.slot && (
            <rect
              data-diagram-drop-slot="true"
              x={sort.slot.x}
              y={axisY - 3}
              width={Math.max(sort.slot.width, 2)}
              height={height + 6}
              rx="2"
              fill="#1d7d8614"
              stroke="#168a94"
              strokeWidth="1.5"
              strokeDasharray="4 2"
              pointerEvents="none"
            />
          )}
        </g>
        {look.referenceView() && (
          <g dangerouslySetInnerHTML={{ __html: look.plate(barrelEnd, axisY, height) }} />
        )}
        <line x1="60" x2="1140" y1="166" y2="166" stroke="#a8b6be" />
        {Array.from({ length: 7 }, (_, index) => index).map((index) => (
          <g key={index}>
            <line
              x1={1140 - index * 180}
              x2={1140 - index * 180}
              y1="162"
              y2="171"
              stroke="#91a3ad"
            />
            <text x={1140 - index * 180} y="183" textAnchor="middle" fontSize="9" fill="#5d7480">
              {Math.round((extent * index) / 6)}
            </text>
          </g>
        ))}
        <text x="60" y="204" fontSize="10" fill="#7a8992">
          出料端
        </text>
        <text x="1140" y="204" textAnchor="end" fontSize="10" fill="#7a8992">
          进料端 · mm
        </text>
      </svg>
    </div>
  );
}
export default memo(Diagram);
