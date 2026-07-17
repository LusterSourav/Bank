import express, { Router } from 'express';
import twilio from 'twilio';
import config from './config.js';
import { Notification } from './models/notification.js';

const router = Router();

// twilio whatsApp status callbacks
router.post('/twilio', express.urlencoded({ extended: false }), (req, res) => {
  const valid = twilio.validateRequest(
    config.twilio.authToken,
    req.headers['x-twilio-signature'],
    // reconstruct the full callback URL twilio hit
    `${req.protocol}://${req.get('host')}${req.originalUrl}`,
    req.body
  );

  if (!valid) return res.sendStatus(401);

  const { MessageSid, MessageStatus, ref } = req.body;

  Notification.findOneAndUpdate(
    { ref },
    { $set: { status: mapStatus(MessageStatus), providerMessageId: MessageSid } },
    { upsert: true, new: true }
  ).catch(e => console.error('notif status update failed', e.message));

  res.sendStatus(200);
});

// resend email status webhooks
router.post('/resend', (req, res) => {
  const svixId = req.headers['svix-id'];
  if (!svixId) return res.sendStatus(401);

  const { type, data } = req.body;

  Notification.findOneAndUpdate(
    { providerMessageId: data.email_id },
    { $set: { status: mapEmailStatus(type) } },
    { new: true }
  ).catch(e => console.error('email status update failed', e.message));

  res.sendStatus(200);
});

function mapStatus(s) {
  const m = {
    queued: 'queued', sent: 'sent', delivered: 'delivered',
    undelivered: 'failed', failed: 'failed', read: 'delivered',
  };
  return m[s] || 'sent';
}

function mapEmailStatus(t) {
  const m = {
    'email.sent': 'sent', 'email.delivered': 'delivered',
    'email.bounced': 'bounced', 'email.complained': 'bounced',
    'email.failed': 'failed',
  };
  return m[t] || 'sent';
}

export default router;
