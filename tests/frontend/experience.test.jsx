import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { designReducer } from '../../frontend/src/hooks/useDesign.js';
import { emptyDesign } from '../../frontend/src/domain/design.js';
import ConfirmProvider, { useConfirm } from '../../frontend/src/components/ConfirmProvider.jsx';
import Modal from '../../frontend/src/components/Modal.jsx';
import Inventory from '../../frontend/src/pages/Inventory.jsx';
import Projects from '../../frontend/src/pages/Projects.jsx';
describe('experience regressions', () => {
  it('preserves saved identity through undo and redo and recognizes the saved baseline', () => {
    let state = designReducer({}, { type: 'load', design: emptyDesign() });
    state = designReducer(state, { type: 'edit', update: (d) => d.sequence.push('GFA-2-60-60') });
    state = designReducer(state, { type: 'saved', id: 'persisted-id' });
    state = designReducer(state, { type: 'undo' });
    expect(state.current.id).toBe('persisted-id');
    expect(state.dirty).toBe(true);
    state = designReducer(state, { type: 'redo' });
    expect(state.current.id).toBe('persisted-id');
    expect(state.dirty).toBe(false);
    expect(designReducer(state, { type: 'edit', update: () => {} })).toBe(state);
  });
  it('requires an explicit confirmation and supports cancellation', async () => {
    const action = vi.fn(),
      user = userEvent.setup();
    function Example() {
      const ask = useConfirm();
      return (
        <button
          onClick={async () => {
            if (await ask('清空测试内容？')) action();
          }}
        >
          清空
        </button>
      );
    }
    render(
      <ConfirmProvider>
        <Example />
      </ConfirmProvider>,
    );
    await user.click(screen.getByRole('button', { name: '清空' }));
    expect(action).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(action).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '清空' }));
    await user.click(screen.getByRole('button', { name: '继续' }));
    expect(action).toHaveBeenCalledOnce();
  });
  it('dialog clicks do not discard entered fields', async () => {
    const close = vi.fn(),
      user = userEvent.setup();
    render(
      <Modal title="编辑参数" onClose={close}>
        <label>
          参数
          <input defaultValue="保留" />
        </label>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: '编辑参数' });
    await user.click(dialog);
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText('参数')).toHaveValue('保留');
  });
  it('stock adjustment resets delta to zero and prevents negative result', async () => {
    const user = userEvent.setup();
    render(
      <Inventory
        data={{
          machines: { 50: { name: '50CC' } },
          components: [{ id: 'c1', machine: '50', name: 'TEST', type: 'GFA', stock: 8 }],
        }}
        onAdjust={vi.fn()}
        onHistory={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: '调整库存' }));
    await user.selectOptions(screen.getByLabelText('调整方式'), 'add');
    const input = screen.getByLabelText('变动数量 / 件');
    expect(input).toHaveValue(0);
    await user.clear(input);
    await user.type(input, '-9');
    expect(screen.getByRole('button', { name: '保存调整' })).toBeDisabled();
  });
  it('combines status, machine and name filters without mixing machines', async () => {
    const user = userEvent.setup();
    render(
      <Projects
        data={{
          machines: { 50: {}, 60: {} },
          projects: [
            { id: '1', name: 'A方案', machine: '50', status: 'draft' },
            { id: '2', name: 'B方案', machine: '60', status: 'released' },
          ],
        }}
      />,
    );
    await user.click(
      within(screen.getByRole('group', { name: '方案状态' })).getByRole('button', { name: /草稿/ }),
    );
    expect(screen.getByText('A方案')).toBeVisible();
    expect(screen.queryByText('B方案')).toBeNull();
    await user.selectOptions(screen.getByLabelText('方案机型'), '60');
    expect(screen.getByText('没有匹配的方案')).toBeVisible();
  });
});
