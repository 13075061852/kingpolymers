import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import seed from '../../backend/resources/seed.json';
import ComponentModels from '../../frontend/src/domain/component-models.js';
import { emptyDesign, validate } from '../../frontend/src/domain/design.js';
import { reportHtml } from '../../frontend/src/lib/exports.js';
import useDesign, { designReducer } from '../../frontend/src/hooks/useDesign.js';
import Designer from '../../frontend/src/pages/Designer.jsx';
import { api, setSession } from '../../frontend/src/lib/api.js';

const data = { ...seed, settings: {}, projects: [], auth: { enabled: false } };
function Harness({ onSave = () => {} }) {
  const editor = useDesign();
  return (
    <Designer
      data={data}
      editor={editor}
      onSave={onSave}
      onProjects={() => {}}
      notify={() => {}}
      run={(work) => work()}
      onPrint={() => {}}
    />
  );
}
describe('engineering behavior preserved in React', () => {
  it('preserves immutable undo, redo, and saved status', () => {
    const original = { current: emptyDesign(), past: [], future: [], dirty: false };
    const changed = designReducer(original, {
      type: 'edit',
      update: (d) => d.sequence.push('GFA-2-60-60'),
    });
    expect(original.current.sequence).toEqual([]);
    const undone = designReducer(changed, { type: 'undo' });
    expect(undone.current.sequence).toEqual([]);
    const redone = designReducer(undone, { type: 'redo' });
    expect(redone.current.sequence).toEqual(['GFA-2-60-60']);
    expect(designReducer(redone, { type: 'saved', id: 'test' }).dirty).toBe(false);
  });
  it('retains default template lengths for both machines', () => {
    for (const machine of ['50', '60']) {
      const template = seed.templates.find((t) => t.machine === machine && t.is_default);
      const result = validate(data, { ...emptyDesign(machine), sequence: template.sequence });
      expect(result.difference).toBe(0);
    }
    expect(ComponentModels.parse('KB-6-2-60-90°').discs).toBe(6);
  });
  it('generates all reference pages and escapes user text', () => {
    const template = seed.templates.find((t) => t.machine === '60' && t.is_default);
    const html = reportHtml(data, {
      ...emptyDesign('60'),
      sequence: template.sequence,
      metadata: { drawing_name: '<script>bad</script>' },
    });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelectorAll('.print-page').length).toBeGreaterThanOrEqual(3);
    expect(doc.querySelector('script')).toBeNull();
    expect(html).not.toContain('NaN');
  });
  it('adds, duplicates, removes and undoes a component using React controls', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '加入 GFA-2-60-60', exact: true }));
    expect(screen.getByText('1 个位置 · 60 mm')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '复制元件 1' }));
    expect(screen.getByText('2 个位置 · 120 mm')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '删除元件 2' }));
    await user.click(screen.getByRole('button', { name: '撤销', exact: true }));
    expect(screen.getByText('2 个位置 · 120 mm')).toBeInTheDocument();
  });
  it('separates machine libraries and edits drawing fields', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.selectOptions(screen.getByLabelText('当前机型'), '60');
    expect(
      screen.getByRole('button', { name: '加入 KB-6-2-60-90°', exact: true }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '图纸资料' }));
    await user.type(screen.getByLabelText('图纸名称'), 'React测试方案');
    await user.click(screen.getByRole('button', { name: '完成' }));
    expect(screen.getByRole('heading', { name: /React测试方案/ })).toBeInTheDocument();
  });
  it('sends CSRF tokens and reports an expired cloud session', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ ok: true }),
    });
    setSession({ csrf: 'test-csrf' });
    await api('/projects', { name: 'test' });
    expect(fetchMock.mock.calls[0][1].headers['X-CSRF-Token']).toBe('test-csrf');
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: '请先登录' }),
    });
    const expired = vi.fn();
    window.addEventListener('session-expired', expired);
    await expect(api('/bootstrap')).rejects.toThrow('请先登录');
    expect(expired).toHaveBeenCalledOnce();
    window.removeEventListener('session-expired', expired);
  });
});
