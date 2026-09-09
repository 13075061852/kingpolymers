export const metadataFields = [
  ['drawing_name', '图纸名称'],
  ['machine_no', '机器编号'],
  ['version', '版本号'],
  ['date', '日期'],
  ['author', '制图人'],
  ['customer', '客户名称'],
  ['material', '材料名称'],
  ['line', '生产线'],
  ['shift', '班组'],
  ['reviewer', '审核人'],
  ['approver', '批准人'],
  ['side1_label', '侧喂料 1'],
  ['side2_label', '侧喂料 2'],
  ['comments', '工艺备注'],
];
export default function MetadataForm({ design, onChange }) {
  return (
    <div className="form-grid">
      {metadataFields.map(([key, label]) => (
        <label key={key}>
          {label}
          <input
            aria-label={label}
            type={key === 'date' ? 'date' : 'text'}
            value={design.metadata[key] ?? ''}
            onChange={(e) => onChange(key, e.target.value)}
          />
        </label>
      ))}
    </div>
  );
}
