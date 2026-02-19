import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SignaturePreview } from '../components/SignaturePreview';
import { DEFAULT_STATE } from '../state/defaultState';

describe('SignaturePreview', () => {
  it('renders sender and signature name in preview', () => {
    const state = {
      ...DEFAULT_STATE,
      details: {
        ...DEFAULT_STATE.details,
        firstName: 'Joao',
        lastName: 'Souza',
      },
    };

    render(
      <SignaturePreview
        state={state}
        copy={{
          emailPreviewFrom: 'De',
          emailPreviewTo: 'Para',
          emailPreviewSubject: 'Assunto',
          emailPreviewBody: 'Segue assinatura',
        }}
      />,
    );

    expect(screen.getByText(/Jane Sender/)).toBeInTheDocument();
    expect(screen.getByText(/Joao/)).toBeInTheDocument();
    expect(screen.getByText(/Souza/)).toBeInTheDocument();
  });
});
