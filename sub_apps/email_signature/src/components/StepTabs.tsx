interface StepTabsProps {
  currentStep: number;
  steps: Array<{ id: number; label: string }>;
  onSelect: (step: number) => void;
}

export function StepTabs({ currentStep, steps, onSelect }: StepTabsProps) {
  return (
    <ol className="step-tabs" aria-label="Wizard steps">
      {steps.map((step) => {
        const isActive = step.id === currentStep;
        return (
          <li key={step.id}>
            <button
              type="button"
              className={`step-tab ${isActive ? 'is-active' : ''}`}
              onClick={() => onSelect(step.id)}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="step-number">{step.id}</span>
              <span>{step.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
