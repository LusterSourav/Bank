// Single-file SPA with state-based screen switching (no router).
// Screens: Login, Dashboard, Deposit, Send, History, Settings, + modals.
// All icons from @bitcoin-design/bitcoin-icons-react/outline only.
// Auth via Privy (email + Google), payments via Stripe + Razorpay UPI.
// ponytail: one file, no router, no state management library. Split into
//           separate screen components only if the file exceeds ~1500 lines
//           or routing needs change.
import { usePrivy, useLogin, useLogout, useToken } from '@privy-io/react-auth';
import { useState, useEffect, useCallback, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { formatCurrency } from './utils/formatCurrency';
import { getInitial, getColor } from './utils/avatar';
import {
  BitcoinIcon,
  SendIcon,
  ReceiveIcon,
  WalletIcon,
  CheckIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  GlobeIcon,
  BankIcon,
  CreditCardIcon,
  ShieldIcon,
  LockIcon,
  LinkIcon,
  ClockIcon,
  GearIcon,
  TrashIcon,
  BellIcon,
  InfoIcon,
  QuestionCircleIcon,
  ExitIcon,
  SearchIcon,
} from '@bitcoin-design/bitcoin-icons-react/outline';

// ponytail: inline SVG icons for ones missing from Bitcoin Design set
const EyeIcon = ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const EyeOffIcon = ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const CameraIcon = ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
const DownloadIcon = ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const WifiOffIcon = ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>;
const XCircleIcon = ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
const UserPlusIcon = ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>;
const GoogleIcon = ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>;

// ponytail: single file, no router, state-based screen switching
const API = import.meta.env.VITE_API_URL;
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

async function apiFetch(path, token, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function LoginScreen({ error }) {
  const { login } = useLogin();
  return (
    <div className="login-screen page-enter">
      <div className="login-card">
        <div className="logo"><BitcoinIcon size={56} /></div>
        <h1>Bank</h1>
        <p className="subtitle">Send money globally. Near-zero fees.</p>
        {error && <p className="error-text login-error"><InfoIcon size={14} /> {error}</p>}
        <button className="btn-primary" onClick={() => login({ loginMethods: ['email', 'google'] })}>
          <GoogleIcon size={18} /> Get Started
        </button>
        <p className="terms">
          <ShieldIcon size={12} /> Secured by Bitcoin Design standards
        </p>
      </div>
    </div>
  );
}

function DashboardScreen({ user, token, onSend, onDeposit, onHistory, onSettings }) {
  const { logout } = useLogout();
  const [recentTxs, setRecentTxs] = useState([]);
  const [showLogout, setShowLogout] = useState(false);

  useEffect(() => {
    if (token) {
      apiFetch('/transactions', token).then(data => {
        setRecentTxs(data.slice(0, 3));
      }).catch(() => {});
    }
  }, [token]);

  const dailyLimit = 100000;
  const spent = recentTxs.filter(t => t.type === 'send').reduce((sum, t) => sum + t.amount, 0);
  const remaining = Math.max(0, dailyLimit - spent);
  const limitPercent = Math.min(100, (spent / dailyLimit) * 100);

  return (
    <div className="dashboard page-enter">
      <header className="dash-header">
        <div className="logo-small"><BitcoinIcon size={24} /></div>
        <div className="user-info">
          <span>{user.email || 'User'}</span>
          <button className="btn-ghost" onClick={onSettings}><GearIcon size={16} /></button>
          <button className="btn-ghost" onClick={() => setShowLogout(true)}>Logout</button>
        </div>
      </header>

      <div className="security-bar">
        <span className={`security-badge ${user.kyc === 'verified' ? 'verified' : ''}`}>
          <ShieldIcon size={12} /> {user.kyc === 'verified' ? 'KYC Verified' : 'KYC Pending'}
        </span>
        <span className="security-badge">
          <LockIcon size={12} /> Encrypted
        </span>
      </div>

      <div className="balance-card">
        <p className="balance-label">Your Balance</p>
        <h2 className="balance-amount">{formatCurrency(user.balance || 0, 'INR')}</h2>
        <div className="balance-actions">
          <button className="btn-primary" onClick={onDeposit}>
            <ReceiveIcon size={18} /> Deposit
          </button>
          <button className="btn-secondary" onClick={onSend}>
            <SendIcon size={18} /> Send
          </button>
        </div>
      </div>

      <div className="feature-grid">
        <button className="feature-cell" onClick={onSend}>
          <div className="feature-icon-wrap send"><SendIcon size={20} /></div>
          <span className="feature-label">Send</span>
        </button>
        <button className="feature-cell" onClick={onDeposit}>
          <div className="feature-icon-wrap deposit"><ReceiveIcon size={20} /></div>
          <span className="feature-label">Deposit</span>
        </button>
        <button className="feature-cell" onClick={onHistory}>
          <div className="feature-icon-wrap history"><ClockIcon size={20} /></div>
          <span className="feature-label">History</span>
        </button>
        <button className="feature-cell" onClick={onSettings}>
          <div className="feature-icon-wrap settings"><GearIcon size={20} /></div>
          <span className="feature-label">Settings</span>
        </button>
      </div>

      <div className="limits-card">
        <div className="limits-header">
          <span>Daily Limit</span>
          <strong>{formatCurrency(remaining, 'INR')} remaining</strong>
        </div>
        <div className="limits-bar">
          <div className="limits-bar-fill" style={{ width: `${limitPercent}%` }} />
        </div>
        <p className="limits-remaining">{formatCurrency(dailyLimit, 'INR')} daily send limit</p>
      </div>

      <div className="recent-section" onClick={onHistory}>
        <h3><ArrowRightIcon size={16} /> Recent Transactions</h3>
        {recentTxs.length === 0 ? (
          <div className="empty-state"><ClockIcon size={16} /> <span>No transactions yet</span></div>
        ) : (
          recentTxs.map(tx => (
            <div key={tx.id} className="recent-tx-item">
              <div className="recent-tx-info">
                <span className={`recent-tx-icon ${tx.type}`}>
                  {tx.type === 'deposit' ? <ReceiveIcon size={14} /> : <SendIcon size={14} />}
                </span>
                <div className="recent-tx-text">
                  <span className="recent-tx-type">{tx.type}</span>
                  <span className="recent-tx-recipient">{tx.recipient || '—'}</span>
                </div>
              </div>
              <span className="recent-tx-amount">{tx.type === 'deposit' ? '+' : '-'}{formatCurrency(tx.amount, 'INR')}</span>
            </div>
          ))
        )}
      </div>

      {showLogout && (
        <div className="modal-overlay" onClick={() => setShowLogout(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Log out?</h3>
              <button className="modal-close" onClick={() => setShowLogout(false)}>×</button>
            </div>
            <p className="modal-body-text">
              You'll need to sign in again to access your wallet.
            </p>
            <div className="modal-actions">
              <button className="btn-primary" onClick={() => logout()}>
                Yes, log out
              </button>
              <button className="btn-secondary" onClick={() => setShowLogout(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DepositForm({ amount, token, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError('');
    const { error: err } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    if (err) setError(err.message);
    else onSuccess();
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && <p className="error-text"><InfoIcon size={14} /> {error}</p>}
      <button className="btn-primary" disabled={loading || !stripe}>
        {loading ? 'Processing...' : `Pay ${formatCurrency(amount, 'INR')}`}
      </button>
    </form>
  );
}

function UpiQrDisplay({ upiUrl, amount }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUrl)}`;
  return (
    <div className="upi-qr">
      <img src={qrUrl} alt="UPI QR Code" width={200} height={200} />
      <p className="upi-qr-hint">Scan with any UPI app to pay {formatCurrency(amount, 'INR')}</p>
    </div>
  );
}

function DepositScreen({ token, onBack }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [upiData, setUpiData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (!upiData?.orderId || done) return;
    setPolling(true);
    const interval = setInterval(async () => {
      const data = await apiFetch(`/order-status/${upiData.orderId}`, token);
      if (data.status === 'completed') {
        setDone(true);
        setPolling(false);
      }
    }, 3000);
    return () => { clearInterval(interval); setPolling(false); };
  }, [upiData, done, token]);

  const startUpi = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setLoading(true);
    const data = await apiFetch('/upi-collect', token, {
      method: 'POST',
      body: JSON.stringify({ amount: parseFloat(amount) }),
    });
    if (data.upiUrl) setUpiData(data);
    setLoading(false);
  };

  const startCard = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setLoading(true);
    const data = await apiFetch('/deposit', token, {
      method: 'POST',
      body: JSON.stringify({ amount: parseFloat(amount) }),
    });
    if (data.clientSecret) setClientSecret(data.clientSecret);
    setLoading(false);
  };

  if (done) {
    return (
      <div className="success-screen page-enter">
        <div className="success-card">
          <div className="success-icon"><CheckIcon size={40} /></div>
          <h2>Deposit Successful</h2>
          <p>{formatCurrency(amount, 'INR')} has been added to your balance</p>
          <button className="btn-primary" onClick={onBack}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard page-enter">
      <header className="dash-header">
        <button className="btn-ghost" onClick={onBack}><ArrowLeftIcon size={16} /> Back</button>
        <h3>Deposit INR</h3>
        <div />
      </header>
      <div className="deposit-card">
        {!method && !clientSecret && !upiData && (
          <>
            <p className="deposit-label">Amount</p>
            <div className="amount-input">
              <span className="currency">₹</span>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" min="1" />
            </div>
            <p className="deposit-info">Choose payment method</p>
            <div className="deposit-methods-grid">
              <button className="method-btn" onClick={() => { setMethod('upi'); startUpi(); }} disabled={loading || !amount}>
                <WalletIcon size={24} /> UPI / QR Code
              </button>
              <button className="method-btn" onClick={() => { setMethod('card'); startCard(); }} disabled={loading || !amount}>
                <CreditCardIcon size={24} /> Card / NetBanking
              </button>
            </div>
          </>
        )}

        {method === 'upi' && upiData && (
          <div className="upi-section">
            <UpiQrDisplay upiUrl={upiData.upiUrl} amount={amount} />
            {polling && <p className="polling-text"><ClockIcon size={14} /> Waiting for payment confirmation...</p>}
            <p className="deposit-info"><GlobeIcon size={14} /> Or pay via UPI ID: bank@razorpay</p>
          </div>
        )}

        {method === 'card' && clientSecret && (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <DepositForm amount={amount} token={token} onSuccess={() => setDone(true)} />
          </Elements>
        )}
      </div>
    </div>
  );
}

function SendScreen({ token, user, onBack }) {
  const [step, setStep] = useState('form');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('usd');
  const [recipient, setRecipient] = useState('');
  const [bankAccount, setBankAccount] = useState({ ifsc: '', accountNumber: '' });
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [showAddBeneficiary, setShowAddBeneficiary] = useState(false);
  const [newBen, setNewBen] = useState({ name: '', ifsc: '', accountNumber: '' });

  useEffect(() => {
    apiFetch('/forex').then(data => setRates(data.rates)).catch(() => {});
    apiFetch('/beneficiaries', token).then(data => setBeneficiaries(data)).catch(() => {});
  }, [token]);

  const converted = rates && amount ? (parseFloat(amount) * (rates[currency.toUpperCase()] || 1)).toFixed(2) : null;
  const fee = rates && amount ? (parseFloat(amount) * 0.005).toFixed(2) : null;

  const handleReview = () => {
    if (!amount || !recipient) return;
    setStep('review');
  };

  const handleSend = async () => {
    setLoading(true);
    setError('');
    const data = await apiFetch('/send', token, {
      method: 'POST',
      body: JSON.stringify({
        amount: parseFloat(amount),
        recipient,
        currency,
        bankAccount: bankAccount.ifsc ? bankAccount : undefined,
      }),
    });
    if (data.error) {
      setError(data.error);
      setStep('form');
    } else {
      setDone(true);
      setStep('done');
    }
    setLoading(false);
  };

  if (step === 'done' && done) {
    return (
      <div className="success-screen page-enter">
        <div className="success-card">
          <div className="success-icon"><CheckIcon size={40} /></div>
          <h2>Money Sent!</h2>
          <p>{formatCurrency(amount, 'INR')} sent to {recipient}</p>
          <button className="btn-primary" onClick={onBack}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  if (step === 'review') {
    return (
      <div className="dashboard page-enter">
        <header className="dash-header">
          <button className="btn-ghost" onClick={() => setStep('form')}><ArrowLeftIcon size={16} /> Back</button>
          <h3>Review Payment</h3>
          <div />
        </header>
        <div className="send-card">
          <div className="review-card">
            <div className="review-row">
              <span>Recipient</span>
              <span>{recipient}</span>
            </div>
            <div className="review-row">
              <span>Amount</span>
              <span>{formatCurrency(amount, 'INR')}</span>
            </div>
            {currency !== 'inr' && converted && (
              <>
                <div className="review-row">
                  <span>Exchange rate</span>
                  <span>1 INR = {rates[currency.toUpperCase()]} {currency.toUpperCase()}</span>
                </div>
                <div className="review-row">
                  <span>Recipient gets</span>
                  <span>{converted} {currency.toUpperCase()}</span>
                </div>
              </>
            )}
            {fee && (
              <div className="review-row">
                <span>Fee (0.5%)</span>
                <span>{formatCurrency(fee, 'INR')}</span>
              </div>
            )}
            <div className="review-row total">
              <span>Total</span>
              <span>{formatCurrency((parseFloat(amount) + parseFloat(fee || 0)).toFixed(2), 'INR')}</span>
            </div>
          </div>

          {error && <p className="error-text"><InfoIcon size={14} /> {error}</p>}

          <button className="btn-primary" onClick={handleSend} disabled={loading}>
            {loading ? 'Sending...' : <><LockIcon size={16} /> Confirm & Send</>}
          </button>
          <p className="send-footer-note">
            <ShieldIcon size={12} /> Secured with 256-bit encryption
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard page-enter">
      <header className="dash-header">
        <button className="btn-ghost" onClick={onBack}><ArrowLeftIcon size={16} /> Back</button>
        <h3>Send Money</h3>
        <div />
      </header>
      <div className="send-card">
        {beneficiaries.length > 0 && (
          <div className="form-group">
            <label>Saved Recipients</label>
            <div className="beneficiary-list">
                {beneficiaries.map(b => (
                  <button key={b.id} className="beneficiary-chip" onClick={() => { setRecipient(b.name); if (b.ifsc) setBankAccount({ ifsc: b.ifsc, accountNumber: b.accountNumber || '' }); }}>
                    <span className="beneficiary-avatar" style={{ background: `${getColor(b.name)}20`, color: getColor(b.name) }}>{getInitial(b.name)}</span>
                    <span className="beneficiary-name">{b.name}</span>
                  </button>
                ))}
                <button className="beneficiary-chip add" onClick={() => setShowAddBeneficiary(!showAddBeneficiary)}>
                  <span className="beneficiary-avatar add"><UserPlusIcon size={16} /></span>
                <span className="beneficiary-name">Add</span>
              </button>
            </div>
          </div>
        )}

        {beneficiaries.length === 0 && (
          <div className="form-group">
            <div className="beneficiary-empty">
              <p><SendIcon size={14} /> No saved recipients</p>
              <button className="btn-link" onClick={() => setShowAddBeneficiary(true)}>Add one</button>
            </div>
          </div>
        )}

        {showAddBeneficiary && (
          <div className="add-beneficiary-form">
            <div className="form-group">
              <label>Name</label>
              <input type="text" value={newBen.name} onChange={e => setNewBen({ ...newBen, name: e.target.value })} placeholder="Recipient name" />
            </div>
            <div className="form-group">
              <label>IFSC (optional)</label>
              <input type="text" value={newBen.ifsc} onChange={e => setNewBen({ ...newBen, ifsc: e.target.value })} placeholder="IFSC Code" />
            </div>
            <div className="form-group">
              <label>Account Number (optional)</label>
              <input type="text" value={newBen.accountNumber} onChange={e => setNewBen({ ...newBen, accountNumber: e.target.value })} placeholder="Account Number" />
            </div>
            <button className="btn-primary" onClick={async () => {
              if (!newBen.name) return;
              const data = await apiFetch('/beneficiaries', token, { method: 'POST', body: JSON.stringify(newBen) });
              if (data.id) {
                setBeneficiaries([...beneficiaries, data]);
                setNewBen({ name: '', ifsc: '', accountNumber: '' });
                setShowAddBeneficiary(false);
              }
            }} disabled={!newBen.name}>
              Save Recipient
            </button>
          </div>
        )}

        <div className="form-group">
          <label><GlobeIcon size={14} /> Recipient Name</label>
          <input type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Recipient name" />
        </div>
        <div className="form-group">
          <label>Amount (balance: {formatCurrency(user.balance || 0, 'INR')})</label>
          <div className="amount-input">
            <span className="currency">₹</span>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" min="1" />
          </div>
        </div>
        <div className="form-group">
          <label>Send as</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="inr">INR — Indian Rupee</option>
            <option value="usd">USD — US Dollar</option>
            <option value="eur">EUR — Euro</option>
            <option value="gbp">GBP — British Pound</option>
            <option value="aed">AED — UAE Dirham</option>
            <option value="sgd">SGD — Singapore Dollar</option>
          </select>
        </div>

        {rates && amount && currency !== 'inr' && (
          <div className="forex-summary">
            <div className="forex-row"><span>Exchange rate</span><span>1 INR = {rates[currency.toUpperCase()] || '—'} {currency.toUpperCase()}</span></div>
            <div className="forex-row"><span>Recipient gets</span><span>{converted} {currency.toUpperCase()}</span></div>
            <div className="forex-row fee"><span>Fee (0.5%)</span><span>{formatCurrency(fee, 'INR')}</span></div>
          </div>
        )}

        <div className="form-group">
          <label><BankIcon size={14} /> Bank Account (optional)</label>
          <div className="bank-fields">
            <input type="text" value={bankAccount.ifsc} onChange={(e) => setBankAccount({ ...bankAccount, ifsc: e.target.value })} placeholder="IFSC Code" />
            <input type="text" value={bankAccount.accountNumber} onChange={(e) => setBankAccount({ ...bankAccount, accountNumber: e.target.value })} placeholder="Account Number" />
          </div>
        </div>

        {error && <p className="error-text"><InfoIcon size={14} /> {error}</p>}
        <button className="btn-primary" onClick={handleReview} disabled={!amount || !recipient}>
          <SendIcon size={18} /> Review Payment
        </button>
      </div>
    </div>
  );
}

function HistoryScreen({ token, onBack }) {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedTx, setSelectedTx] = useState(null);

  useEffect(() => {
    apiFetch('/transactions', token).then(data => { setTxs(data); setLoading(false); });
  }, [token]);

  const filtered = txs.filter(tx => {
    const matchesSearch = !search ||
      tx.recipient?.toLowerCase().includes(search.toLowerCase()) ||
      tx.amount?.toString().includes(search) ||
      tx.id?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || tx.type === filter;
    return matchesSearch && matchesFilter;
  });

  const grouped = filtered.reduce((acc, tx) => {
    const date = new Date(tx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(tx);
    return acc;
  }, {});

  return (
    <div className="dashboard page-enter">
      <header className="dash-header">
        <button className="btn-ghost" onClick={onBack}><ArrowLeftIcon size={16} /> Back</button>
        <h3>Transaction History</h3>
        <div />
      </header>

      <div className="search-bar">
          <span className="search-icon"><SearchIcon size={16} /></span>
          <input
            className="search-input"
            type="text"
            placeholder="Search by name, amount, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
      </div>

      <div className="filter-row">
        {['all', 'deposit', 'send'].map(f => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'deposit' ? 'Received' : 'Sent'}
          </button>
        ))}
      </div>

      <div className="tx-list">
        {loading && <p className="empty-state">Loading...</p>}
        {!loading && filtered.length === 0 && (
          <div className="empty-state">{search ? <><SearchIcon size={16} /> <span>No transactions match your search</span></> : <><ClockIcon size={16} /> <span>No transactions yet</span></>}</div>
        )}
        {Object.entries(grouped).map(([date, items]) => (
          <div key={date} className="tx-date-group">
            <p className="tx-date-label">{date}</p>
            {items.map(tx => (
              <div key={tx.id} className="tx-item" onClick={() => setSelectedTx(tx)}>
                <div className="tx-info">
                  <span className={`tx-icon ${tx.type}`}>
                    {tx.type === 'deposit' ? <ReceiveIcon size={16} /> : <SendIcon size={16} />}
                  </span>
                  <div className="tx-details">
                    <span className="tx-type">{tx.type}</span>
                    <span className="tx-recipient">{tx.recipient || '—'}</span>
                  </div>
                </div>
                <div className="tx-right">
                  <span className="tx-amount">{tx.type === 'deposit' ? '+' : '-'}{formatCurrency(tx.amount, 'INR')}</span>
                  {tx.status === 'failed' ? <XCircleIcon size={14} /> : null}
              <span className={`tx-status ${tx.status}`}>{tx.status}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {selectedTx && (
        <div className="modal-overlay" onClick={() => setSelectedTx(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Transaction Details</h3>
              <button className="modal-close" onClick={() => setSelectedTx(null)}>×</button>
            </div>

            <div className={`modal-tx-icon ${selectedTx.type}`}>
              {selectedTx.type === 'deposit' ? <ReceiveIcon size={24} /> : <SendIcon size={24} />}
            </div>

            <div className={`modal-amount ${selectedTx.type === 'deposit' ? 'positive' : 'negative'}`}>
              {selectedTx.type === 'deposit' ? '+' : '-'}{formatCurrency(selectedTx.amount, 'INR')}
            </div>

            <div className="modal-status">
              <span className={`tx-status ${selectedTx.status}`}>{selectedTx.status}</span>
            </div>

            <div className="modal-details">
              <div className="modal-detail-row">
                <span>Type</span>
                <span style={{ textTransform: 'capitalize' }}>{selectedTx.type}</span>
              </div>
              <div className="modal-detail-row">
                <span>Date</span>
                <span>{new Date(selectedTx.createdAt).toLocaleString('en-IN')}</span>
              </div>
              {selectedTx.recipient && (
                <div className="modal-detail-row">
                  <span>{selectedTx.type === 'send' ? 'Recipient' : 'Sender'}</span>
                  <span>{selectedTx.recipient}</span>
                </div>
              )}
              <div className="modal-detail-row">
                <span>Transaction ID</span>
                <span>{selectedTx.id?.slice(0, 16)}...</span>
              </div>
              {selectedTx.stripeId && (
                <div className="modal-detail-row">
                  <span>Stripe ID</span>
                  <span>{selectedTx.stripeId}</span>
                </div>
              )}
              {selectedTx.razorpayId && (
                <div className="modal-detail-row">
                  <span>Razorpay ID</span>
                  <span>{selectedTx.razorpayId}</span>
                </div>
              )}
            </div>

            <a
              className="modal-link"
              href={`https://dashboard.stripe.com/payments/${selectedTx.stripeId || ''}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <LinkIcon size={14} /> View on Stripe Dashboard
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsScreen({ user, onBack }) {
  const { logout } = useLogout();

  return (
    <div className="dashboard page-enter">
      <header className="dash-header">
        <button className="btn-ghost" onClick={onBack}><ArrowLeftIcon size={16} /> Back</button>
        <h3>Settings</h3>
        <div />
      </header>

      <div className="settings-section">
        <div className="settings-card">
          <div className="settings-avatar">
            <BitcoinIcon size={32} />
          </div>
          <div className="settings-user-info">
            <span className="settings-email">{user.email || 'User'}</span>
            <span className="settings-id">ID: {user.userId?.slice(0, 12)}...</span>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h4 className="settings-section-title">Security</h4>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-left">
              <ShieldIcon size={18} />
              <div>
                <span className="settings-row-label">KYC Status</span>
                <span className="settings-row-value">{user.kyc === 'verified' ? 'Verified' : 'Pending'}</span>
              </div>
            </div>
            <span className={`settings-badge ${user.kyc === 'verified' ? 'verified' : 'pending'}`}>
              {user.kyc === 'verified' ? '✓' : '…'}
            </span>
          </div>
          <div className="settings-row">
            <div className="settings-row-left">
              <LockIcon size={18} />
              <div>
                <span className="settings-row-label">Encryption</span>
                <span className="settings-row-value">256-bit AES</span>
              </div>
            </div>
            <span className="settings-badge verified">✓</span>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h4 className="settings-section-title">Limits</h4>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-left">
              <SendIcon size={18} />
              <div>
                <span className="settings-row-label">Daily Send Limit</span>
                <span className="settings-row-value">₹1,00,000</span>
              </div>
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-left">
              <ReceiveIcon size={18} />
              <div>
                <span className="settings-row-label">Deposit Limit</span>
                <span className="settings-row-value">Unlimited</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h4 className="settings-section-title">Preferences</h4>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-left">
              <BellIcon size={18} />
              <div>
                <span className="settings-row-label">Notifications</span>
                <span className="settings-row-value">Transaction alerts</span>
              </div>
            </div>
            <ArrowRightIcon size={16} />
          </div>
          <div className="settings-row">
            <div className="settings-row-left">
              <GlobeIcon size={18} />
              <div>
                <span className="settings-row-label">Currency</span>
                <span className="settings-row-value">INR</span>
              </div>
            </div>
            <ArrowRightIcon size={16} />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h4 className="settings-section-title">Support</h4>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-left">
              <QuestionCircleIcon size={18} />
              <div>
                <span className="settings-row-label">Help Center</span>
                <span className="settings-row-value">FAQs & support</span>
              </div>
            </div>
            <ArrowRightIcon size={16} />
          </div>
          <div className="settings-row">
            <div className="settings-row-left">
              <InfoIcon size={18} />
              <div>
                <span className="settings-row-label">About</span>
                <span className="settings-row-value">Version 1.0.0</span>
              </div>
            </div>
            <ArrowRightIcon size={16} />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-card">
          <button className="settings-row settings-btn" onClick={() => logout()}>
            <div className="settings-row-left" style={{ color: 'var(--danger)' }}>
              <ExitIcon size={18} />
              <div>
                <span className="settings-row-label" style={{ color: 'var(--danger)' }}>Log Out</span>
                <span className="settings-row-value" style={{ color: 'var(--danger)' }}>Sign out of your account</span>
              </div>
            </div>
            <ArrowRightIcon size={16} />
          </button>
        </div>
      </div>

    </div>
  );
}

export default function App() {
  const { ready, authenticated, user: privyUser } = usePrivy();
  const { getAccessToken } = useToken();
  const [screen, setScreen] = useState('login');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState('');
  const [authenticating, setAuthenticating] = useState(false);
  const [authError, setAuthError] = useState('');
  const fetchedRef = useRef(false);

  const fetchUser = useCallback(async () => {
    try {
      setAuthError('');
      setAuthenticating(true);
      const t = await getAccessToken();
      if (!t) { setAuthenticating(false); return; }
      setToken(t);
      const data = await apiFetch('/auth/verify', t, { method: 'POST' });
      setUser(data);
      setScreen('dashboard');
    } catch (err) {
      setAuthError(err.message || 'Login failed');
      setScreen('login');
    } finally {
      setAuthenticating(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (authenticated && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchUser();
    } else if (ready && !authenticated) {
      fetchedRef.current = false;
      setScreen('login');
    }
  }, [authenticated, ready, fetchUser]);

  if (!ready || authenticating) {
    return (
      <div className="loading">
        <div className="loading-logo"><BitcoinIcon size={32} /></div>
        <p className="loading-text">
          {authenticating ? 'Syncing your account...' : 'Loading...'}
        </p>
      </div>
    );
  }

  switch (screen) {
    case 'login': return <LoginScreen error={authError} />;
    case 'dashboard': return <DashboardScreen user={user} token={token} onSend={() => setScreen('send')} onDeposit={() => setScreen('deposit')} onHistory={() => setScreen('history')} onSettings={() => setScreen('settings')} />;
    case 'deposit': return <DepositScreen token={token} onBack={() => { fetchedRef.current = false; fetchUser().then(() => setScreen('dashboard')); }} />;
    case 'send': return <SendScreen token={token} user={user} onBack={() => { fetchedRef.current = false; fetchUser().then(() => setScreen('dashboard')); }} />;
    case 'history': return <HistoryScreen token={token} onBack={() => setScreen('dashboard')} />;
    case 'settings': return <SettingsScreen user={user} onBack={() => setScreen('dashboard')} />;
    default: return <LoginScreen error={authError} />;
  }
}
