export type EmailConfiguration = { apiKey: string | undefined; from: string | undefined };
export const emailProviderConnected = (config: EmailConfiguration) => Boolean(config.apiKey && config.from);

export async function sendReminderEmail(config: EmailConfiguration, to: string, subject: string, text: string, idempotencyKey: string) {
  if (!config.apiKey || !config.from) throw new Error('Email provider not connected.');
  // BYOK Resend API key, stored server-side; no credentials enter the browser.
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ from: config.from, to: [to], subject, text }),
  });
  if (!response.ok) {
    // Do not log recipients, response bodies, or credentials.
    console.error('Reminder email provider rejected request', response.status);
    throw new Error('Email could not be sent. Check the email provider and verified sender.');
  }
}