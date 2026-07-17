import mongoose from 'mongoose';

const notifSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  channel: { type: String, enum: ['whatsapp', 'email'], required: true },
  type: String,
  provider: { type: String, enum: ['twilio', 'resend'] },
  providerMessageId: String,
  status: {
    type: String,
    enum: ['queued', 'sent', 'delivered', 'failed', 'bounced'],
    default: 'queued',
  },
  recipient: String,
  ref: { type: String, index: true },
}, { timestamps: true });

notifSchema.index({ providerMessageId: 1 }, { sparse: true });
notifSchema.index({ userId: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notifSchema);
