interface WizardNavigationProps {
  currentStep: number;
  maxStep: number;
  previousLabel: string;
  nextLabel: string;
  onPrevious: () => void;
  onNext: () => void;
}

export function WizardNavigation({
  currentStep,
  maxStep,
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
}: WizardNavigationProps) {
  return (
    <div className="wizard-actions">
      <button type="button" className="button secondary" onClick={onPrevious} disabled={currentStep === 1}>
        {previousLabel}
      </button>
      <button type="button" className="button primary" onClick={onNext} disabled={currentStep === maxStep}>
        {nextLabel}
      </button>
    </div>
  );
}
