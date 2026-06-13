import { describe, expect, it } from 'vitest';
import { sanitizeRichTextHtml } from './sanitize-html';

describe('sanitizeRichTextHtml', () => {
  it('keeps invoice note formatting but removes scripts, event handlers, and unsafe tags', () => {
    const result = sanitizeRichTextHtml(
      '<p onclick="alert(1)">Project <strong>werk</strong></p><img src=x onerror="alert(1)"><script>alert(1)</script>'
    );

    expect(result).toContain('<p>Project <strong>werk</strong></p>');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('<img');
    expect(result).not.toContain('<script');
  });
});
