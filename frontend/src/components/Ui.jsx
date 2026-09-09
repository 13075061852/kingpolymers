import { Search, X, Inbox, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
export function SearchField({ value, onChange, placeholder, label = placeholder }) {
  return (
    <div className="search">
      <Search size={17} />
      <input
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button className="icon-button" aria-label={'清除' + label} onClick={() => onChange('')}>
          <X size={15} />
        </button>
      )}
    </div>
  );
}
export function MachineSwitch({ machines, value, onChange, label = '选择机型' }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {Object.entries(machines).map(([key, spec]) => (
        <button
          key={key}
          title={spec.name}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {key}CC
        </button>
      ))}
    </div>
  );
}
export function EmptyState({ title, description, action, icon: Icon = Inbox }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={30} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function PasswordField({ label, name, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <label>
      {label}
      <span className="password-input">
        <input name={name} type={visible ? 'text' : 'password'} {...props} />
        <button
          type="button"
          className="icon-button"
          aria-label={(visible ? '隐藏' : '显示') + label}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}
