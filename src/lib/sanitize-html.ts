import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'b',
  'br',
  'div',
  'em',
  'i',
  'li',
  'ol',
  'p',
  'span',
  'strong',
  'u',
  'ul',
];

export const sanitizeRichTextHtml = (html: string | null | undefined) => {
  return DOMPurify.sanitize(html || '', {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [],
  });
};
