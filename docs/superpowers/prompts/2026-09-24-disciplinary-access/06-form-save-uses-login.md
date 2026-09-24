# 06 (F5) — Save and email use the signed-in filer; a failed save is shown, not hidden

> **⚠ This prompt goes into the 'GAF Disciplinary Actions Form' app (PC3PsXDDa9), NOT the GAF Panama HR Hub. Check the project name in the builder before pasting.**

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

**Only these four files may be created or changed. No other file may be touched.**

- `src/actions/saveSubmission.ts`
- `src/app/pages/OfferLetterForm.tsx`
- `src/app/utils/buildDisciplinaryEmail.ts` — NEW
- `src/app/pages/wizard/StepProgress.tsx` — NEW

Do not touch `sendDisciplinaryEmailEN.ts` (its CC list stays), `generatePdf.ts`, any wizard
step, `useFilerScope.ts`, `filerScope.ts`, any migration, or anything under `components/ui/`.

## Why

1. `saveSubmission` writes `manager_email` from a browser param, so a warning can be filed
   under someone else's email. It must come from the login, on the server.
2. The page still validates the manager boxes that the last prompt removed.
3. If the save fails, the page only `console.error`s — and a save error after `navigate`
   is invisible. The manager believes it was filed. It must say so and stay on the page.
4. `OfferLetterForm.tsx` is 15.4 KB, over the 15 KB limit. Two pieces move out.

## 1. `src/actions/saveSubmission.ts`

Replace the whole `query` with the one below. Changes: `VALUES (…)` becomes `SELECT … WHERE`
so nothing is written when nobody is signed in; `manager_email` comes from
`{{ user.email }}` (the `manager_email` param is gone); `RETURNING` adds `manager_name,
manager_email`. Every other column and value is unchanged.

```sql
      INSERT INTO disciplinary_actions (
        ref, manager_name, manager_email,
        employee_name, employee_role, employee_branch,
        document_date, revaluation_date,
        warning_level, final_outcome, scenario,
        q_expected, q_happened, q_when, q_impact,
        evidence_types, evidence_description,
        prior_warnings, expectations, consequences,
        signature_drawn,
        pdf_en_base64, pdf_es_base64
      )
      SELECT
        {{params.ref}}, {{params.manager_name}}, lower(btrim({{ user.email }}::text)),
        {{params.employee_name}}, {{params.employee_role}}, {{params.employee_branch}},
        {{params.document_date}}::date, {{params.revaluation_date}}::date,
        {{params.warning_level}}, {{params.final_outcome}}, {{params.scenario}},
        {{params.q_expected}}, {{params.q_happened}}, {{params.q_when}}, {{params.q_impact}},
        ARRAY[{{params.evidence_types}}]::text[], {{params.evidence_description}},
        {{params.prior_warnings}}, {{params.expectations}}, {{params.consequences}},
        {{params.signature_drawn}},
        {{params.pdf_en_base64}}, {{params.pdf_es_base64}}
      WHERE btrim(coalesce({{ user.email }}::text, '')) <> ''
      RETURNING id, ref, employee_name, manager_name, manager_email, submitted_at;
```

No `{{params.x}}` or `{{ user.email }}` inside quotes.

## 2. `src/app/utils/buildDisciplinaryEmail.ts` — NEW

Pure (type import only). Move the email text out of `handleSubmit` **unchanged**:

```ts
import type { DisciplinaryFormData } from '@/app/utils/disciplinaryFormData';

export interface DisciplinaryEmail { subject: string; html: string; attachmentName: string; }

export function buildDisciplinaryEmail(data: DisciplinaryFormData, ref: string): DisciplinaryEmail {
  return {
    subject: `Disciplinary Action - ${data.employeeName} - ${data.documentDate}`,
    attachmentName: `GAF_Disciplinary_Action_EN_${ref}.pdf`,
    html: `<p>Dear ${data.managerName},</p><p>A disciplinary action form has been submitted for employee <strong>${data.employeeName}</strong>.</p><ul><li><strong>Reference:</strong> ${ref}</li><li><strong>Warning Level:</strong> ${data.warningLevel}</li><li><strong>Document Date:</strong> ${data.documentDate}</li><li><strong>Re-evaluation Date:</strong> ${data.revaluationDate}</li></ul><p>Please find the disciplinary action document attached as a PDF.</p><p>GAF Healthcare Services Panama</p>`,
  };
}
```

