import { ReactNode } from 'react';

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  hint?: string;
  counter?: string;
}

export function FormField({ id, label, required = false, error, children, hint, counter }: FormFieldProps) {
  const describedBy = [hint ? `${id}-hint` : '', counter ? `${id}-counter` : '', error ? `${id}-error` : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className="field-block">
      <label htmlFor={id} className="field-label">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <div aria-describedby={describedBy || undefined}>{children}</div>
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {counter && (
        <p id={`${id}-counter`} className="field-counter" aria-live="polite">
          {counter}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
