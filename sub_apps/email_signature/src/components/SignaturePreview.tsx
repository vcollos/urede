import { SignatureFormState } from '../types';
import { buildSignatureHtml } from '../generators/signatureHtml';

interface SignaturePreviewProps {
  state: SignatureFormState;
  copy: {
    emailPreviewFrom: string;
    emailPreviewTo: string;
    emailPreviewSubject: string;
    emailPreviewBody: string;
  };
}

export function SignaturePreview({ state, copy }: SignaturePreviewProps) {
  const signatureHtml = buildSignatureHtml(state);

  return (
    <div className="email-preview" aria-label="Email preview panel">
      <div className="email-preview-header">
        <p><strong>{copy.emailPreviewFrom}:</strong> Jane Sender &lt;jane.sender@company.com&gt;</p>
        <p><strong>{copy.emailPreviewTo}:</strong> team@company.com</p>
        <p><strong>{copy.emailPreviewSubject}:</strong> Signature update</p>
      </div>
      <div className="email-preview-body">
        <p>{copy.emailPreviewBody}</p>
        <div
          className="signature-html-preview"
          dangerouslySetInnerHTML={{ __html: signatureHtml }}
        />
      </div>
    </div>
  );
}
