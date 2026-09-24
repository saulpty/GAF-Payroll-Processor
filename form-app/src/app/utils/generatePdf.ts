import { jsPDF } from 'jspdf';
import { DisciplinaryFormData, SCENARIO_LABELS, ScenarioType } from '@/app/utils/disciplinaryFormData';

// Legacy SubmissionData kept for compatibility
export interface SubmissionData {
  employeeName: string;
  payRate: string;
  dateOfSigning: string;
  signatureBase64: string;
}

export interface PdfSubmissionData extends DisciplinaryFormData {
  ref: string;
}


// ─── Colour constants ─────────────────────────────────────────────────────────
const RED_HEX = '#E52020';
const GRAY_HEX = '#555555';
const LIGHT_GRAY_HEX = '#F0F0F0';
const AMBER_BG_HEX = '#FFFBEB';
const AMBER_BORDER_HEX = '#D97706';
const WHITE_HEX = '#FFFFFF';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// ─── Page geometry (Letter = 216 × 279 mm) ────────────────────────────────────
const PAGE_W = 216;
const PAGE_H = 279;
const MARGIN_L = 14;
const MARGIN_R = 14;
const MARGIN_T = 12;
const MARGIN_B = 16;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;
const FOOTER_H = 8;
const MAX_Y = PAGE_H - MARGIN_B - FOOTER_H;

// ─── jsPDF helpers ──────────────────────────────────────────���─────────────────
type Doc = jsPDF;

function setColor(doc: Doc, hex: string, target: 'fill' | 'draw' | 'text') {
  const [r, g, b] = hexToRgb(hex);
  if (target === 'fill') doc.setFillColor(r, g, b);
  else if (target === 'draw') doc.setDrawColor(r, g, b);
  else doc.setTextColor(r, g, b);
}

function ensureSpace(
  doc: Doc,
  y: number,
  needed: number,
  drawFooter: (d: Doc, pg: number) => void,
  pageNum: { n: number },
): number {
  if (y + needed > MAX_Y) {
    drawFooter(doc, pageNum.n);
    doc.addPage();
    pageNum.n += 1;
    return MARGIN_T;
  }
  return y;
}

function wrappedText(
  doc: Doc,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
  drawFooter: (d: Doc, pg: number) => void,
  pageNum: { n: number },
): number {
  const lines = doc.splitTextToSize(text || '\u2014', maxW) as string[];
  for (const line of lines) {
    y = ensureSpace(doc, y, lineH + 1, drawFooter, pageNum);
    doc.text(line, x, y);
    y += lineH;
  }
  return y;
}

function sectionHeading(doc: Doc, title: string, x: number, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  setColor(doc, RED_HEX, 'text');
  doc.text(title.toUpperCase(), x, y);
  y += 1.5;
  setColor(doc, RED_HEX, 'draw');
  doc.setLineWidth(0.4);
  doc.line(x, y, x + CONTENT_W, y);
  y += 3;
  setColor(doc, '#111111', 'text');
  return y;
}

function labeledBlock(
  doc: Doc,
  label: string,
  value: string,
  x: number,
  y: number,
  drawFooter: (d: Doc, pg: number) => void,
  pageNum: { n: number },
): number {
  y = ensureSpace(doc, y, 8, drawFooter, pageNum);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setColor(doc, GRAY_HEX, 'text');
  doc.text(label, x, y);
  y += 3.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setColor(doc, '#111111', 'text');
  y = wrappedText(doc, value, x, y, CONTENT_W, 4.5, drawFooter, pageNum);
  y += 2;
  return y;
}

