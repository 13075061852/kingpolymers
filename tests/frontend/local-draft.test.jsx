import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import useDesign from '../../frontend/src/hooks/useDesign.js';

afterEach(() => localStorage.clear());

describe('browser design drafts', () => {
  it('restores edits after remount without sending network requests', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const first = renderHook(() => useDesign());
    act(() => first.result.current.restore('user:alice'));
    act(() =>
      first.result.current.edit((d) => {
        d.sequence.push('GFA-2-60-60');
        d.metadata.drawing_name = '本地草稿';
        d.ports.natural4 = false;
      }),
    );
    const expected = first.result.current.design;
    first.unmount();
    const second = renderHook(() => useDesign());
    act(() => second.result.current.restore('user:alice'));
    expect(second.result.current.design).toEqual(expected);
    expect(second.result.current.dirty).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps accounts separate and remembers the saved baseline', () => {
    const { result } = renderHook(() => useDesign());
    act(() => result.current.restore('user:alice'));
    act(() => result.current.edit((d) => d.sequence.push('GFA-2-60-60')));
    act(() => result.current.saved('project-1'));
    act(() => result.current.restore('user:bob'));
    expect(result.current.design.sequence).toEqual([]);
    act(() => result.current.restore('user:alice'));
    expect(result.current.design.id).toBe('project-1');
    expect(result.current.dirty).toBe(false);
    act(() => result.current.edit((d) => d.sequence.push('GFA-2-60-60')));
    act(() => result.current.undo());
    act(() => result.current.restore('user:alice'));
    expect(result.current.design.sequence).toHaveLength(1);
    expect(result.current.dirty).toBe(false);
  });

  it('handles corrupt drafts and reports storage failures without crashing', () => {
    localStorage.setItem('kingpolymers:design:v1:local', '{broken');
    const { result } = renderHook(() => useDesign());
    act(() => result.current.restore('local'));
    expect(result.current.design.sequence).toEqual([]);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    act(() => result.current.edit((d) => d.sequence.push('GFA-2-60-60')));
    expect(result.current.design.sequence).toHaveLength(1);
    expect(result.current.storageError).toContain('本地存储失败');
  });
});
