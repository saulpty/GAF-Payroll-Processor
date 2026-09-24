# Requirements

## Summary
A digital GA Job Offer Letter form application for Passion to Care, LLC that mirrors the official state PDF document. HR staff or new hires fill in their name, pay rate, employee signature, and date of signing through an interactive web form. On submission the app fills the original fillable PDF (mapping each field to its exact PDF coordinate), triggers a browser download, stores the submission in a hosted PostgreSQL database, and navigates to a success/confirmation page.

## Use cases

- Fill Out Offer Letter Form
  1) User opens the app and sees a single-page form rendered from the PDF field mapping
  2) The form displays the static offer letter text (Payroll, Work Hours, Health Insurance, Company Equipment Agreement, Employment Terms & Conditions, Acceptance of Offer) as read-only context
  3) User fills in: Employee Name (maps to PDF field `name`), Pay Rate (maps to PDF field `payrate`)
  4) User draws their signature in a bounded signature pad (maps to PDF field `signature`, constrained to 150×22 pt area)
  5) User enters Date of Signing (maps to PDF field `Text4`)
  6) Required-field validation runs inline before submission; errors shown under each field
  7) A read-only summary of all entered values is shown above the submit button
  8) User clicks "Generate & Download PDF" — the app fills the original PDF with mapped values, embeds the signature image inside the signature field bounds, and triggers a browser download
  9) The submission (name, pay_rate, date_of_signing, signature as base64, created_at) is saved to the `offer_letter_submissions` table in GA Offer Letter DB
  10) User is navigated to the Success page

- Success Page
  1) A confirmation message is displayed: "Your offer letter has been generated and downloaded"
  2) "Fill Out Another Form" button resets all state and returns to the form
  3) "Download PDF Again" button re-triggers the same PDF generation and download using the stored submission data from the current session

## Plan

### Fill Out Offer Letter Form

1. [x] Create the `offer_letter_submissions` table in GA Offer Letter DB via SQL migration with columns: `id` (serial PK), `employee_name` (text), `pay_rate` (text), `date_of_signing` (date), `signature_base64` (text), `created_at` (timestamptz default now())
2. [x] Seed 3 sample rows in `offer_letter_submissions` with realistic mock data (names, pay rates, dates)
3. [x] Extract the header logo from the PDF (`x0=70.6, top=19, w=448.9, h=59.2`) using pdfplumber/pypdfium2, convert to base64 PNG, and store it as a constant `LOGO_B64` in the app code
4. [x] Build a single-page `OfferLetterForm` component that renders the full static offer letter text as styled read-only sections matching the PDF layout (Payroll, Work Hours, Health Insurance, Company Equipment Agreement, Employment Terms & Conditions, Acceptance of Offer)
5. [x] Add form fields inline within the static text exactly where they appear in the PDF:
   - **Employee Name** text input (replaces blank after "I, " in Company Equipment Agreement section) — required
   - **Pay Rate** text input (replaces "________" after "• Pay Rate:") — required
6. [x] Add a **Signature Pad** section labeled "Employee Signature:" using a canvas-based drawable signature component; constrain the drawable area width/height to match PDF field bounds (150×22 pt equivalent in pixels); output as PNG base64
7. [x] Add a **Date of Signing** date picker input below the signature pad — required
8. [x] Add a read-only **Summary** panel that shows all entered values when the form is valid, displayed above the submit button
9. [x] Add inline validation: show red error messages under each required field when empty on submit attempt
10. [x] On "Generate & Download PDF" click: use pdf-lib to load the original `11652000803_GA_Job_Offer.pdf` (embedded as base64 in app), fill the 4 AcroForm fields (`name`, `payrate`, `signature` as embedded image within its exact Rect bounds [178.69, 90.58, 328.69, 112.58], `Text4` for date), flatten, and trigger browser download as `GA_Offer_Letter_<name>.pdf`
11. [x] On successful PDF generation, save the submission to `offer_letter_submissions` via a SQL INSERT action using the GA Offer Letter DB datasource
12. [x] After saving, navigate to the Success page and pass submission data via app state for "Download Again" functionality

### Success Page

1. [x] Create a `SuccessPage` component with a centered confirmation card showing a checkmark icon and message: "Your offer letter has been generated and downloaded successfully!"
2. [x] Display a summary of the submitted data (employee name, pay rate, date of signing)
3. [x] Add a "Fill Out Another Form" button that clears all form state and navigates back to the form page
4. [] Add a "Download PDF Again" button that re-runs the same PDF fill/download function using the submission data stored in app state from the current session