// ─── Shared layout builder ────────────────────────────────────────────────────
interface PdfStrings {
  // Header
  formTitle: string;
  confidentialLabel: string;
  dateLabel: string;
  // Meta grid labels
  metaEmployee: string;
  metaRole: string;
  metaBranch: string;
  metaSupervisor: string;
  metaSupEmail: string;
  metaRevalDate: string;
  // Warning box
  warnLevelLabel: string;
  warningDisplay: string;
  // Situation type
  situationTypeHeading: string;
  scenarioValue: string;
  // Incident doc
  incidentHeading: string;
  incLabel0: string;
  incValue0: string;
  incLabel1: string;
  incValue1: string;
  incLabel2: string;
  incValue2: string;
  incLabel3: string;
  incValue3: string;
  evidenceReviewedLabel: string;
  evidenceDescLabel: string;
  evidenceDescValue: string;
  priorWarnLabel: string;
  priorWarnValue: string;
  // Corrective
  correctiveHeading: string;
  correctiveLabel: string;
  correctiveValue: string;
  finalOutcomeLabel: string;
  finalOutcomeValue: string;
  showFinalOutcome: boolean;
  // Notice
  noticeText: string;
  // Consequences
  consequencesLabel: string;
  consequencesValue: string;
  // Signatures
  sigHeading: string;
  sigSubtext: string;
  sigEmployeeRole: string;
  sigManagement: string;
  sigDateLine: string;
  // Footer
  footerText: string;
  // File
  filename: string;
}

