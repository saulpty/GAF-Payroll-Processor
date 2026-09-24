// Disciplinary PDF: the drawing. A copy of buildPdf() from the form app's
// generatePdf.ts (GAF Disciplinary Actions Form), English only, base64 only.
// Same geometry, colours and order, so the Hub's rebuilt PDF matches the one
// the manager filed. Pure: no React. The words live in ./strings.ts.
import { jsPDF } from 'jspdf';
import { buildPdfStrings, evidenceList, ymd } from './strings';
import type { PdfRow, PdfStrings } from './strings';

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

// Page geometry (Letter = 216 x 279 mm)
const PAGE_W = 216;
const PAGE_H = 279;
const MARGIN_L = 14;
const MARGIN_R = 14;
const MARGIN_T = 12;
const MARGIN_B = 16;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;
const FOOTER_H = 8;
const MAX_Y = PAGE_H - MARGIN_B - FOOTER_H;

type Doc = jsPDF;
type Footer = (d: Doc, pg: number) => void;

function setColor(doc: Doc, hex: string, target: 'fill' | 'draw' | 'text') {
  const [r, g, b] = hexToRgb(hex);
  if (target === 'fill') doc.setFillColor(r, g, b);
  else if (target === 'draw') doc.setDrawColor(r, g, b);
  else doc.setTextColor(r, g, b);
}

function ensureSpace(doc: Doc, y: number, needed: number, drawFooter: Footer, pageNum: { n: number }): number {
  if (y + needed > MAX_Y) {
    drawFooter(doc, pageNum.n);
    doc.addPage();
    pageNum.n += 1;
    return MARGIN_T;
  }
  return y;
}

