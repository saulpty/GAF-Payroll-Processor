import type { DisciplinaryFormData } from '@/app/utils/disciplinaryFormData';

export interface DisciplinaryEmail { subject: string; html: string; attachmentName: string; }

export function buildDisciplinaryEmail(data: DisciplinaryFormData, ref: string): DisciplinaryEmail {
  return {
    subject: `Disciplinary Action - ${data.employeeName} - ${data.documentDate}`,
    attachmentName: `GAF_Disciplinary_Action_EN_${ref}.pdf`,
    html: `<p>Dear ${data.managerName},</p><p>A disciplinary action form has been submitted for employee <strong>${data.employeeName}</strong>.</p><ul><li><strong>Reference:</strong> ${ref}</li><li><strong>Warning Level:</strong> ${data.warningLevel}</li><li><strong>Document Date:</strong> ${data.documentDate}</li><li><strong>Re-evaluation Date:</strong> ${data.revaluationDate}</li></ul><p>Please find the disciplinary action document attached as a PDF.</p><p>GAF Healthcare Services Panama</p>`,
  };
}
