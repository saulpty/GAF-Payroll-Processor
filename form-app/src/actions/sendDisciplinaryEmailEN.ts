import { action } from '@uibakery/data';

// Sends the English disciplinary action notification to the manager + CC list.
// Attachment: EN PDF only.
function sendDisciplinaryEmailEN() {
  return action('sendDisciplinaryEmailEN', 'HTTP', {
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

export default sendDisciplinaryEmailEN;