// mode: 'download' triggers doc.save(); 'base64' returns the raw base64 string (no download)
function buildPdf(data: PdfSubmissionData, s: PdfStrings, mode: 'download' | 'base64' = 'download'): string | void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageNum = { n: 1 };

  const drawFooter = (d: Doc, _pg: number) => {
    d.setDrawColor(200, 200, 200);
    d.setLineWidth(0.3);
    d.line(MARGIN_L, PAGE_H - MARGIN_B - 4, PAGE_W - MARGIN_R, PAGE_H - MARGIN_B - 4);
    d.setFont('helvetica', 'normal');
    d.setFontSize(6.5);
    setColor(d, '#999999', 'text');
    d.text(s.footerText, PAGE_W / 2, PAGE_H - MARGIN_B - 1, { align: 'center', maxWidth: CONTENT_W });
  };

  let y = MARGIN_T;

  // ── HEADER ──────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  setColor(doc, RED_HEX, 'text');
  doc.text('GAF', MARGIN_L, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setColor(doc, GRAY_HEX, 'text');
  doc.text('HEALTHCARE SERVICES PANAMA', MARGIN_L, y + 12);

  const rightX = PAGE_W - MARGIN_R;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setColor(doc, RED_HEX, 'text');
  doc.text(s.formTitle, rightX, y + 4, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setColor(doc, GRAY_HEX, 'text');
  doc.text(`Ref: ${data.ref}`, rightX, y + 8.5, { align: 'right' });
  doc.text(`${s.dateLabel}: ${data.documentDate}`, rightX, y + 12.5, { align: 'right' });

  const badgeW = 30;
  const badgeH = 4.5;
  const badgeX = rightX - badgeW;
  const badgeY = y + 14.5;
  setColor(doc, RED_HEX, 'fill');
  doc.setLineWidth(0);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  setColor(doc, WHITE_HEX, 'text');
  doc.text(s.confidentialLabel, badgeX + badgeW / 2, badgeY + 3.2, { align: 'center' });

  y += 22;

  setColor(doc, RED_HEX, 'draw');
  doc.setLineWidth(1);
  doc.line(MARGIN_L, y, PAGE_W - MARGIN_R, y);
  y += 5;

  // ── META GRID ───────────────────────────────────────────────────────────────
  const cols = 3;
  const cellW = CONTENT_W / cols;
  const cellH = 11;
  const metaData: [string, string][] = [
    [s.metaEmployee, data.employeeName],
    [s.metaRole, data.employeeRole],
    [s.metaBranch, data.employeeBranch],
    [s.metaSupervisor, data.managerName],
    [s.metaSupEmail, data.managerEmail],
    [s.metaRevalDate, data.revaluationDate],
  ];

  for (let i = 0; i < metaData.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = MARGIN_L + col * cellW;
    const cy = y + row * (cellH + 1);
    setColor(doc, LIGHT_GRAY_HEX, 'fill');
    doc.setLineWidth(0);
    doc.roundedRect(cx, cy, cellW - 1, cellH, 1, 1, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    setColor(doc, GRAY_HEX, 'text');
    doc.text(metaData[i][0], cx + 2, cy + 3.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    setColor(doc, '#111111', 'text');
    const valLines = doc.splitTextToSize(metaData[i][1] || '\u2014', cellW - 4) as string[];
    doc.text(valLines[0] ?? '\u2014', cx + 2, cy + 8);
  }
  y += 2 * (cellH + 1) + 3;

  // ── WARNING BOX ─────────────────────────────────────────────────────────────
  y = ensureSpace(doc, y, 16, drawFooter, pageNum);
  const warnH = 14;
  setColor(doc, RED_HEX, 'draw');
  doc.setLineWidth(0.8);
  doc.roundedRect(MARGIN_L, y, CONTENT_W, warnH, 1.5, 1.5, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  setColor(doc, RED_HEX, 'text');
  doc.text(s.warnLevelLabel, MARGIN_L + 4, y + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  setColor(doc, RED_HEX, 'text');
  doc.text(s.warningDisplay, MARGIN_L + 4, y + 11);
  y += warnH + 3;

  // ── SITUATION TYPE ───────────────────────────────────────────────────────────
  y = ensureSpace(doc, y, 12, drawFooter, pageNum);
  y = sectionHeading(doc, s.situationTypeHeading, MARGIN_L, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setColor(doc, '#111111', 'text');
  y = wrappedText(doc, s.scenarioValue, MARGIN_L, y, CONTENT_W, 4.5, drawFooter, pageNum);
  y += 2;

  // ── INCIDENT DOCUMENTATION ───────────────────────────────────────────────────
  y = ensureSpace(doc, y, 12, drawFooter, pageNum);
  y = sectionHeading(doc, s.incidentHeading, MARGIN_L, y);
  y = labeledBlock(doc, s.incLabel0, s.incValue0, MARGIN_L, y, drawFooter, pageNum);
  y = labeledBlock(doc, s.incLabel1, s.incValue1, MARGIN_L, y, drawFooter, pageNum);
  y = labeledBlock(doc, s.incLabel2, s.incValue2, MARGIN_L, y, drawFooter, pageNum);
  y = labeledBlock(doc, s.incLabel3, s.incValue3, MARGIN_L, y, drawFooter, pageNum);
  y = labeledBlock(doc, s.evidenceReviewedLabel, data.evidenceTypes.join(', '), MARGIN_L, y, drawFooter, pageNum);
  y = labeledBlock(doc, s.evidenceDescLabel, s.evidenceDescValue, MARGIN_L, y, drawFooter, pageNum);
  y = labeledBlock(doc, s.priorWarnLabel, s.priorWarnValue, MARGIN_L, y, drawFooter, pageNum);

  // ── CORRECTIVE ACTION & EXPECTATIONS ────────────────────────────────────────
  y = ensureSpace(doc, y, 12, drawFooter, pageNum);
  y = sectionHeading(doc, s.correctiveHeading, MARGIN_L, y);
  y = labeledBlock(doc, s.correctiveLabel, s.correctiveValue, MARGIN_L, y, drawFooter, pageNum);
  if (s.showFinalOutcome && s.finalOutcomeValue) {
    y = labeledBlock(doc, s.finalOutcomeLabel, s.finalOutcomeValue, MARGIN_L, y, drawFooter, pageNum);
  }

  // ── NOTICE BOX ──────────────────────────────────────────────────────────────
  const noticeLines = doc.setFontSize(8).splitTextToSize(s.noticeText, CONTENT_W - 8) as string[];
  const noticeH = noticeLines.length * 4.5 + 8;
  y = ensureSpace(doc, y + 2, noticeH + 4, drawFooter, pageNum);
  const [abr, abg, abb] = hexToRgb(AMBER_BG_HEX);
  doc.setFillColor(abr, abg, abb);
  const [adr, adg, adb] = hexToRgb(AMBER_BORDER_HEX);
  doc.setDrawColor(adr, adg, adb);
  doc.setLineWidth(0.6);
  doc.roundedRect(MARGIN_L, y, CONTENT_W, noticeH, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(146, 64, 14);
  doc.text(noticeLines, MARGIN_L + 4, y + 5.5, { lineHeightFactor: 1.4 });
  y += noticeH + 4;

  y = labeledBlock(doc, s.consequencesLabel, s.consequencesValue, MARGIN_L, y, drawFooter, pageNum);

  // ── SIGNATURES ───────────────────────────────────────────────────────────────
  y = ensureSpace(doc, y, 40, drawFooter, pageNum);
  y = sectionHeading(doc, s.sigHeading, MARGIN_L, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setColor(doc, GRAY_HEX, 'text');
  doc.text(s.sigSubtext, MARGIN_L, y);
  y += 8;

  const sigColW = (CONTENT_W - 10) / 2;
  const sigLineY = y + 16;

  setColor(doc, '#999999', 'draw');
  doc.setLineWidth(0.4);
  doc.line(MARGIN_L, sigLineY, MARGIN_L + sigColW, sigLineY);
  doc.line(MARGIN_L + sigColW + 10, sigLineY, MARGIN_L + sigColW * 2 + 10, sigLineY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  setColor(doc, '#111111', 'text');
  doc.text(data.employeeName, MARGIN_L, sigLineY + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setColor(doc, GRAY_HEX, 'text');
  doc.text(s.sigEmployeeRole, MARGIN_L, sigLineY + 8.5);
  doc.text(s.sigDateLine, MARGIN_L, sigLineY + 12.5);

  const rx = MARGIN_L + sigColW + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  setColor(doc, '#111111', 'text');
  doc.text('GAF Healthcare Services Panama', rx, sigLineY + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setColor(doc, GRAY_HEX, 'text');
  doc.text(s.sigManagement, rx, sigLineY + 8.5);
  doc.text(s.sigDateLine, rx, sigLineY + 12.5);

  drawFooter(doc, pageNum.n);
  if (mode === 'base64') {
    // output('datauristring') returns 'data:application/pdf;base64,<b64>' — strip prefix
    const dataUri = doc.output('datauristring');
    return dataUri.split(',')[1] ?? '';
  }
  doc.save(s.filename);
}

// ─── English PDF ──────────────────────────────────────────────────────────────
export async function generateAndDownloadDisciplinaryPdf(data: PdfSubmissionData): Promise<void> {
  const scenarioLabels: [string, string, string, string] =
    data.scenario && data.scenario !== ''
      ? SCENARIO_LABELS[data.scenario as Exclude<ScenarioType, ''>]
      : ['Expected behavior', 'What happened', 'When', 'Impact'];

  const warningDisplay = data.warningLevel + (data.finalOutcome ? ` \u2014 ${data.finalOutcome}` : '');

  const s: PdfStrings = {
    formTitle: 'DISCIPLINARY ACTION FORM',
    confidentialLabel: 'CONFIDENTIAL',
    dateLabel: 'Date',
    metaEmployee: 'EMPLOYEE',
    metaRole: 'ROLE',
    metaBranch: 'BRANCH',
    metaSupervisor: 'SUPERVISOR',
    metaSupEmail: 'SUPERVISOR EMAIL',
    metaRevalDate: 'RE-EVALUATION DATE',
    warnLevelLabel: 'DISCIPLINARY ACTION LEVEL',
    warningDisplay,
    situationTypeHeading: 'Situation Type',
    scenarioValue: data.scenario || '\u2014',
    incidentHeading: 'Incident Documentation',
    incLabel0: scenarioLabels[0],
    incValue0: data.qExpected,
    incLabel1: scenarioLabels[1],
    incValue1: data.qHappened,
    incLabel2: scenarioLabels[2],
    incValue2: data.qWhen,
    incLabel3: scenarioLabels[3],
    incValue3: data.qImpact,
    evidenceReviewedLabel: 'Evidence Reviewed',
    evidenceDescLabel: 'Evidence Description',
    evidenceDescValue: data.evidenceDescription,
    priorWarnLabel: 'Prior Warnings or Discussions',
    priorWarnValue: data.priorWarnings,
    correctiveHeading: 'Corrective Action & Expectations',
    correctiveLabel: 'What the employee must correct starting today',
    correctiveValue: data.expectations,
    finalOutcomeLabel: 'Final Outcome',
    finalOutcomeValue: data.finalOutcome,
    showFinalOutcome: !!data.finalOutcome,
    noticeText:
      'The employee is hereby warned that recurrence, failure to correct, or non-compliance with the instructions outlined above may result in further disciplinary action, up to and including suspension or termination of employment, in accordance with the Internal Work Regulations and applicable labor law.',
    consequencesLabel: 'Consequences of Non-compliance',
    consequencesValue: data.consequences,
    sigHeading: 'Signatures & Acknowledgment',
    sigSubtext: 'The employee was heard and had the opportunity to present comments.',
    sigEmployeeRole: 'Employee',
    sigManagement: 'Management',
    sigDateLine: 'Date: ______________________',
    footerText: `The employee's signature does not imply acceptance of fault. It only confirms receipt of the document.  |  cc. Personnel file  |  ${data.ref}  |  ${data.documentDate}`,
    filename: `GAF_Disciplinary_Action_EN_${data.ref}.pdf`,
  };

  buildPdf(data, s);
}

// Returns base64 PDF bytes (no file download)
export async function generateDisciplinaryPdfENBase64(data: PdfSubmissionData): Promise<string> {
  const scenarioLabels: [string, string, string, string] =
    data.scenario && data.scenario !== ''
      ? SCENARIO_LABELS[data.scenario as Exclude<ScenarioType, ''>]
      : ['Expected behavior', 'What happened', 'When', 'Impact'];

  const warningDisplay = data.warningLevel + (data.finalOutcome ? ` \u2014 ${data.finalOutcome}` : '');

  const s: PdfStrings = {
    formTitle: 'DISCIPLINARY ACTION FORM',
    confidentialLabel: 'CONFIDENTIAL',
    dateLabel: 'Date',
    metaEmployee: 'EMPLOYEE',
    metaRole: 'ROLE',
    metaBranch: 'BRANCH',
    metaSupervisor: 'SUPERVISOR',
    metaSupEmail: 'SUPERVISOR EMAIL',
    metaRevalDate: 'RE-EVALUATION DATE',
    warnLevelLabel: 'DISCIPLINARY ACTION LEVEL',
    warningDisplay,
    situationTypeHeading: 'Situation Type',
    scenarioValue: data.scenario || '\u2014',
    incidentHeading: 'Incident Documentation',
    incLabel0: scenarioLabels[0],
    incValue0: data.qExpected,
    incLabel1: scenarioLabels[1],
    incValue1: data.qHappened,
    incLabel2: scenarioLabels[2],
    incValue2: data.qWhen,
    incLabel3: scenarioLabels[3],
    incValue3: data.qImpact,
    evidenceReviewedLabel: 'Evidence Reviewed',
    evidenceDescLabel: 'Evidence Description',
    evidenceDescValue: data.evidenceDescription,
    priorWarnLabel: 'Prior Warnings or Discussions',
    priorWarnValue: data.priorWarnings,
    correctiveHeading: 'Corrective Action & Expectations',
    correctiveLabel: 'What the employee must correct starting today',
    correctiveValue: data.expectations,
    finalOutcomeLabel: 'Final Outcome',
    finalOutcomeValue: data.finalOutcome,
    showFinalOutcome: !!data.finalOutcome,
    noticeText:
      'The employee is hereby warned that recurrence, failure to correct, or non-compliance with the instructions outlined above may result in further disciplinary action, up to and including suspension or termination of employment, in accordance with the Internal Work Regulations and applicable labor law.',
    consequencesLabel: 'Consequences of Non-compliance',
    consequencesValue: data.consequences,
    sigHeading: 'Signatures & Acknowledgment',
    sigSubtext: 'The employee was heard and had the opportunity to present comments.',
    sigEmployeeRole: 'Employee',
    sigManagement: 'Management',
    sigDateLine: 'Date: ______________________',
    footerText: `The employee's signature does not imply acceptance of fault. It only confirms receipt of the document.  |  cc. Personnel file  |  ${data.ref}  |  ${data.documentDate}`,
    filename: `GAF_Disciplinary_Action_EN_${data.ref}.pdf`,
  };

  return (buildPdf(data, s, 'base64') as string) ?? '';
}

// Legacy stub
export async function generateAndDownloadPdf(_data: SubmissionData): Promise<void> {
  console.warn('generateAndDownloadPdf is deprecated; use generateAndDownloadDisciplinaryPdf');
}
