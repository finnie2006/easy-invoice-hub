import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from './rich-text-editor';

const getEditor = (container: HTMLElement) => {
  const editor = container.querySelector('[contenteditable="true"]');
  if (!(editor instanceof HTMLElement)) {
    throw new Error('Rich text editor not found');
  }
  return editor;
};

describe('RichTextEditor', () => {
  it('does not rewrite normal input on controlled rerender, preserving the active selection', () => {
    const handleChange = vi.fn();
    const { container, rerender } = render(<RichTextEditor value="" onChange={handleChange} />);
    const editor = getEditor(container);

    editor.textContent = 'Project';
    editor.focus();

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    fireEvent.input(editor);
    rerender(<RichTextEditor value="Project" onChange={handleChange} />);

    expect(handleChange).toHaveBeenLastCalledWith('Project');
    expect(window.getSelection()?.anchorOffset).toBe(1);
    expect(window.getSelection()?.anchorNode).toBe(editor);
  });

  it('sanitizes unsafe pasted HTML before passing it to state', () => {
    const handleChange = vi.fn();
    const { container } = render(<RichTextEditor value="" onChange={handleChange} />);
    const editor = getEditor(container);

    editor.innerHTML = '<img src=x onerror="alert(1)"><b onclick="alert(1)">Project</b>';
    fireEvent.input(editor);

    expect(handleChange).toHaveBeenLastCalledWith('<b>Project</b>');
    expect(editor.innerHTML).toBe('<b>Project</b>');
  });
});
