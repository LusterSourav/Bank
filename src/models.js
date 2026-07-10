// Mongoose schemas for the three collections: User, Transaction, Beneficiary.
// ponytail: razorpayId is set on tx documents but not declared in the schema.
//           Mongoose strict mode saves it anyway. Declare it explicitly if the
//           schema is ever used for validation-first operations.
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  privyDid: { type: String, unique: true, required: true },
  email: String,
  name: String,
  balance: { type: Number, default: 0 },
  kyc: {
    status: { type: String, enum: ['none', 'pending', 'verified'], default: 'none' },
    verifiedAt: Date,
  },
}, { timestamps: true });

const txSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['deposit', 'send'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'inr' },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  stripeId: String,
  recipient: String,
}, { timestamps: true });

const beneficiarySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  ifsc: String,
  accountNumber: String,
  currency: { type: String, default: 'inr' },
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
export const Transaction = mongoose.model('Transaction', txSchema);
export const Beneficiary = mongoose.model('Beneficiary', beneficiarySchema);
