import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

marked.use({
  breaks: true,
  gfm: true,
});

declare const window: any;

type DOMPurifyModule = typeof import('isomorphic-dompurify');

const sanitize = (html: string) => {
  if (typeof window === 'undefined') {
    const { sanitize } = (DOMPurify as DOMPurifyModule);
    return sanitize(html);
  }
  const purifier = window.DOMPurify || (window.DOMPurify = DOMPurify);
  return purifier.sanitize(html);
};

export const renderMarkdown = (content: string) => {
  if (!content.trim()) return '';
  const raw = marked.parse(content, { async: false }) as string;
  return sanitize(raw);
};
