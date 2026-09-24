import { action } from '@uibakery/data';

// Emails the rebuilt PDF after a Hub edit: To the manager who filed the
// warning, CC Saul, Tim and Marcela. Same datasource, sender and body shape as
// the form app's sendDisciplinaryEmailEN. The caller builds the subject
// ("UPDATED ...") and the HTML with buildUpdatedEmail() in
// app/lib/disciplinaryPdf/strings.ts.
function sendDisciplinaryUpdatedEmail() {
  return action('sendDisciplinaryUpdatedEmail', 'HTTP', {
    datasourceName: 'Email Passiontocare',
    options: {
      method: 'POST',
      url: '/users/no-reply@passiontocarehc.com/sendMail',
      headers: {
        'Content-Type': 'application/json',
      },
      bodyType: 'object',
      body: `{
        message: {
          subject: {{params.subject}},
          importance: "High",
          body: {
            contentType: "HTML",
            content: {{params.htmlBody}},
          },
          from: {
            emailAddress: {
              address: "hello@gafhealthcare.com",
            },
          },
          toRecipients: [
            {
              emailAddress: {
                name: {{params.managerName}},
                address: {{params.managerEmail}},
              },
            },
          ],
          ccRecipients: [
            { emailAddress: { address: "saul.f@vitasyahc.com" } },
            { emailAddress: { address: "tim.m@vitasyahc.com" } },
            { emailAddress: { address: "marcela.g@vitasyahc.com" } },
          ],
          attachments: [
            {
              "@odata.type": "#microsoft.graph.fileAttachment",
              name: {{params.attachmentEnName}},
              contentType: "application/pdf",
              contentBytes: {{params.attachmentEnBase64}},
            },
          ],
        },
        saveToSentItems: true,
      }`,
    },
  });
}

export default sendDisciplinaryUpdatedEmail;