That `html` is today's `enHtml` text exactly, with `formData.` renamed to `data.`.

## 3. `src/app/pages/wizard/StepProgress.tsx` — NEW

Move out of `OfferLetterForm.tsx`, unchanged:
- the `STEPS` array (export it: `export const STEPS = [...]`) and the four lucide icons it uses;
- the `{/* Progress Indicator */}` block (the `<div className="flex items-center justify-between">`
  with `STEPS.map(...)`) as `export default function StepProgress({ step }: { step: number })`.

It needs its own `const GAF_RED = '#E52020';` and `import React from 'react';`.
Markup, classes and styles stay identical — the page must look the same.

## 4. `src/app/pages/OfferLetterForm.tsx`

**Imports:** change `import { useMutateAction } from '@uibakery/data';` to
`import { useLoadAction, useMutateAction } from '@uibakery/data';`. Add
`loadCurrentFilerAction` from `@/actions/loadCurrentFiler`, `buildDisciplinaryEmail` from
`@/app/utils/buildDisciplinaryEmail`, and `StepProgress, { STEPS }` from
`@/app/pages/wizard/StepProgress`. Remove the lucide import and the local `STEPS` array.
Replace the `{/* Progress Indicator */}` block with `<StepProgress step={step} />`.
`STEPS[step - 1]` in the card title keeps working through the import.

**Delete** the `isValidEmail` function.

**Add** under `const [sendEmailEN] = useMutateAction(sendDisciplinaryEmailENAction);`:

```tsx
  // The filer is the signed-in user. The email goes to them; the DB takes it from the login.
  const [filerRows] = useLoadAction(loadCurrentFilerAction, [] as { email: string | null }[], {});
  const filerEmail = ((filerRows as { email: string | null }[])[0]?.email ?? '').trim().toLowerCase();
  const [submitError, setSubmitError] = useState('');
```

**In `validateStep`, `s === 1`, delete these three lines:**

```tsx
      if (!formData.managerName.trim()) e.managerName = 'Manager name is required';
      if (!formData.managerEmail.trim()) e.managerEmail = 'Manager email is required';
      else if (!isValidEmail(formData.managerEmail)) e.managerEmail = 'Enter a valid email';
```

**Replace the whole `handleSubmit`** with:

```tsx
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
```

**Show the error**, directly above `{/* Navigation */}` inside `<CardContent>`:

```tsx
            {submitError && (
              <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}
```

Everything else (steps, `handleFollowUp`, `updateForm`, the header bar, the buttons) stays.

## Acceptance

1. `saveSubmission.ts`: `manager_email` value is `lower(btrim({{ user.email }}::text))`; the
   string `params.manager_email` appears nowhere in `src/`.
2. `OfferLetterForm.tsx` has no `isValidEmail`, no `Manager name is required`, no
   `manager_email:` key, no `toISOString`.
3. The page looks identical (header, progress circles, step titles).
4. **Do not submit a real warning.** Stop before pressing Submit; a human does the one
   end-to-end test. When they do, the saved row's `manager_email` equals the login email, the
   email arrives To the filer with Saul, Tim and Marcela in CC.
5. Byte sizes, each under 15 KB: `OfferLetterForm.tsx` (target ≈ 13.5 KB),
   `StepProgress.tsx`, `buildDisciplinaryEmail.ts`, `saveSubmission.ts`.
6. Lint clean; no runtime error banner.

## Report back

List every file you created, changed or deleted, with the byte size of each. Also say what
`await saveSubmission(...)` returns in this app (an array of rows, or something else), so we
know the empty-result check is aimed right.
