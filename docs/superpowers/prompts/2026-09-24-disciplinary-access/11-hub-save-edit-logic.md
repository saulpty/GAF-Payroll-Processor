# 11 — Hub: the save-an-edit logic and its result panel (part 1 of 2, not wired in yet)

> **Goes into GAF Panama HR Hub** (the Hub), not the Disciplinary Actions Form.
> Run after 10: it uses `downloadPdf.ts`, `render.ts`, `strings.ts` and the actions from 09.

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

**Only these 2 files may change. No other file may be touched.**

- New: `src/app/pages/disciplinary/useSaveDisciplinaryEdit.ts`
- New: `src/app/pages/disciplinary/EditResultPanel.tsx`

Nothing uses them yet: the Edit button and form come in the next prompt (11b). Do not edit
`ActionDetail.tsx` or any other file. Do not run any action: `updateDisciplinaryAction`
changes live data and `sendDisciplinaryUpdatedEmail` sends real email.

## Why

When Tim or Saul saves an edit, four things happen in this order:

1. **Build the new PDF in the browser** from the edited values (`buildDisciplinaryPdfBase64`).
   If that fails, nothing is saved.
2. **Save** with `updateDisciplinaryAction`. The database checks that the signed-in person is
   in `disciplinary_admins`. **No row back means "not allowed"**: the message reads
   "Not allowed — only Tim and Saul can edit." and nothing was saved.
3. **Email** the new PDF with `sendDisciplinaryUpdatedEmail`: To the manager who filed it,
   CC Saul, Tim and Marcela, subject starting "UPDATED — ".
4. **Show the result**: "Saved — updated PDF emailed to Leah Kessler", with a
   **Download updated PDF** button and **Done**. If the email failed, the save still stands:
   the panel says the email failed and offers **Retry email**. If the warning has no manager
   email, it says nothing was emailed.

The list reloads when the person clicks **Done**, not straight after saving. Reloading shows
the page's loading spinner, which would remove this panel and its download button before
anyone could click it.

Dates are `'YYYY-MM-DD'` strings. "Today" is `toLocalYMD(new Date())` from
`@/app/lib/classificationEngine`, never `toISOString().slice(0, 10)`.

The code below is final. **Copy it exactly, character for character.** The `\u2014` sequences
(one in each file) are an em dash written as an escape on purpose: keep them as the six
characters `\u2014`.

## 1. New file `src/app/pages/disciplinary/useSaveDisciplinaryEdit.ts` (verbatim)

```ts
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
        setError('Not allowed \u2014 only Tim and Saul can edit.');
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
```

## 2. New file `src/app/pages/disciplinary/EditResultPanel.tsx` (verbatim)

```tsx
// What the editor sees after a successful save: the email outcome, the new PDF
// to download, and Done (which closes the editor and reloads the list). An
// email failure keeps the save and offers Retry email.
import { CheckCircle2, AlertTriangle, FileDown, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SaveResult } from './useSaveDisciplinaryEdit';
import { downloadBase64Pdf } from './downloadPdf';

interface Props {
  result: SaveResult;
  sending: boolean;
  onRetry: () => void;
  onDone: () => void;
}

export default function EditResultPanel({ result, sending, onRetry, onDone }: Props) {
  const ok = result.email === 'sent';
  const text = ok
    ? `Saved \u2014 updated PDF emailed to ${result.managerName}`
    : result.email === 'no-address'
      ? 'Saved. No manager email is on file for this warning, so nothing was emailed. Download the PDF below.'
      : `Saved, but the email to ${result.managerName} failed: ${result.emailError ?? 'unknown error'}`;

  return (
    <div className={`mx-4 my-4 rounded-lg border px-4 py-3 ${ok ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
      <div className={`flex items-start gap-2 text-[13px] ${ok ? 'text-emerald-800' : 'text-amber-800'}`}>
        {ok
          ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
        <span>{text}</span>
      </div>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-[12px]"
          onClick={() => downloadBase64Pdf(result.pdf, result.filename)}
        >
          <FileDown className="w-3.5 h-3.5 mr-1" />Download updated PDF
        </Button>
        {result.email === 'failed' && (
          <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={onRetry} disabled={sending}>
            {sending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              : <RotateCcw className="w-3.5 h-3.5 mr-1" />}
            Retry email
          </Button>
        )}
        <Button size="sm" className="h-8 text-[12px]" onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}
```

## Acceptance

1. `git status` would show exactly these 2 new files.
2. Every identifier used in each file is imported; TypeScript accepts both files.
3. `useSaveDisciplinaryEdit.ts` calls `buildDisciplinaryPdfBase64` **before**
   `update(...)`, and `sendEmail` only **after** a row came back.
4. The `update(...)` params are flat (no `params:` wrapper), `evidenceTypes` is passed as
   `JSON.stringify(...)`, and empty `revaluationDate` / `finalOutcome` / `scenario` are
   sent as `null`.
5. The app still builds and `/disciplinary` still loads exactly as after prompt 10.

## Report back

1. Both file paths and their sizes in bytes.
2. Anything you could not copy exactly, and why.

---

## Operator notes (Claude, not UIB)

Byte-compare both files against the code blocks (sizes: useSaveDisciplinaryEdit.ts
5546, EditResultPanel.tsx 2287 bytes).
