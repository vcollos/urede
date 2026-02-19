import { OutputPanel } from './components/OutputPanel';
import { SignaturePreview } from './components/SignaturePreview';
import { StepTabs } from './components/StepTabs';
import { WizardNavigation } from './components/WizardNavigation';
import { StepDetails } from './components/steps/StepDetails';
import { StepImages } from './components/steps/StepImages';
import { StepStyles } from './components/steps/StepStyles';
import { StepTemplates } from './components/steps/StepTemplates';
import { useSignatureWizard } from './hooks/useSignatureWizard';

export default function App() {
  const {
    state,
    copy,
    errors,
    updateDetails,
    updateSocial,
    updateImageUrl,
    setImageShape,
    setImageSize,
    setImageVisibility,
    updateStyleField,
    updateCtaField,
    addCustomField,
    removeCustomField,
    updateCustomField,
    normalizeUrlAt,
    nextStep,
    previousStep,
    goToStep,
    clearAll,
    generateOutput,
    setLocale,
    setTemplate,
  } = useSignatureWizard();

  const steps = [
    { id: 1, label: copy.steps.details },
    { id: 2, label: copy.steps.images },
    { id: 3, label: copy.steps.templates },
    { id: 4, label: copy.steps.styles },
  ];

  return (
    <div className="signature-app">
      <header className="app-header">
        <h1>{copy.appTitle}</h1>
        <div className="language-switch">
          <label htmlFor="locale-select">{copy.languageLabel}</label>
          <select
            id="locale-select"
            value={state.locale}
            onChange={(event) => setLocale(event.target.value as 'pt-BR' | 'en')}
          >
            <option value="pt-BR">pt-BR</option>
            <option value="en">en</option>
          </select>
        </div>
      </header>

      <main className="app-layout">
        <section className="panel left-panel" aria-label={copy.leftPanelTitle}>
          <StepTabs currentStep={state.currentStep} steps={steps} onSelect={goToStep} />

          <div className="step-container">
            {state.currentStep === 1 && (
              <StepDetails
                locale={state.locale}
                state={state}
                errors={errors}
                placeholders={copy.placeholders}
                updateDetails={updateDetails}
                updateSocial={updateSocial}
                normalizeUrlAt={normalizeUrlAt}
                addCustomField={addCustomField}
                removeCustomField={removeCustomField}
                updateCustomField={updateCustomField}
              />
            )}

            {state.currentStep === 2 && (
              <StepImages
                locale={state.locale}
                state={state}
                errors={errors}
                placeholders={copy.placeholders}
                updateImageUrl={updateImageUrl}
                setImageVisibility={setImageVisibility}
                normalizeUrlAt={normalizeUrlAt}
                updateShape={setImageShape}
                updateSize={setImageSize}
              />
            )}

            {state.currentStep === 3 && (
              <StepTemplates
                locale={state.locale}
                template={state.template}
                onChange={setTemplate}
              />
            )}

            {state.currentStep === 4 && (
              <StepStyles
                locale={state.locale}
                state={state}
                errors={errors}
                placeholders={copy.placeholders}
                updateStyle={updateStyleField}
                updateCta={updateCtaField}
                normalizeUrlAt={normalizeUrlAt}
              />
            )}
          </div>

          <WizardNavigation
            currentStep={state.currentStep}
            maxStep={4}
            previousLabel={copy.previous}
            nextLabel={copy.next}
            onPrevious={previousStep}
            onNext={nextStep}
          />
        </section>

        <section className="panel right-panel" aria-label={copy.rightPanelTitle}>
          <div className="panel-actions">
            <button type="button" className="button secondary" onClick={clearAll}>{copy.clearForm}</button>
            <button type="button" className="button primary" onClick={generateOutput}>{copy.generate}</button>
          </div>

          <h2>{copy.previewTitle}</h2>
          <SignaturePreview
            state={state}
            copy={{
              emailPreviewFrom: copy.emailPreviewFrom,
              emailPreviewTo: copy.emailPreviewTo,
              emailPreviewSubject: copy.emailPreviewSubject,
              emailPreviewBody: copy.emailPreviewBody,
            }}
          />

          <OutputPanel
            state={state}
            copy={{
              outputTitle: copy.outputTitle,
              htmlOutput: copy.htmlOutput,
              textOutput: copy.textOutput,
              copySignature: copy.copySignature,
              copyHtml: copy.copyHtml,
              copyText: copy.copyText,
              downloadHtml: copy.downloadHtml,
              copied: copy.copied,
              generateFirst: copy.generateFirst,
              installTipsTitle: copy.installTipsTitle,
              installTips: copy.installTips,
            }}
          />
        </section>
      </main>
    </div>
  );
}
