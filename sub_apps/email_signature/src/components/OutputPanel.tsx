import { useState } from 'react';
import { SignatureFormState } from '../types';

interface OutputPanelProps {
  state: SignatureFormState;
  copy: {
    outputTitle: string;
    htmlOutput: string;
    textOutput: string;
    copySignature: string;
    copyHtml: string;
    copyText: string;
    downloadHtml: string;
    copied: string;
    generateFirst: string;
    installTipsTitle: string;
    installTips: string[];
  };
}

const copyToClipboard = async (value: string) => {
  if (!value) return false;
  if (!navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
};

const plainTextFromHtml = (html: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
};

const copyRenderedSignature = async (html: string, plainText: string) => {
  if (!html) return false;

  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainText || plainTextFromHtml(html)], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
      return true;
    } catch {
      // Fallback below keeps compatibility with clients that block rich clipboard API.
    }
  }

  const fallbackRoot = document.createElement('div');
  fallbackRoot.style.position = 'fixed';
  fallbackRoot.style.left = '-9999px';
  fallbackRoot.style.top = '0';
  fallbackRoot.setAttribute('contenteditable', 'true');
  fallbackRoot.innerHTML = html;
  document.body.appendChild(fallbackRoot);

  try {
    const selection = window.getSelection();
    if (!selection) return copyToClipboard(plainText || plainTextFromHtml(html));

    const range = document.createRange();
    range.selectNodeContents(fallbackRoot);
    selection.removeAllRanges();
    selection.addRange(range);

    const copied = document.execCommand('copy');
    selection.removeAllRanges();
    if (copied) return true;
    return copyToClipboard(plainText || plainTextFromHtml(html));
  } finally {
    document.body.removeChild(fallbackRoot);
  }
};

const downloadHtml = (html: string) => {
  const documentContent = `<!doctype html><html><body>${html}</body></html>`;
  const blob = new Blob([documentContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'assinatura-email.html';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export function OutputPanel({ state, copy }: OutputPanelProps) {
  const [feedback, setFeedback] = useState('');

  const showFeedback = (message: string) => {
    setFeedback(message);
    window.setTimeout(() => {
      setFeedback('');
    }, 1800);
  };

  const hasOutput = Boolean(state.output.html);

  return (
    <section className="output-panel" aria-label={copy.outputTitle}>
      <h3>{copy.outputTitle}</h3>
      {!hasOutput && <p className="field-hint">{copy.generateFirst}</p>}

      <div className="output-actions">
        <button
          type="button"
          className="button secondary"
          onClick={async () => {
            const ok = await copyRenderedSignature(state.output.html, state.output.text);
            if (ok) showFeedback(copy.copied);
          }}
          disabled={!hasOutput}
        >
          {copy.copySignature}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={async () => {
            const ok = await copyToClipboard(state.output.html);
            if (ok) showFeedback(copy.copied);
          }}
          disabled={!hasOutput}
        >
          {copy.copyHtml}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={async () => {
            const ok = await copyToClipboard(state.output.text);
            if (ok) showFeedback(copy.copied);
          }}
          disabled={!hasOutput}
        >
          {copy.copyText}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => downloadHtml(state.output.html)}
          disabled={!hasOutput}
        >
          {copy.downloadHtml}
        </button>
      </div>

      {feedback && (
        <p className="copy-feedback" role="status" aria-live="polite">
          {feedback}
        </p>
      )}

      <label className="output-label" htmlFor="output-html">{copy.htmlOutput}</label>
      <textarea id="output-html" value={state.output.html} readOnly rows={8} className="output-textarea" />

      <label className="output-label" htmlFor="output-text">{copy.textOutput}</label>
      <textarea id="output-text" value={state.output.text} readOnly rows={8} className="output-textarea" />

      <h4>{copy.installTipsTitle}</h4>
      <ul className="install-list">
        {copy.installTips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </section>
  );
}