function wrappedText(doc: Doc, text: string, x: number, y: number, maxW: number, lineH: number,
  drawFooter: Footer, pageNum: { n: number }): number {
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

function labeledBlock(doc: Doc, label: string, value: string, x: number, y: number,
  drawFooter: Footer, pageNum: { n: number }): number {
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

function drawPdf(row: PdfRow, s: PdfStrings): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageNum = { n: 1 };
  const drawFooter: Footer = (d) => {
    d.setDrawColor(200, 200, 200);
    d.setLineWidth(0.3);
    d.line(MARGIN_L, PAGE_H - MARGIN_B - 4, PAGE_W - MARGIN_R, PAGE_H - MARGIN_B - 4);
    d.setFont('helvetica', 'normal');
    d.setFontSize(6.5);
    setColor(d, '#999999', 'text');
    d.text(s.footerText, PAGE_W / 2, PAGE_H - MARGIN_B - 1, { align: 'center', maxWidth: CONTENT_W });
  };

  let y = MARGIN_T;

  // HEADER
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
  doc.text(`Ref: ${row.ref}`, rightX, y + 8.5, { align: 'right' });
  doc.text(`${s.dateLabel}: ${ymd(row.document_date)}`, rightX, y + 12.5, { align: 'right' });

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

  // META GRID
  const cols = 3;
  const cellW = CONTENT_W / cols;
  const cellH = 11;
  const metaData: [string, string][] = [
    [s.metaEmployee, row.employee_name ?? ''],
    [s.metaRole, row.employee_role ?? ''],
    [s.metaBranch, row.employee_branch ?? ''],
    [s.metaSupervisor, row.manager_name ?? ''],
    [s.metaSupEmail, row.manager_email ?? ''],
    [s.metaRevalDate, ymd(row.revaluation_date)],
  ];
  for (let i = 0; i < metaData.length; i++) {
    const cx = MARGIN_L + (i % cols) * cellW;
    const cy = y + Math.floor(i / cols) * (cellH + 1);
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

  // WARNING BOX
  y = ensureSpace(doc, y, 16, drawFooter, pageNum);
  const warnH = 14;
  setColor(doc, RED_HEX, 'draw');
  doc.setLineWidth(0.8);
  doc.roundedRect(MARGIN_L, y, CONTENT_W, warnH, 1.5, 1.5, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  setColor(doc, RED_HEX, 'text');
  doc.text(s.warnLevelLabel, MARGIN_L + 4, y + 4.5);
  doc.setFontSize(12);
  doc.text(s.warningDisplay, MARGIN_L + 4, y + 11);
  y += warnH + 3;

  // SITUATION TYPE
  y = ensureSpace(doc, y, 12, drawFooter, pageNum);
  y = sectionHeading(doc, s.situationTypeHeading, MARGIN_L, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setColor(doc, '#111111', 'text');
  y = wrappedText(doc, s.scenarioValue, MARGIN_L, y, CONTENT_W, 4.5, drawFooter, pageNum);
  y += 2;

  // INCIDENT DOCUMENTATION
  y = ensureSpace(doc, y, 12, drawFooter, pageNum);
  y = sectionHeading(doc, s.incidentHeading, MARGIN_L, y);
  y = labeledBlock(doc, s.incLabel0, s.incValue0, MARGIN_L, y, drawFooter, pageNum);
  y = labeledBlock(doc, s.incLabel1, s.incValue1, MARGIN_L, y, drawFooter, pageNum);
  y = labeledBlock(doc, s.incLabel2, s.incValue2, MARGIN_L, y, drawFooter, pageNum);
  y = labeledBlock(doc, s.incLabel3, s.incValue3, MARGIN_L, y, drawFooter, pageNum);
  y = labeledBlock(doc, s.evidenceReviewedLabel, evidenceList(row.evidence_types).join(', '), MARGIN_L, y, drawFooter, pageNum);
  y = labeledBlock(doc, s.evidenceDescLabel, s.evidenceDescValue, MARGIN_L, y, drawFooter, pageNum);
  y = labeledBlock(doc, s.priorWarnLabel, s.priorWarnValue, MARGIN_L, y, drawFooter, pageNum);

  // CORRECTIVE ACTION & EXPECTATIONS
  y = ensureSpace(doc, y, 12, drawFooter, pageNum);
  y = sectionHeading(doc, s.correctiveHeading, MARGIN_L, y);
  y = labeledBlock(doc, s.correctiveLabel, s.correctiveValue, MARGIN_L, y, drawFooter, pageNum);
  if (s.showFinalOutcome && s.finalOutcomeValue) {
    y = labeledBlock(doc, s.finalOutcomeLabel, s.finalOutcomeValue, MARGIN_L, y, drawFooter, pageNum);
  }

  // NOTICE BOX
  const noticeLines = doc.setFontSize(8).splitTextToSize(s.noticeText, CONTENT_W - 8) as string[];
  const noticeH = noticeLines.length * 4.5 + 8;
  y = ensureSpace(doc, y + 2, noticeH + 4, drawFooter, pageNum);
  setColor(doc, AMBER_BG_HEX, 'fill');
  setColor(doc, AMBER_BORDER_HEX, 'draw');
  doc.setLineWidth(0.6);
  doc.roundedRect(MARGIN_L, y, CONTENT_W, noticeH, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(146, 64, 14);
  doc.text(noticeLines, MARGIN_L + 4, y + 5.5, { lineHeightFactor: 1.4 });
  y += noticeH + 4;

  y = labeledBlock(doc, s.consequencesLabel, s.consequencesValue, MARGIN_L, y, drawFooter, pageNum);

  // SIGNATURES
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
  doc.text(row.employee_name ?? '', MARGIN_L, sigLineY + 4.5);
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
  // 'data:application/pdf;filename=...;base64,<b64>' -> keep only <b64>
  const dataUri = doc.output('datauristring');
  return dataUri.split(',')[1] ?? '';
}

/** Builds the English disciplinary PDF for one row and returns its bytes as base64 (no download). */
export function buildDisciplinaryPdfBase64(row: PdfRow): string {
  return drawPdf(row, buildPdfStrings(row));
}
