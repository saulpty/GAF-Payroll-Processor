import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutateAction } from '@uibakery/data';
import { UserCheck, FileText, Target, ClipboardCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import saveSubmissionAction from '@/actions/saveSubmission';
import sendDisciplinaryEmailENAction from '@/actions/sendDisciplinaryEmailEN';
import { DisciplinaryFormData, INITIAL_FORM, EvidenceType, EVIDENCE_OPTIONS } from '@/app/utils/disciplinaryFormData';
import { PriorAction } from '@/app/components/PriorActionsPanel';
import { generateDisciplinaryPdfENBase64 } from '@/app/utils/generatePdf';
import Step1EmployeeWarning from '@/app/pages/wizard/Step1EmployeeWarning';
import Step2ScenarioIncident from '@/app/pages/wizard/Step2ScenarioIncident';
import Step3Expectations from '@/app/pages/wizard/Step3Expectations';
import Step4ReviewSubmit from '@/app/pages/wizard/Step4ReviewSubmit';

const GAF_RED = '#E52020';
const GAF_NAVY = '#1C2340';

const STEPS = [
  { num: 1, label: 'Employee & Warning', Icon: UserCheck },
  { num: 2, label: 'Scenario & Incident', Icon: FileText },
  { num: 3, label: 'Expectations', Icon: Target },
  { num: 4, label: 'Review & Submit', Icon: ClipboardCheck },
];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function OfferLetterForm() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<DisciplinaryFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveSubmission, isSaving] = useMutateAction(saveSubmissionAction);
  const [sendEmailEN] = useMutateAction(sendDisciplinaryEmailENAction);
  // Track whether manager has manually typed in priorWarnings (so auto-fill doesn't overwrite)
  const [priorWarningsTouched, setPriorWarningsTouched] = useState(false);

  const updateForm = useCallback((updates: Partial<DisciplinaryFormData>) => {
    if ('priorWarnings' in updates) setPriorWarningsTouched(true);
    setFormData(prev => ({ ...prev, ...updates }));
    // clear errors for updated fields
    setErrors(prev => {
      const next = { ...prev };
      Object.keys(updates).forEach(k => delete next[k]);
      return next;
    });
  }, []);

  // Called by Step1 when prior history is loaded for selected employee
  const handlePriorWarningsSuggestion = useCallback((suggested: string) => {
    if (!priorWarningsTouched) {
      setFormData(prev => ({ ...prev, priorWarnings: suggested }));
    }
  }, [priorWarningsTouched]);

  // Called when manager clicks "Follow up" on a prior action card
  const handleFollowUp = useCallback((prior: PriorAction) => {
    const today = new Date().toISOString().split('T')[0];
    const happened = prior.q_happened ?? '';
    // Format the prior document_date as a clean readable string
    const priorDateDisplay = prior.document_date
      ? new Date(prior.document_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
      : prior.document_date;
    const priorWarningsRef = `Follow-up to ${prior.warning_level} issued ${priorDateDisplay} (${prior.scenario}): ${happened.slice(0, 160)}${happened.length > 160 ? '…' : ''}`;

    setFormData(prev => ({
      ...prev,
      // Copy incident details from prior action
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
      // Copy manager from prior action (so Step 1 is fully pre-filled)
      managerName: prior.manager_name ?? prev.managerName,
      managerEmail: prior.manager_email ?? prev.managerEmail,
      // Keep employee unchanged
      employeeName: prev.employeeName,
      employeeRole: prev.employeeRole,
      employeeBranch: prev.employeeBranch,
      // Reset fields that must be re-chosen
      warningLevel: '',
      finalOutcome: '',
      documentDate: today,
      revaluationDate: '',
      // Prior warnings reference
      priorWarnings: priorWarningsRef,
    }));
    // Mark priorWarnings as touched so auto-summary doesn't overwrite
    setPriorWarningsTouched(true);
    // Clear errors
    setErrors({});
  }, []);

  const validateStep = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!formData.managerName.trim()) e.managerName = 'Manager name is required';
      if (!formData.managerEmail.trim()) e.managerEmail = 'Manager email is required';
      else if (!isValidEmail(formData.managerEmail)) e.managerEmail = 'Enter a valid email';
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
    const ref = `GAF-DA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const pdfData = { ...formData, ref };

    try {
      // ── 1. Generate EN PDF before DB save ────────────────────────────────
      let enBase64 = '';
      try {
        enBase64 = await generateDisciplinaryPdfENBase64(pdfData);
      } catch (err) {
        console.error('EN PDF generation failed:', err);
      }

      // ── 2. Save to DB (with PDF base64) ──────────────────────────────────
      await saveSubmission({
        ref,
        manager_name: formData.managerName,
        manager_email: formData.managerEmail,
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

      // Navigate after DB save succeeds
      navigate('/success', { state: { ref } });

      // ── 3. Send email in background ───────────────────────────────────────
      const enFilename = `GAF_Disciplinary_Action_EN_${ref}.pdf`;

      const enHtml = `<p>Dear ${formData.managerName},</p><p>A disciplinary action form has been submitted for employee <strong>${formData.employeeName}</strong>.</p><ul><li><strong>Reference:</strong> ${ref}</li><li><strong>Warning Level:</strong> ${formData.warningLevel}</li><li><strong>Document Date:</strong> ${formData.documentDate}</li><li><strong>Re-evaluation Date:</strong> ${formData.revaluationDate}</li></ul><p>Please find the disciplinary action document attached as a PDF.</p><p>GAF Healthcare Services Panama</p>`;

      sendEmailEN({
        subject: `Disciplinary Action - ${formData.employeeName} - ${formData.documentDate}`,
        htmlBody: enHtml,
        managerName: formData.managerName,
        managerEmail: formData.managerEmail,
        attachmentEnName: enFilename,
        attachmentEnBase64: enBase64,
      }).catch(err => console.error('EN email failed:', err));

    } catch (err) {
      console.error('Submission failed:', err);
    }
  }, [formData, saveSubmission, navigate, sendEmailEN]);

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
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const done = step > s.num;
            const active = step === s.num;
            return (
              <React.Fragment key={s.num}>
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                      done
                        ? 'text-white'
                        : active
                        ? 'bg-white'
                        : 'border-gray-300 bg-white text-gray-400'
                    }`}
                    style={
                      done
                        ? { borderColor: GAF_RED, backgroundColor: GAF_RED }
                        : active
                        ? { borderColor: GAF_RED, color: GAF_RED }
                        : {}
                    }
                  >
                    {done ? '✓' : React.createElement(s.Icon, { size: 14 })}
                  </div>
                  <span
                    className={`text-xs text-center hidden sm:block font-sans ${active ? 'font-bold' : done ? 'text-gray-600' : 'text-gray-400'}`}
                    style={active ? { color: GAF_RED } : {}}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className="h-0.5 flex-1 mx-1 transition-colors"
                    style={{ backgroundColor: done ? GAF_RED : '#E5E7EB' }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

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
