// Save flow for a Hub edit of one disciplinary action (Tim and Saul only):
// 1. build the new PDF in the browser from the edited values,
// 2. run updateDisciplinaryAction (0 rows back = not allowed; nothing saved),
// 3. email the new PDF to the filing manager, CC Saul, Tim and Marcela.
// An email failure never undoes the save: the result says so and offers Retry.
// Dates are 'YYYY-MM-DD' strings; "today" is toLocalYMD(new Date()).
import { useState } from 'react';
import { useMutateAction } from '@uibakery/data';
import updateDisciplinaryActionAction from '@/actions/updateDisciplinaryAction';
import sendDisciplinaryUpdatedEmailAction from '@/actions/sendDisciplinaryUpdatedEmail';
import { buildDisciplinaryPdfBase64 } from '@/app/lib/disciplinaryPdf/render';
import { buildUpdatedEmail, pdfFilename } from '@/app/lib/disciplinaryPdf/strings';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import { useViewer } from '@/app/context/ViewerContext';
import type { DisciplinaryRow } from '@/app/lib/disciplinary';

export interface EditValues {
  document_date: string;
  revaluation_date: string;
  warning_level: string;
  final_outcome: string;
  scenario: string;
  q_expected: string;
  q_happened: string;
  q_when: string;
  q_impact: string;
  evidence_types: string[];
  evidence_description: string;
  prior_warnings: string;
  expectations: string;
  consequences: string;
  employee_role: string;
  employee_branch: string;
}

export interface SaveResult {
  pdf: string;          // base64 of the new PDF, for "Download updated PDF"
  filename: string;
  managerName: string;  // who the email went (or should have gone) to
  email: 'sent' | 'failed' | 'no-address';
  emailError: string | null;
}

type Saved = {
  id: number;
  ref: string;
  manager_email: string | null;
  manager_name: string | null;
  employee_name: string;
};

function message(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export function useSaveDisciplinaryEdit(action: DisciplinaryRow) {
  const { realEmail } = useViewer();
  const [update] = useMutateAction(updateDisciplinaryActionAction);
  const [sendEmail] = useMutateAction(sendDisciplinaryUpdatedEmailAction);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [mail, setMail] = useState<Record<string, string> | null>(null);

  async function send(args: Record<string, string>): Promise<string | null> {
    try {
      await sendEmail(args);
      return null;
    } catch (e: unknown) {
      return message(e, 'The email could not be sent.');
    }
  }

  async function save(v: EditValues): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      const edited: DisciplinaryRow = {
        ...action,
        ...v,
        revaluation_date: v.revaluation_date || null,
        final_outcome: v.final_outcome || null,
        scenario: v.scenario || null,
      };
      let pdf = '';
      try {
        pdf = buildDisciplinaryPdfBase64(edited);
      } catch {
        pdf = '';
      }
      if (!pdf) {
        setError("Couldn't build the PDF. Nothing was saved.");
        return;
      }

      const res = await update({
        id: action.id,
        documentDate: v.document_date,
        revaluationDate: v.revaluation_date || null,
        warningLevel: v.warning_level,
        finalOutcome: v.final_outcome || null,
        scenario: v.scenario || null,
        qExpected: v.q_expected,
        qHappened: v.q_happened,
        qWhen: v.q_when,
        qImpact: v.q_impact,
        evidenceTypes: JSON.stringify(v.evidence_types),
        evidenceDescription: v.evidence_description,
        priorWarnings: v.prior_warnings,
        expectations: v.expectations,
        consequences: v.consequences,
        employeeRole: v.employee_role,
        employeeBranch: v.employee_branch,
        pdf,
      });
      const saved = (Array.isArray(res) ? res[0] : null) as Saved | null;
      if (!saved) {
        setError('Not saved \u2014 only Tim and Saul can edit, and a deleted warning cannot be edited. Reload the page and try again.');
        return;
      }

      const filename = pdfFilename(action.ref);
      const managerName = saved.manager_name || saved.manager_email || 'the manager';
      if (!saved.manager_email) {
        setResult({ pdf, filename, managerName, email: 'no-address', emailError: null });
        return;
      }
      const { subject, html } = buildUpdatedEmail(
        { ...edited, manager_name: saved.manager_name },
        realEmail,
        toLocalYMD(new Date()),
      );
      const args = {
        subject,
        htmlBody: html,
        managerName: saved.manager_name ?? '',
        managerEmail: saved.manager_email,
        attachmentEnName: filename,
        attachmentEnBase64: pdf,
      };
      setMail(args);
      const emailError = await send(args);
      setResult({ pdf, filename, managerName, email: emailError ? 'failed' : 'sent', emailError });
    } catch (e: unknown) {
      setError(`Save failed: ${message(e, 'please try again.')}`);
    } finally {
      setSaving(false);
    }
  }

  async function retryEmail(): Promise<void> {
    if (!mail || !result) return;
    setSending(true);
    const emailError = await send(mail);
    setResult({ ...result, email: emailError ? 'failed' : 'sent', emailError });
    setSending(false);
  }

  return { save, retryEmail, saving, sending, error, result };
}
