import{Resend}from 'resend';
import twilio from 'twilio';
import config from './config.js';
import { Notification } from './models/notification.js';

const resend = config.resendKey ? new Resend(config.resendKey) : null;
const twilioClient = config.twilio.accountSid
  ? twilio(config.twilio.accountSid, config.twilio.authToken)
  : null;

const STATUS_CB = `${config.appUrl}/webhooks/twilio`;

export async function sendEmailNotification(to, subject, body, userId, txType) {
  if (!resend || !to) return;
  // ponytail: retry 429/5xx × 3, let 4xx fall through
  for (let i = 0; i < 3; i++) {
    try {
      const { data, error } = await resend.emails.send({
        from: 'Bank <notifications@bank.app>', to, subject, html: body,
      });
      if (error) throw error;
      if (userId) {
        Notification.create({
          userId, channel: 'email', type: txType || 'general',
          provider: 'resend', providerMessageId: data?.id,
          status: 'sent', recipient: to,
        }).catch(() => {});
      }
      return;
    } catch (e) {
      const code = e.statusCode || 0;
      if (code >= 400 && code < 500 && code !== 429) break;
      if (i < 2) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  console.error('email notification failed after retries:', to);
}

export async function sendWhatsAppNotification(to, body, templateVars, userId, txType) {
  if (!twilioClient || !to || !config.twilio.whatsAppFrom) return;
  const ref = userId ? `${userId}_${txType || 'general'}_${Date.now()}` : undefined;
  for (let i = 0; i < 3; i++) {
    try {
      const msg = { from: `whatsapp:${config.twilio.whatsAppFrom}`, to: `whatsapp:${to}` };
      if (config.twilio.templateSid && templateVars) {
        msg.contentSid = config.twilio.templateSid;
        msg.contentVariables = JSON.stringify(templateVars);
      } else {
        msg.body = body;
      }
      msg.statusCallback = `${STATUS_CB}?ref=${ref}`;
      const m = await twilioClient.messages.create(msg);
      if (userId) {
        Notification.create({
          userId, channel: 'whatsapp', type: txType || 'general',
          provider: 'twilio', providerMessageId: m.sid,
          status: 'sent', recipient: to, ref,
        }).catch(() => {});
      }
      return;
    } catch (e) {
      // 63018 = rate limited, retry. 63020/63051 = permafail
      if (e.code === 63020 || e.code === 63051) break;
      if (i < 2) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  console.error('whatsapp notification failed after retries:', to);
}
