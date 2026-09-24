import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import saveSubmissionAction from '@/actions/saveSubmission';
import sendDisciplinaryEmailENAction from '@/actions/sendDisciplinaryEmailEN';
import loadCurrentFilerAction from '@/actions/loadCurrentFiler';
import { DisciplinaryFormData, INITIAL_FORM, EvidenceType, EVIDENCE_OPTIONS, todayLocalYMD } from '@/app/utils/disciplinaryFormData';
import { buildDisciplinaryEmail } from '@/app/utils/buildDisciplinaryEmail';
import { PriorAction } from '@/app/components/PriorActionsPanel';
import { generateDisciplinaryPdfENBase64 } from '@/app/utils/generatePdf';
import Step1EmployeeWarning from '@/app/pages/wizard/Step1EmployeeWarning';
import Step2ScenarioIncident from '@/app/pages/wizard/Step2ScenarioIncident';
import Step3Expectations from '@/app/pages/wizard/Step3Expectations';
import Step4ReviewSubmit from '@/app/pages/wizard/Step4ReviewSubmit';
import StepProgress, { STEPS } from '@/app/pages/wizard/StepProgress';

const GAF_RED = '#E52020';
const GAF_NAVY = '#1C2340';

export default function OfferLetterForm() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<DisciplinaryFormData>(() => ({ ...INITIAL_FORM, documentDate: todayLocalYMD() }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveSubmission, isSaving] = useMutateAction(saveSubmissionAction);
  const [sendEmailEN] = useMutateAction(sendDisciplinaryEmailENAction);
  const [priorWarningsTouched, setPriorWarningsTouched] = useState(false);

  // The filer is the signed-in user. The email goes to them; the DB takes it from the login.
  const [filerRows] = useLoadAction(loadCurrentFilerAction, [] as { email: string | null }[], {});
  const filerEmail = ((filerRows as { email: string | null }[])[0]?.email ?? '').trim().toLowerCase();
  const [submitError, setSubmitError] = useState('');

  const updateForm = useCallback((updates: Partial<DisciplinaryFormData>) => {
    if ('priorWarnings' in updates) setPriorWarningsTouched(true);
    setFormData(prev => ({ ...prev, ...updates }));
    setErrors(prev => {
      const next = { ...prev };
      Object.keys(updates).forEach(k => delete next[k]);
      return next;
    });
  }, []);

  const handlePriorWarningsSuggestion = useCallback((suggested: string) => {
    if (!priorWarningsTouched) {
      setFormData(prev => ({ ...prev, priorWarnings: suggested }));
    }
  }, [priorWarningsTouched]);

  const handleFollowUp = useCallback((prior: PriorAction) => {
    const today = todayLocalYMD();
    const happened = prior.q_happened ?? '';
    const priorDateDisplay = prior.document_date
      ? new Date(prior.document_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
      : prior.document_date;
    const priorWarningsRef = `Follow-up to ${prior.warning_level} issued ${priorDateDisplay} (${prior.scenario}): ${happened.slice(0, 160)}${happened.length > 160 ? '…' : ''}`;

    setFormData(prev => ({
      ...prev,
      scenario: (prior.scenario as DisciplinaryFormData['scenario']) ?? prev.scenario,
      qExpected: prior.q_expected ?? '',
      qHappened: prior.q_happened ?? '',
      qWhen: prior.q_when ?? '',
      qImpact: prior.q_impact ?? '',
      evidenceTypes: (prior.evidence_types ?? []).filter((t): t is EvidenceType =>
        EVIDENCE_OPTIONS.includes(t as EvidenceType)
      ),
      evidenceDescription: prior.evidence_description ?? '',
      expectations: prior.expectations ?? '',
      consequences: prior.consequences ?? '',
      employeeName: prev.employeeName,
      employeeRole: prev.employeeRole,
      employeeBranch: prev.employeeBranch,
      warningLevel: '',
      finalOutcome: '',
      documentDate: today,
      revaluationDate: '',
      priorWarnings: priorWarningsRef,
    }));
    setPriorWarningsTouched(true);
    setErrors({});
  }, []);

  const validateStep = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!formData.documentDate) e.documentDate = 'Document date is required';
      if (!formData.employeeName) e.employeeName = 'Select an employee';
      if (!formData.warningLevel) e.warningLevel = 'Select a warning level';
      if (formData.warningLevel === 'Final Written Warning' && !formData.finalOutcome) {
        e.finalOutcome = 'Select a final outcome';
      }
    }
    if (s === 2) {
      if (!formData.scenario) e.scenario = 'Select a scenario';
      if (!formData.qExpected.trim()) e.qExpected = 'This field is required';
      if (!formData.qHappened.trim()) e.qHappened = 'This field is required';
      if (!formData.qWhen.trim()) e.qWhen = 'This field is required';
      if (!formData.qImpact.trim()) e.qImpact = 'This field is required';
      if (formData.evidenceTypes.length === 0) e.evidenceTypes = 'Select at least one type';
    }
    if (s === 3) {
      if (!formData.priorWarnings.trim()) e.priorWarnings = 'This field is required';
      if (!formData.expectations.trim()) e.expectations = 'This field is required';
      if (!formData.consequences.trim()) e.consequences = 'This field is required';
      if (!formData.revaluationDate) e.revaluationDate = 'Re-evaluation date is required';
    }
    if (s === 4) {
      if (!formData.signatureDrawn) e.signatureDrawn = 'Signature is required before submitting';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) setStep(s => s + 1);
  };

  const handleBack = () => {
    setErrors({});
    setStep(s => s - 1);
  };

  const handleSubmit = useCallback(async () => {
    if (!validateStep(4)) return;
    setSubmitError('');
    if (!filerEmail) {
      setSubmitError("You're not signed in, so this form can't be filed. Sign in with your work email and reload the page.");
      return;
    }
    const ref = `GAF-DA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // ── 1. EN PDF (a failed PDF still saves the row, as before) ──
    let enBase64 = '';
    try {
      enBase64 = await generateDisciplinaryPdfENBase64({ ...formData, ref });
    } catch (err) {
      console.error('EN PDF generation failed:', err);
    }

    // ── 2. Save. manager_email is written on the server from the login. ──
    try {
      const saved = await saveSubmission({
        ref,
        manager_name: formData.managerName,
        employee_name: formData.employeeName,
        employee_role: formData.employeeRole,
        employee_branch: formData.employeeBranch,
        document_date: formData.documentDate,
        revaluation_date: formData.revaluationDate,
        warning_level: formData.warningLevel,
        final_outcome: formData.finalOutcome || null,
        scenario: formData.scenario,
        q_expected: formData.qExpected,
        q_happened: formData.qHappened,
        q_when: formData.qWhen,
        q_impact: formData.qImpact,
        evidence_types: formData.evidenceTypes,
        evidence_description: formData.evidenceDescription,
        prior_warnings: formData.priorWarnings,
        expectations: formData.expectations,
        consequences: formData.consequences,
        signature_drawn: formData.signatureDrawn,
        pdf_en_base64: enBase64 || null,
        pdf_es_base64: null,
      });
      // RETURNING gives the saved row back; an empty result means nothing was written.
      if (Array.isArray(saved) && saved.length === 0) {
        throw new Error('The database did not accept the form (are you signed in?).');
      }
    } catch (err) {
      console.error('Submission failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(`The form was NOT saved and nothing was emailed. ${msg} Please try again; if it keeps failing, send a screenshot of this message to Saul.`);
      return; // stay on the page — never go to /success after a failed save
    }

    navigate('/success', { state: { ref } });

    // ── 3. Email in the background: to the signed-in filer; the CC list is in the action ──
    const mail = buildDisciplinaryEmail(formData, ref);
    sendEmailEN({
      subject: mail.subject,
      htmlBody: mail.html,
      managerName: formData.managerName,
      managerEmail: filerEmail,
      attachmentEnName: mail.attachmentName,
      attachmentEnBase64: enBase64,
    }).catch(err => console.error('EN email failed:', err));
  }, [formData, filerEmail, saveSubmission, navigate, sendEmailEN]);

  return (
    <div className="min-h-screen py-0 px-0" style={{ background: '#F5F6FA' }}>
      {/* Navy top header bar */}
      <div className="w-full py-3 px-6 flex items-center justify-between" style={{ backgroundColor: GAF_NAVY }}>
        <div className="flex items-center gap-3">
          <img
            src="https://gafhealthcare.com/assets/images-webp/GAFLogos/2.webp"
            alt="GAF Healthcare"
            className="h-9 w-auto object-contain"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-white uppercase leading-tight">GAF HEALTHCARE SERVICES PANAMA</p>
          </div>
        </div>
        <p className="text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full text-white/90 border border-white/20">
          CONFIDENTIAL
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-4 py-6 px-4">
        {/* Page title */}
        <div className="text-center">
          <h1 className="text-lg font-extrabold tracking-tight font-heading" style={{ color: GAF_RED }}>
            Disciplinary Action Form
          </h1>
        </div>

        {/* Progress Indicator */}
        <StepProgress step={step} />

        {/* Step Card */}
        <Card className="shadow-md border-0">
          <CardContent className="p-6">
            <h2 className="text-base font-extrabold mb-5 font-heading flex items-center gap-2" style={{ color: GAF_NAVY }}>
              {React.createElement(STEPS[step - 1].Icon, { size: 18, style: { color: GAF_RED } })}
              Step {step}: {STEPS[step - 1].label}
            </h2>

            {step === 1 && <Step1EmployeeWarning data={formData} onChange={updateForm} errors={errors} onPriorWarningsSuggestion={handlePriorWarningsSuggestion} onFollowUp={handleFollowUp} />}
            {step === 2 && <Step2ScenarioIncident data={formData} onChange={updateForm} errors={errors} />}
            {step === 3 && <Step3Expectations data={formData} onChange={updateForm} errors={errors} />}
            {step === 4 && (
              <Step4ReviewSubmit
                data={formData}
                onChange={updateForm}
                signatureError={errors.signatureDrawn}
              />
            )}

            {submitError && (
              <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-4 border-t border-gray-100">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={step === 1}
                className="min-w-[90px] rounded-2xl font-bold border-gray-300 transition-all duration-150 hover:scale-105 active:scale-95 hover:shadow-md disabled:hover:scale-100 disabled:hover:shadow-none"
              >
                Back
              </Button>
              {step < 4 ? (
                <Button
                  onClick={handleNext}
                  className="min-w-[90px] text-white font-bold rounded-2xl transition-all duration-150 hover:scale-105 active:scale-95 hover:shadow-lg"
                  style={{ backgroundColor: GAF_RED, borderColor: GAF_RED }}
                >
                  Next →
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="min-w-[120px] text-white font-bold rounded-2xl transition-all duration-150 hover:scale-105 active:scale-95 hover:shadow-lg disabled:hover:scale-100 disabled:hover:shadow-none"
                  style={{ backgroundColor: GAF_RED, borderColor: GAF_RED }}
                >
                  {isSaving ? 'Submitting…' : 'Submit Form'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
