const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

export type BrevoRecipient = {
  email: string;
  name?: string | null;
};

export type SendBrevoEmailOptions = {
  to: BrevoRecipient[];
  subject: string;
  params?: Record<string, unknown>;
  htmlContent?: string;
  textContent?: string;
};

const normalizeRecipients = (recipients: BrevoRecipient[] = []) =>
  recipients
    .filter((recipient) => recipient?.email)
    .map((recipient) => ({
      email: recipient.email,
      name: recipient.name ?? undefined,
    }));

export const sendBrevoTransactionalEmail = async (options: SendBrevoEmailOptions) => {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL');
  const senderName = Deno.env.get('BREVO_SENDER_NAME') || 'Urede Notificações';
  const templateIdRaw = Deno.env.get('BREVO_TEMPLATE_ID');
  const templateId = templateIdRaw ? Number(templateIdRaw) : null;

  const to = normalizeRecipients(options.to);
  if (!apiKey || !senderEmail || to.length === 0) {
    console.warn('[brevo] envio abortado: credenciais ou destinatários ausentes');
    return;
  }

  const body: Record<string, unknown> = {
    sender: {
      email: senderEmail,
      name: senderName,
    },
    to,
  };

  if (templateId && Number.isFinite(templateId)) {
    body.templateId = templateId;
    body.params = {
      subject: options.subject,
      ...options.params,
    };
  } else {
    body.subject = options.subject;
    body.htmlContent = options.htmlContent || '<p></p>';
    body.textContent = options.textContent || '';
  }

  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      console.warn('[brevo] envio falhou', response.status, details);
    }
  } catch (error) {
    console.warn('[brevo] erro inesperado', error);
  }
};
