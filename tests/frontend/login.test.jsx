import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../../frontend/src/pages/Login.jsx';
import { api } from '../../frontend/src/lib/api.js';

vi.mock('../../frontend/src/components/ScrewPreview.jsx', () => ({ default: () => null }));
vi.mock('../../frontend/src/lib/api.js', () => ({ api: vi.fn() }));
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => localStorage.clear());

describe('technology login page', () => {
  it('remembers only the account after successful login and clears it when unchecked', async () => {
    api.mockResolvedValue({ ok: true });
    const onLogin = vi.fn(),
      user = userEvent.setup();
    const first = render(<Login onLogin={onLogin} />);
    await user.type(screen.getByLabelText('用户名', { exact: true }), 'engineer');
    await user.type(screen.getByLabelText('密码', { exact: true }), 'private-password');
    await user.click(screen.getByLabelText('记住账号'));
    await user.click(screen.getByRole('button', { name: '登录工作台' }));
    expect(api).toHaveBeenCalledWith('/auth/login', {
      username: 'engineer',
      password: 'private-password',
    });
    expect(onLogin).toHaveBeenCalledOnce();
    expect(localStorage.length).toBe(1);
    expect(localStorage.getItem('kingpolymer:remembered-account')).toBe('engineer');
    first.unmount();
    render(<Login onLogin={onLogin} />);
    expect(screen.getByLabelText('用户名', { exact: true })).toHaveValue('engineer');
    expect(screen.getByLabelText('密码', { exact: true })).toHaveValue('');
    await user.click(screen.getByLabelText('记住账号'));
    expect(localStorage.length).toBe(0);
  });

  it('keeps failed login retryable, supports password visibility and provides recovery guidance', async () => {
    api.mockRejectedValue(new Error('用户名或密码不正确'));
    const onLogin = vi.fn(),
      user = userEvent.setup();
    render(<Login onLogin={onLogin} />);
    await user.type(screen.getByLabelText('用户名', { exact: true }), 'engineer');
    const password = screen.getByLabelText('密码', { exact: true });
    await user.type(password, 'wrong');
    await user.click(screen.getByRole('button', { name: '显示密码' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: '隐藏密码' }));
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: '登录工作台' }));
    expect(screen.getByRole('alert')).toHaveTextContent('用户名或密码不正确');
    expect(screen.getByRole('button', { name: '登录工作台' })).toBeEnabled();
    expect(onLogin).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    await user.click(screen.getByRole('button', { name: '忘记密码？' }));
    expect(screen.getByRole('status')).toHaveTextContent('联系工作台管理员');
  });
});
