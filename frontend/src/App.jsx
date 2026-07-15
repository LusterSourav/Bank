import { onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from './i18n.js';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { formatCurrency } from './utils/formatCurrency';
import { getInitial, getColor } from './utils/avatar';
import WalletScreen from './screens/WalletScreen.jsx';
import RemitScreen from './screens/RemitScreen.jsx';
import ClaimScreen from './screens/ClaimScreen.jsx';
import ZKScreen from './screens/ZKScreen.jsx';
import RecoveryScreen from './screens/RecoveryScreen.jsx';
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
  BellIcon,
  InfoIcon,
  QuestionCircleIcon,
  ExitIcon,
  SearchIcon,
  ContactsIcon,
  KeyIcon,
  FileIcon,
  HomeIcon,
  EditIcon,
  AlertCircleIcon,
  QrCodeIcon,
  VerifyIcon,
  CopyIcon,
  ExchangeIcon,
} from '@bitcoin-design/bitcoin-icons-react/outline';
import { auth, googleProvider } from './firebase';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

const API = import.meta.env.VITE_API_URL;
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

async function apiFetch(path, token, opts = {}) {
  // auto-attach TOTP and WebAuthn session tokens from localStorage
  let totpToken = null;
  try {
    const s = JSON.parse(localStorage.getItem('totpSession') || '{}');
    if (s.totpToken && s.expiresAt > Date.now()) totpToken = s.totpToken;
  } catch {}
  let webauthnToken = null;
  try {
    const s = JSON.parse(localStorage.getItem('webauthnSession') || '{}');
    if (s.webauthnToken && s.expiresAt > Date.now()) webauthnToken = s.webauthnToken;
  } catch {}
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(totpToken ? { 'X-Totp-Token': totpToken } : {}),
      ...(webauthnToken ? { 'X-Webauthn-Token': webauthnToken } : {}),
      ...opts.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) {
  // 403 from TOTP enforcement → clear session so frontend shows unlock gate
  if (res.status === 403 && data.error === 'TOTP session expired') {
    localStorage.removeItem('totpSession');
    window.dispatchEvent(new Event('totpSessionExpired'));
  }
  // 403 from biometric enforcement → clear session so frontend shows unlock gate
  if (res.status === 403 && data.error === 'Biometric session expired') {
    localStorage.removeItem('webauthnSession');
    window.dispatchEvent(new Event('webauthnSessionExpired'));
  }
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

const EyeIcon = ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const ChevronDownIcon = ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;
const SunIcon = ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
const MoonIcon = ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
const DownloadIcon = ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const FingerprintIcon = ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0 0-10 10 10 10 0 0 0 4.5 8.3"/><path d="M17.5 6.34A10 10 0 0 1 22 12"/><path d="M2 12c0 4.2 2.6 7.8 6.3 9.3"/><path d="M9.2 8.5A5 5 0 0 1 17 12"/><path d="M17 17.5A5 5 0 0 1 7 12"/><path d="M12 5v.01"/><path d="M12 9v.01"/><path d="M12 13v.01"/><path d="M12 17v.01"/></svg>;
const XCircleIcon = ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
const MailIcon = ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
const UserPlusIcon = ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>;
const GoogleIcon = ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>;

const b64url = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};
const isWebKit = () => /AppleWebKit/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
const isMobile = () => /Android|iPhone|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);

function LoginScreen({ onGoogleLogin, onEmailLogin, isSignUp, setIsSignUp, error, onForgotPassword }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <div data-testid="login-screen" className="login-screen page-enter">
      <div className="login-card">
        <div className="logo"><BitcoinIcon size={56} /></div>
        <h1>{t('appName')}</h1>
        <p className="subtitle">{t('appSubtitle')}</p>
        {error && <p className="error-text login-error"><InfoIcon size={14} /> {error}</p>}
        <div className="form-group">
          <input data-testid="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('email')} />
        </div>
        <div className="form-group">
          <input data-testid="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('password')} />
        </div>
        <button data-testid="login-submit" className="btn-primary" onClick={() => onEmailLogin(email, password)}>
          {isSignUp ? t('createAccount') : t('signIn')}
        </button>
        <button data-testid="login-google" className="btn-secondary" onClick={onGoogleLogin}>
          <GoogleIcon size={18} /> {t('continueWithGoogle')}
        </button>
        {!isSignUp && (
          <p className="forgot-link">
            <button className="btn-link" onClick={onForgotPassword}>{t('forgotPassword')}</button>
          </p>
        )}
        <p className="terms">
          {isSignUp ? t('alreadyAccount') : t('noAccount')}{' '}
          <button className="btn-link" onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? t('signIn') : t('signUp')}
          </button>
        </p>
      </div>
    </div>
  );
}

function ForgotPasswordScreen({ onBack }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!email) return;
    setLoading(true);
    setError('');
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch (err) {
      // ponytail: always show success — anti-enumeration
      setSent(true);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="login-screen page-enter">
        <div className="login-card">
          <div className="logo"><BitcoinIcon size={56} /></div>
          <h2>{t('forgotPasswordTitle')}</h2>
          <p className="subtitle">{t('resetLinkSent')}</p>
          <button className="btn-primary" onClick={onBack}>{t('backToLogin')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen page-enter">
      <div className="login-card">
        <div className="logo"><BitcoinIcon size={56} /></div>
        <h2>{t('forgotPasswordTitle')}</h2>
        <p className="subtitle">{t('forgotPasswordSubtitle')}</p>
        {error && <p className="error-text"><InfoIcon size={14} /> {error}</p>}
        <div className="form-group">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('email')} />
        </div>
        <button className="btn-primary" onClick={handleSend} disabled={loading}>
          {loading ? t('sending') : t('sendResetLink')}
        </button>
        <p className="terms">
          <button className="btn-link" onClick={onBack}>{t('backToLogin')}</button>
        </p>
      </div>
    </div>
  );
}

function ResetPasswordScreen({ oobCode, onBack }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!oobCode) return;
    verifyPasswordResetCode(auth, oobCode).then(e => setEmail(e)).catch(() => setError('Invalid or expired reset link'));
  }, [oobCode]);

  const check = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    match: password === confirm && password.length > 0,
  };

  const handleReset = async () => {
    if (!Object.values(check).every(Boolean)) return;
    setLoading(true);
    setError('');
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  if (done) {
    return (
      <div className="login-screen page-enter">
        <div className="login-card">
          <div className="logo"><BitcoinIcon size={56} /></div>
          <h2>{t('passwordResetSuccess')}</h2>
          <p className="subtitle">{t('passwordResetLogin')}</p>
          <button className="btn-primary" onClick={onBack}>{t('backToLogin')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen page-enter">
      <div className="login-card">
        <div className="logo"><BitcoinIcon size={56} /></div>
        <h2>{t('resetPasswordTitle')}</h2>
        <p className="subtitle">{email || t('forgotPasswordSubtitle')}</p>
        {error && <p className="error-text"><InfoIcon size={14} /> {error}</p>}
        <div className="form-group">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('newPassword')} />
        </div>
        <div className="form-group">
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder={t('confirmPassword')} />
        </div>
        <div className="password-checklist">
          <span className={check.length ? 'pass' : ''}>{check.length ? '✓' : '○'} {t('passwordMinLength')}</span>
          <span className={check.upper ? 'pass' : ''}>{check.upper ? '✓' : '○'} {t('passwordUppercase')}</span>
          <span className={check.number ? 'pass' : ''}>{check.number ? '✓' : '○'} {t('passwordNumber')}</span>
          <span className={check.match ? 'pass' : ''}>{check.match ? '✓' : '○'} {t('passwordsMatch')}</span>
        </div>
        <button className="btn-primary" onClick={handleReset} disabled={loading || !Object.values(check).every(Boolean)}>
          {loading ? t('loading') : t('resetPassword')}
        </button>
      </div>
    </div>
  );
}

function DashboardScreen({ user, token, onSend, onDeposit, onHistory, onSettings, onKyc, onLogout, onWallet, onClaim, platformAuthAvail }) {
  const { t } = useTranslation();
  const [recentTxs, setRecentTxs] = useState([]);
  const [showLogout, setShowLogout] = useState(false);
  const [privacyRevealed, setPrivacyRevealed] = useState(false);
  const privacyTimerRef = useRef(null);
  // ponytail: restore WebAuthn session from localStorage with 1hr expiry — survives page refresh
  const [webauthnSession, setWebauthnSession] = useState(() => {
    const saved = localStorage.getItem('webauthnSession');
    if (saved) { try { const s = JSON.parse(saved); if (s.expiresAt > Date.now()) return s; } catch {} }
    return null;
  });
  const [webauthnUnlockErr, setWebauthnUnlockErr] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpUnlockErr, setTotpUnlockErr] = useState('');
  const [totpUnlockLoading, setTotpUnlockLoading] = useState(false);
  const [autoLocked, setAutoLocked] = useState(false);

  const darkMode = localStorage.getItem('darkMode') !== 'false';
  const showBalance = localStorage.getItem('showBalance') !== 'false';
  const privacyPin = localStorage.getItem('privacyPin') === 'true';

  useEffect(() => {
    if (darkMode) {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  useEffect(() => {
    if (token) {
      apiFetch('/transactions', token).then(data => {
        setRecentTxs(data.slice(0, 3));
      }).catch(() => {});
    }
  }, [token]);

  // clear React state when webauthnSession is invalidated server-side (403)
  useEffect(() => {
    const handleExpired = () => { setWebauthnSession(null); };
    window.addEventListener('webauthnSessionExpired', handleExpired);
    return () => window.removeEventListener('webauthnSessionExpired', handleExpired);
  }, []);

  // ponytail: auto-lock on visibility change
  useEffect(() => {
    const handleVisibility = () => {
      const timer = localStorage.getItem('autoLockTimer');
      if (document.visibilityState === 'visible' && timer && timer !== 'off' && (user.webauthnCount || 0) > 0) {
        setAutoLocked(true);
        setWebauthnSession(null);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user.webauthnCount]);

  // persist WebAuthn session to localStorage so it survives page refresh
  const verifyWebauthnUnlock = async () => {
    try {
      const opts = await apiFetch('/webauthn/authenticate/begin', token, { method: 'POST' });
      if (!opts.allowCredentials?.length) {
        setWebauthnUnlockErr('No biometric registered. Register in Settings to enable.');
        return;
      }
      // ponytail: mediation:optional forces local biometric, no QR/hybrid fallback
      let authResp;
      try {
        const cred = await navigator.credentials.get({ mediation: 'optional', publicKey: opts });
        authResp = {
          id: cred.id,
          rawId: cred.id,
          response: {
            clientDataJSON: b64url(cred.response.clientDataJSON),
            authenticatorData: b64url(cred.response.authenticatorData),
            signature: b64url(cred.response.signature),
            userHandle: cred.response.userHandle ? b64url(cred.response.userHandle) : undefined,
          },
          type: cred.type,
          clientExtensionResults: cred.getClientExtensionResults(),
          authenticatorAttachment: cred.authenticatorAttachment,
        };
      } catch (innerErr) {
        // mediation not supported (older browser), use SimpleWebAuthn
        if (innerErr.name === 'TypeError' || innerErr.name === 'NotSupportedError') {
          authResp = await startAuthentication(opts);
        } else {
          throw innerErr;
        }
      }
      const d = await apiFetch('/webauthn/authenticate/complete', token, { method: 'POST', body: JSON.stringify(authResp) });
      const session = { webauthnToken: d.webauthnToken, verified: true, expiresAt: Date.now() + 3600000 };
      setWebauthnSession(session);
      localStorage.setItem('webauthnSession', JSON.stringify(session));
      setAutoLocked(false);
      setWebauthnUnlockErr('');
    } catch (e) {
      if (e.name === 'NotAllowedError') {
        if (isWebKit()) {
          setWebauthnUnlockErr('Biometric not found on this browser. Register it in Settings > Biometric using Safari.');
        } else {
          setWebauthnUnlockErr('No matching biometric found. Register in Settings using this browser.');
        }
      } else {
        setWebauthnUnlockErr(e.message);
      }
    }
  };

  // ponytail: TOTP unlock for mobile — creates webauthnSession to unlock balance
  const unlockWithTotp = async () => {
    setTotpUnlockLoading(true);
    setTotpUnlockErr('');
    try {
      const d = await apiFetch('/totp/verify', token, { method: 'POST', body: JSON.stringify({ token: totpCode }) });
      const session = { webauthnToken: d.totpToken, verified: true, expiresAt: Date.now() + 3600000 };
      setWebauthnSession(session);
      localStorage.setItem('webauthnSession', JSON.stringify(session));
      setTotpCode('');
      setAutoLocked(false);
    } catch (e) {
      setTotpUnlockErr(e.message);
    }
    setTotpUnlockLoading(false);
  };

  const revealBalance = () => {
    if ((user.webauthnCount || 0) > 0 && !webauthnSession) return;
    if (!privacyPin) return;
    setPrivacyRevealed(true);
    if (privacyTimerRef.current) clearTimeout(privacyTimerRef.current);
    privacyTimerRef.current = setTimeout(() => setPrivacyRevealed(false), 3000);
  };

  const balanceVisible = showBalance && (!privacyPin || privacyRevealed) && (!(user.webauthnCount || 0) > 0 || webauthnSession);

  const totalSent = recentTxs.filter(t => t.type === 'send').reduce((sum, t) => sum + t.amount, 0);
  const totalReceived = recentTxs.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0);
  const dailyLimit = user.sendLimit || 100000;
  const remaining = Math.max(0, dailyLimit - totalSent);
  const limitPercent = Math.min(100, (totalSent / dailyLimit) * 100);
  const securityScore = [user.kyc === 'verified', user.totpEnabled, (user.webauthnCount || 0) > 0, user.emailVerified].filter(Boolean).length;

  const fmtIST = (d) => d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

  return (
    <div data-testid="dashboard-screen" className="dashboard page-enter">
      <header className="dash-header">
        <div className="logo-small"><BitcoinIcon size={24} /></div>
        <div className="user-info">
          <span>{user.name || user.email || 'User'}</span>
          <button className="btn-ghost" onClick={onSettings}><GearIcon size={16} /></button>
          <button className="btn-ghost" onClick={() => setShowLogout(true)}>{t('logout')}</button>
        </div>
      </header>

      {/* Profile Card */}
      <div data-testid="profile-card" className="profile-card">
        <div className="profile-avatar">
          <BitcoinIcon size={32} />
        </div>
        <div className="profile-info">
          <span className="profile-name">{user.name || user.email}</span>
          <span className="profile-email">{user.email}</span>
          <span className="profile-id">{t('id')}: {user.userId?.slice(0, 12)}...</span>
        </div>
        <span className={`kyc-badge ${user.kyc === 'verified' ? 'verified' : user.kyc === 'pending' ? 'pending' : 'unverified'}`}>
          <ShieldIcon size={12} />
          {user.kyc === 'verified' ? t('kycVerified') : user.kyc === 'pending' ? t('kycPending') : t('kycPending')}
        </span>
      </div>

      {/* Security bar */}
      <div className="security-bar">
        <span className={`security-badge ${securityScore === 4 ? 'verified' : ''}`}>
          <ShieldIcon size={12} /> {t('securityScore')}<span className="security-score-text">{securityScore}/4</span>
        </span>
        <span className="security-badge">
          <LockIcon size={12} /> {t('encrypted')}
        </span>
      </div>

      {/* Balance card */}
      <div data-testid="balance-card" className="balance-card">
        <p className="balance-label">{t('yourBalance')}</p>
        {((user.webauthnCount || 0) > 0 && (!webauthnSession || autoLocked)) ? (
          isMobile() || platformAuthAvail === false ? (
            user.totpEnabled ? (
              <div className="totp-unlock">
                <p className="totp-unlock-desc">Enter 6-digit code from your authenticator app</p>
                {totpUnlockErr && <p className="error-text">{totpUnlockErr}</p>}
                <input
                  className="settings-input otp-input"
                  type="text" maxLength={6}
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                />
                <button className="btn-primary" onClick={unlockWithTotp} disabled={totpUnlockLoading || totpCode.length !== 6}>
                  {totpUnlockLoading ? 'Verifying...' : 'Unlock with TOTP'}
                </button>
              </div>
            ) : (
              <div className="totp-unlock">
                <p className="totp-unlock-desc">Enable TOTP in Settings to unlock on this device</p>
                <button className="btn-primary" onClick={onSettings}><GearIcon size={18} /> Go to Settings</button>
              </div>
            )
          ) : (
            <div className="totp-unlock">
              {autoLocked && <p className="totp-unlock-desc" style={{ color: 'var(--warning)' }}><LockIcon size={14} /> {t('screenLocked')} — {t('screenLockedDesc')}</p>}
              <p className="totp-unlock-desc">{t('biometricUnlockDesc')}</p>
              {webauthnUnlockErr && <p className="error-text">{webauthnUnlockErr}</p>}
              <button className="btn-primary" onClick={verifyWebauthnUnlock}>
                <FingerprintIcon size={18} /> {t('unlockWithBiometric')}
              </button>
            </div>
          )
        ) : (
          <>
            <h2 className={privacyPin && !privacyRevealed ? 'balance-reveal-hint' : 'balance-amount'} onClick={revealBalance}>
              {balanceVisible ? formatCurrency(user.balance || 0, 'INR') : privacyPin && !privacyRevealed ? t('tapToReveal') : '— — —'}
            </h2>
            <div className="balance-actions">
              <button className="btn-primary" onClick={onDeposit}>
                <ReceiveIcon size={18} /> {t('deposit')}
              </button>
              <button className="btn-secondary" onClick={onSend}>
                <SendIcon size={18} /> {t('send')}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Account Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">{t('totalSent')}</span>
          <span className="stat-value">{formatCurrency(totalSent, 'INR')}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">{t('totalReceived')}</span>
          <span className="stat-value">{formatCurrency(totalReceived, 'INR')}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">{t('dailyLimit')}</span>
          <span className="stat-value">{formatCurrency(remaining, 'INR')}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">{t('memberSince')}</span>
          <span className="stat-value">{fmtIST(user.createdAt)}</span>
        </div>
      </div>

      {/* Feature grid */}
      <div data-testid="feature-grid" className="feature-grid">
        <button data-testid="feature-send" className="feature-cell" onClick={onSend}>
          <div className="feature-icon-wrap send"><SendIcon size={20} /></div>
          <span className="feature-label">{t('send')}</span>
        </button>
        <button className="feature-cell" onClick={onDeposit}>
          <div className="feature-icon-wrap deposit"><ReceiveIcon size={20} /></div>
          <span className="feature-label">{t('deposit')}</span>
        </button>
        <button className="feature-cell" onClick={onHistory}>
          <div className="feature-icon-wrap history"><ClockIcon size={20} /></div>
          <span className="feature-label">{t('history')}</span>
        </button>
        <button className="feature-cell" onClick={onWallet}>
          <div className="feature-icon-wrap settings"><WalletIcon size={20} /></div>
          <span className="feature-label">Wallet</span>
        </button>
        <button className="feature-cell" onClick={onClaim}>
          <div className="feature-icon-wrap settings"><ReceiveIcon size={20} /></div>
          <span className="feature-label">Claim</span>
        </button>
        <button className="feature-cell" onClick={onSettings}>
          <div className="feature-icon-wrap settings"><GearIcon size={20} /></div>
          <span className="feature-label">{t('settings')}</span>
        </button>
      </div>

      {/* Limits */}
      <div className="limits-card">
        <div className="limits-header">
          <span>{t('dailyLimit')}</span>
          <strong>{showBalance ? formatCurrency(remaining, 'INR') : '— — —'} {t('remaining')}</strong>
        </div>
        <div className="limits-bar">
          <div className="limits-bar-fill" style={{ width: `${limitPercent}%` }} />
        </div>
        <p className="limits-remaining">{formatCurrency(dailyLimit, 'INR')} {t('dailySendLimit')}</p>
      </div>

      {/* Recent */}
      <div className="recent-section" onClick={onHistory}>
        <h3><ArrowRightIcon size={16} /> {t('recentTransactions')}</h3>
        {recentTxs.length === 0 ? (
          <div className="empty-state"><ClockIcon size={16} /> <span>{t('noTransactions')}</span></div>
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
              <h3>{t('logoutConfirm')}</h3>
              <button className="modal-close" onClick={() => setShowLogout(false)}>×</button>
            </div>
            <p className="modal-body-text">{t('logoutBody')}</p>
            <div className="modal-actions">
              <button className="btn-primary" onClick={onLogout}>{t('logoutYes')}</button>
              <button className="btn-secondary" onClick={() => setShowLogout(false)}>{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KycScreen({ token, user, onBack, onKycDone }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [aadhaar, setAadhaar] = useState('');
  const [aadhaarRef, setAadhaarRef] = useState('');
  const [otp, setOtp] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [panName, setPanName] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const sendAadhaarOtp = async () => {
    setLoading(true); setError('');
    try {
      const data = await apiFetch('/kyc/aadhaar/send-otp', token, { method: 'POST', body: JSON.stringify({ aadhaarNumber: aadhaar }) });
      setAadhaarRef(data.referenceId);
      setStep(2);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const verifyAadhaarOtp = async () => {
    setLoading(true); setError('');
    try {
      await apiFetch('/kyc/aadhaar/verify-otp', token, { method: 'POST', body: JSON.stringify({ referenceId: aadhaarRef, otp }) });
      setStep(3);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const verifyPan = async () => {
    setLoading(true); setError('');
    try {
      await apiFetch('/kyc/pan/verify', token, { method: 'POST', body: JSON.stringify({ panNumber, name: panName }) });
      setStep(4);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const sendEmailOtp = async () => {
    setLoading(true); setError('');
    try {
      await apiFetch('/kyc/email/send-otp', token, { method: 'POST' });
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const verifyEmailOtp = async () => {
    setLoading(true); setError('');
    try {
      await apiFetch('/kyc/email/verify-otp', token, { method: 'POST', body: JSON.stringify({ otp: emailOtp }) });
      // Finalize KYC
      await apiFetch('/kyc/finalize', token, { method: 'POST', body: JSON.stringify({ name: panName }) });
      setDone(true);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  if (done) {
    return (
      <div className="success-screen page-enter">
        <div className="success-card">
          <div className="success-icon"><CheckIcon size={40} /></div>
          <h2>{t('kycCompleteTitle')}</h2>
          <p>{t('kycCompleteMsg')}</p>
          <button className="btn-primary" onClick={onKycDone}>{t('goToDashboard')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard page-enter">
      <header className="dash-header">
        <button className="btn-ghost" onClick={onBack}><ArrowLeftIcon size={16} /> {t('back')}</button>
        <h3>{t('kycTitle')}</h3>
        <div />
      </header>

      <div className="kyc-progress">
        <div className={`kyc-step ${step >= 1 ? 'active' : ''}`}>1. Aadhaar</div>
        <div className={`kyc-step ${step >= 3 ? 'active' : ''}`}>2. PAN</div>
        <div className={`kyc-step ${step >= 4 ? 'active' : ''}`}>3. Email</div>
      </div>

      {error && <p className="error-text kyc-error"><AlertCircleIcon size={14} /> {error}</p>}

      <div data-testid="kyc-card" className="kyc-card">
        {step === 1 && (
          <div className="kyc-form">
            <h4><FingerprintIcon size={18} /> {t('stepAadhaar')}</h4>
            <p className="kyc-desc">{t('enterAadhaar')}</p>
            <input data-testid="kyc-aadhaar" className="kyc-input" type="text" maxLength={12} value={aadhaar} onChange={e => setAadhaar(e.target.value.replace(/\D/g, ''))} placeholder="1234 5678 9012" />
            <button className="btn-primary" onClick={sendAadhaarOtp} disabled={loading || aadhaar.length !== 12}>
              {loading ? t('loading') : t('sendOtp')}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="kyc-form">
            <h4><FingerprintIcon size={18} /> {t('enterOtp')}</h4>
            <p className="kyc-desc">{t('otpSentTo')}</p>
            <input className="kyc-input otp-input" type="text" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
            <button className="btn-primary" onClick={verifyAadhaarOtp} disabled={loading || otp.length !== 6}>
              {loading ? t('loading') : t('verifyOtp')}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="kyc-form">
            <h4><FileIcon size={18} /> {t('stepPan')}</h4>
            <div className="form-group">
              <label>{t('enterPan')}</label>
              <input className="kyc-input" type="text" maxLength={10} value={panNumber} onChange={e => setPanNumber(e.target.value.toUpperCase())} placeholder="ABCDE1234F" />
            </div>
            <div className="form-group">
              <label>{t('enterPanName')}</label>
              <input className="kyc-input" type="text" value={panName} onChange={e => setPanName(e.target.value)} placeholder="RAJESH KUMAR" />
            </div>
            <button className="btn-primary" onClick={verifyPan} disabled={loading || panNumber.length !== 10 || !panName}>
              {loading ? t('loading') : t('verifyPan')}
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="kyc-form">
            <h4><ContactsIcon size={18} /> {t('stepEmail')}</h4>
            <p className="kyc-desc">{t('emailOtpSent')}</p>
            <button className="btn-secondary" onClick={sendEmailOtp} disabled={loading} style={{ marginBottom: 'var(--sp-16)' }}>
              {loading ? t('loading') : t('verifyEmail')}
            </button>
            <input className="kyc-input otp-input" type="text" maxLength={6} value={emailOtp} onChange={e => setEmailOtp(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
            <button className="btn-primary" onClick={verifyEmailOtp} disabled={loading || emailOtp.length !== 6}>
              {loading ? t('loading') : t('verifyOtp')}
            </button>
          </div>
        )}
      </div>
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
      if (data.status === 'completed') { setDone(true); setPolling(false); }
    }, 3000);
    return () => { clearInterval(interval); setPolling(false); };
  }, [upiData, done, token]);

  const startUpi = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setLoading(true);
    const data = await apiFetch('/upi-collect', token, { method: 'POST', body: JSON.stringify({ amount: parseFloat(amount) }) });
    if (data.upiUrl) setUpiData(data);
    setLoading(false);
  };

  const startCard = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setLoading(true);
    const data = await apiFetch('/deposit', token, { method: 'POST', body: JSON.stringify({ amount: parseFloat(amount) }) });
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
      <div data-testid="deposit-card" className="deposit-card">
        {!method && !clientSecret && !upiData && (
          <>
            <p className="deposit-label">Amount</p>
            <div className="amount-input">
              <span className="currency">₹</span>
              <input data-testid="deposit-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" min="1" />
            </div>
            <p className="deposit-info">Choose payment method</p>
            <div className="deposit-methods-grid">
              <button data-testid="deposit-upi" className="method-btn" onClick={() => { setMethod('upi'); startUpi(); }} disabled={loading || !amount}>
                <WalletIcon size={24} /> UPI / QR Code
              </button>
              <button data-testid="deposit-card-btn" className="method-btn" onClick={() => { setMethod('card'); startCard(); }} disabled={loading || !amount}>
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

  const handleReview = () => { if (!amount || !recipient) return; setStep('review'); };

  const handleSend = async () => {
    setLoading(true); setError('');
    const data = await apiFetch('/send', token, {
      method: 'POST',
      body: JSON.stringify({ amount: parseFloat(amount), recipient, currency, bankAccount: bankAccount.ifsc ? bankAccount : undefined }),
    });
    if (data.error) { setError(data.error); setStep('form'); }
    else { setDone(true); setStep('done'); }
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
            <div className="review-row"><span>Recipient</span><span>{recipient}</span></div>
            <div className="review-row"><span>Amount</span><span>{formatCurrency(amount, 'INR')}</span></div>
            {currency !== 'inr' && converted && (
              <>
                <div className="review-row"><span>Exchange rate</span><span>1 INR = {rates[currency.toUpperCase()]} {currency.toUpperCase()}</span></div>
                <div className="review-row"><span>Recipient gets</span><span>{converted} {currency.toUpperCase()}</span></div>
              </>
            )}
            {fee && <div className="review-row"><span>Fee (0.5%)</span><span>{formatCurrency(fee, 'INR')}</span></div>}
            <div className="review-row total"><span>Total</span><span>{formatCurrency((parseFloat(amount) + parseFloat(fee || 0)).toFixed(2), 'INR')}</span></div>
          </div>
          {error && <p className="error-text"><InfoIcon size={14} /> {error}</p>}
          <button data-testid="send-confirm" className="btn-primary" onClick={handleSend} disabled={loading}>
            {loading ? 'Sending...' : <><LockIcon size={16} /> Confirm & Send</>}
          </button>
          <p className="send-footer-note"><ShieldIcon size={12} /> Secured with 256-bit encryption</p>
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
      <div data-testid="send-card" className="send-card">
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
              if (data.id) { setBeneficiaries([...beneficiaries, data]); setNewBen({ name: '', ifsc: '', accountNumber: '' }); setShowAddBeneficiary(false); }
            }} disabled={!newBen.name}>Save Recipient</button>
          </div>
        )}
        <div className="form-group">
          <label><GlobeIcon size={14} /> Recipient Name</label>
          <input data-testid="send-recipient" type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Recipient name" />
        </div>
        <div className="form-group">
          <label>Amount (balance: {formatCurrency(user.balance || 0, 'INR')})</label>
          <div className="amount-input">
            <span className="currency">₹</span>
            <input data-testid="send-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" min="1" />
          </div>
        </div>
        <div className="form-group">
          <label>Send as</label>
          <select data-testid="send-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
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
        <button data-testid="send-review" className="btn-primary" onClick={handleReview} disabled={!amount || !recipient}>
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
    const matchesSearch = !search || tx.recipient?.toLowerCase().includes(search.toLowerCase()) || tx.amount?.toString().includes(search) || tx.id?.toLowerCase().includes(search.toLowerCase());
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
        <input className="search-input" type="text" placeholder="Search by name, amount, or ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="filter-row">
        {['all', 'deposit', 'send'].map(f => (
          <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
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
                  <span className={`tx-icon ${tx.type}`}>{tx.type === 'deposit' ? <ReceiveIcon size={16} /> : <SendIcon size={16} />}</span>
                  <div className="tx-details">
                    <span className="tx-type">{tx.type}</span>
                    <span className="tx-recipient">{tx.recipient || '—'}</span>
                  </div>
                </div>
                <div className="tx-right">
                  <span className="tx-amount">{tx.type === 'deposit' ? '+' : '-'}{formatCurrency(tx.amount, 'INR')}</span>
                  {tx.status === 'failed' && <XCircleIcon size={14} />}
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
            <div className={`modal-tx-icon ${selectedTx.type}`}>{selectedTx.type === 'deposit' ? <ReceiveIcon size={24} /> : <SendIcon size={24} />}</div>
            <div className={`modal-amount ${selectedTx.type === 'deposit' ? 'positive' : 'negative'}`}>{selectedTx.type === 'deposit' ? '+' : '-'}{formatCurrency(selectedTx.amount, 'INR')}</div>
            <div className="modal-status"><span className={`tx-status ${selectedTx.status}`}>{selectedTx.status}</span></div>
            <div className="modal-details">
              <div className="modal-detail-row"><span>Type</span><span style={{ textTransform: 'capitalize' }}>{selectedTx.type}</span></div>
              <div className="modal-detail-row"><span>Date</span><span>{new Date(selectedTx.createdAt).toLocaleString('en-IN')}</span></div>
              {selectedTx.recipient && <div className="modal-detail-row"><span>{selectedTx.type === 'send' ? 'Recipient' : 'Sender'}</span><span>{selectedTx.recipient}</span></div>}
              <div className="modal-detail-row"><span>Transaction ID</span><span>{selectedTx.id?.slice(0, 16)}...</span></div>
              {selectedTx.stripeId && <div className="modal-detail-row"><span>Stripe ID</span><span>{selectedTx.stripeId}</span></div>}
              {selectedTx.razorpayId && <div className="modal-detail-row"><span>Razorpay ID</span><span>{selectedTx.razorpayId}</span></div>}
            </div>
            <a className="modal-link" href={`https://dashboard.stripe.com/payments/${selectedTx.stripeId || ''}`} target="_blank" rel="noopener noreferrer">
              <LinkIcon size={14} /> View on Stripe Dashboard
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsScreen({ user, onBack, onLogout, token, onKyc, onZk, onRefreshUser }) {
  const { t, i18n: i18nInst } = useTranslation();
  const [showBalance, setShowBalance] = useState(() => localStorage.getItem('showBalance') !== 'false');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') !== 'false');
  const [notifSend, setNotifSend] = useState(() => localStorage.getItem('notifSend') !== 'false');
  const [notifDeposit, setNotifDeposit] = useState(() => localStorage.getItem('notifDeposit') !== 'false');
  const [phone, setPhone] = useState(() => localStorage.getItem('phone') || '');
  const [waEnabled, setWaEnabled] = useState(() => localStorage.getItem('waEnabled') === 'true');
  const [savingWA, setSavingWA] = useState(false);
  const [waStatus, setWaStatus] = useState('');
  const [privacyPin, setPrivacyPin] = useState(() => localStorage.getItem('privacyPin') === 'true');
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [totpQr, setTotpQr] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpStep, setTotpStep] = useState('idle');
  const [totpErr, setTotpErr] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState([]);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [webauthnCreds, setWebauthnCreds] = useState([]);
  const [waLoading, setWaLoading] = useState(false);
  const [settingsUnlocked, setSettingsUnlocked] = useState(() => {
    const saved = localStorage.getItem('totpSession');
    if (saved) { try { const s = JSON.parse(saved); if (s.expiresAt > Date.now()) return true; } catch {} }
    return !user.totpEnabled;
  });
  const [settingsTotpCode, setSettingsTotpCode] = useState('');
  const [settingsTotpErr, setSettingsTotpErr] = useState('');

  // Spending limit
  const [sendLimitInput, setSendLimitInput] = useState(user.sendLimit || 100000);
  const [sendLimitSaving, setSendLimitSaving] = useState(false);
  const [sendLimitStatus, setSendLimitStatus] = useState('');

  // Device management
  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(true);

  // Auto-lock
  const [autoLockTimer, setAutoLockTimer] = useState(() => localStorage.getItem('autoLockTimer') || 'off');

  // Account management
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user.name || '');

  const loadWebauthnCreds = async () => {
    try { const d = await apiFetch('/webauthn/credentials', token); setWebauthnCreds(d.credentials); } catch {}
  };
  useEffect(() => { loadWebauthnCreds(); }, [token]);

  // TOTP unlock for settings page
  const unlockSettings = async () => {
    setSettingsTotpErr('');
    try {
      const d = await apiFetch('/totp/verify', token, { method: 'POST', body: JSON.stringify({ token: settingsTotpCode }) });
      const session = { totpToken: d.totpToken, verified: true, expiresAt: Date.now() + 3600000 };
      localStorage.setItem('totpSession', JSON.stringify(session));
      setSettingsUnlocked(true);
    } catch (e) {
      setSettingsTotpErr(e.message);
    }
  };

  useEffect(() => {
    apiFetch('/device/fingerprints', token).then(d => { setDevices(d.devices || []); setDevicesLoading(false); }).catch(() => setDevicesLoading(false));
  }, [token]);

  const startTotpSetup = async () => {
    setTotpLoading(true); setTotpErr('');
    try { const d = await apiFetch('/totp/setup', token, { method: 'POST' }); setTotpQr(d.qrDataUrl); setTotpStep('verify'); setTotpCode(''); } catch (e) { setTotpErr(e.message); }
    setTotpLoading(false);
  };
  const verifyTotpEnable = async () => {
    setTotpLoading(true); setTotpErr('');
    try {
      const d = await apiFetch('/totp/verify-enable', token, { method: 'POST', body: JSON.stringify({ token: totpCode }) });
      setTotpStep('idle'); setTotpQr(''); setTotpCode('');
      if (d.backupCodes) { setBackupCodes(d.backupCodes); setShowBackupModal(true); }
      onRefreshUser();
    } catch (e) { setTotpErr(e.message); }
    setTotpLoading(false);
  };
  const disableTotp = async () => {
    setTotpLoading(true); setTotpErr('');
    try { await apiFetch('/totp/disable', token, { method: 'POST', body: JSON.stringify({ token: totpCode }) }); setTotpStep('idle'); setTotpQr(''); onRefreshUser(); } catch (e) { setTotpErr(e.message); }
    setTotpLoading(false);
  };
  const registerBiometric = async () => {
    setWaLoading(true);
    try {
      const opts = await apiFetch('/webauthn/register/begin', token, { method: 'POST' });
      const attResp = await startRegistration(opts);
      await apiFetch('/webauthn/register/complete', token, { method: 'POST', body: JSON.stringify({ ...attResp, deviceName: navigator.userAgent?.slice(0, 64) || 'Unknown' }) });
      await loadWebauthnCreds();
    } catch (e) { setTotpErr(e.message || 'Biometric registration failed'); }
    setWaLoading(false);
  };
  const removeCredential = async (id) => {
    try { await apiFetch(`/webauthn/credentials/${id}`, token, { method: 'DELETE' }); await loadWebauthnCreds(); onRefreshUser(); } catch {}
  };

  const toggleBool = (key, setter) => {
    const next = !JSON.parse(localStorage.getItem(key) ?? (key === 'privacyPin' ? 'false' : 'true'));
    setter(next);
    localStorage.setItem(key, next);
    if (key === 'darkMode') {
      document.documentElement.setAttribute('data-theme', next ? '' : 'light');
      if (next) document.documentElement.removeAttribute('data-theme');
    }
  };

  const faqItems = [
    { qKey: 'faq1Q', aKey: 'faq1A' },
    { qKey: 'faq2Q', aKey: 'faq2A' },
    { qKey: 'faq3Q', aKey: 'faq3A' },
    { qKey: 'faq4Q', aKey: 'faq4A' },
    { qKey: 'faq5Q', aKey: 'faq5A' },
  ];

  const fmtIST = (d) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const joinedDate = user.createdAt ? fmtIST(user.createdAt) : 'N/A';
  const lastLoginDate = user.lastLogin ? fmtIST(user.lastLogin) : 'N/A';

  const saveSendLimit = async () => {
    setSendLimitSaving(true); setSendLimitStatus('');
    try {
      await apiFetch('/auth/send-limit', token, { method: 'PUT', body: JSON.stringify({ sendLimit: parseInt(sendLimitInput) }) });
      setSendLimitStatus(t('saved')); onRefreshUser();
    } catch { setSendLimitStatus(t('error')); }
    setSendLimitSaving(false);
  };

  const saveName = async () => {
    try {
      await apiFetch('/auth/profile', token, { method: 'PUT', body: JSON.stringify({ name: nameInput }) });
      setEditingName(false); onRefreshUser();
    } catch {}
  };

  const deleteAccount = async () => {
    try { await apiFetch('/auth/delete-account', token, { method: 'POST' }); onLogout(); } catch {}
  };

  const Toggle = ({ checked, onChange }) => (
    <label className="settings-toggle">
      <div className={`settings-toggle-track ${checked ? 'active' : ''}`}>
        <div className="settings-toggle-thumb" />
        <input type="checkbox" checked={checked} onChange={onChange} hidden />
      </div>
    </label>
  );

  return (
    <div className="dashboard page-enter">
      <header className="dash-header">
        <button className="btn-ghost" onClick={onBack}><ArrowLeftIcon size={16} /> {t('back')}</button>
        <h3>{t('settingsTitle')}</h3>
        <div />
      </header>

      {user.totpEnabled && !settingsUnlocked ? (
        <div className="balance-card">
          <div className="totp-unlock">
            <p className="totp-unlock-desc">{t('totpUnlockDesc')}</p>
            <input
              className="settings-input otp-input"
              type="text"
              maxLength={6}
              value={settingsTotpCode}
              onChange={e => setSettingsTotpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
            />
            {settingsTotpErr && <p className="error-text">{settingsTotpErr}</p>}
            <button className="btn-primary" onClick={unlockSettings} disabled={settingsTotpCode.length !== 6}>
              {t('unlockSettings')}
            </button>
          </div>
        </div>
      ) : (
      <>


      {/* Profile Card */}
      <div className="settings-section">
        <div className="settings-card">
          <div className="settings-avatar"><BitcoinIcon size={32} /></div>
          <div className="settings-user-info">
            <span className="settings-email">{user.name || user.email || 'User'}</span>
            <span className="settings-email-sub">{user.email}</span>
            <span className="settings-id">{t('id')}: {user.userId?.slice(0, 12)}...</span>
          </div>
          <div className="settings-profile-details">
            {user.name && <div className="settings-detail-row"><ContactsIcon size={14} /><span>{user.name}</span></div>}
            {user.aadhaarMasked && <div className="settings-detail-row"><FingerprintIcon size={14} /><span>{user.aadhaarMasked}</span></div>}
            {user.panMasked && <div className="settings-detail-row"><FileIcon size={14} /><span>{user.panMasked}</span></div>}
            {user.verifiedDob && <div className="settings-detail-row"><ClockIcon size={14} /><span>{user.verifiedDob}</span></div>}
            {user.verifiedAddress && <div className="settings-detail-row"><HomeIcon size={14} /><span>{user.verifiedAddress}</span></div>}
          </div>
        </div>
      </div>

      {/* KYC */}
      <div className="settings-section">
        <h4 className="settings-section-title">{t('security')}</h4>
        <div className="settings-card">
          <div className="settings-row" style={{ cursor: 'pointer' }} onClick={onKyc}>
            <div className="settings-row-left">
              <ShieldIcon size={18} />
              <div>
                <span className="settings-row-label">{t('kycStatus')}</span>
                <span className="settings-row-value">{user.kyc === 'verified' ? t('verified') : t('kycPending')}</span>
              </div>
            </div>
            <span className={`settings-badge ${user.kyc === 'verified' ? 'verified' : 'pending'}`}>
              {user.kyc === 'verified' ? '✓' : '→'}
            </span>
          </div>
          <div className="settings-row" style={{ cursor: 'pointer' }} onClick={onZk}>
            <div className="settings-row-left">
              <VerifyIcon size={18} />
              <div>
                <span className="settings-row-label">Privacy & Verification</span>
                <span className="settings-row-value">ZK proofs for age & country</span>
              </div>
            </div>
            <span className="settings-badge">{user.zkStatus?.ageVerified || user.zkStatus?.countryVerified ? '✓' : '→'}</span>
          </div>
          <div className="settings-row">
            <div className="settings-row-left">
              <LockIcon size={18} />
              <div>
                <span className="settings-row-label">{t('encryption')}</span>
                <span className="settings-row-value">{t('aes256')}</span>
              </div>
            </div>
            <span className="settings-badge verified">✓</span>
          </div>
        </div>
      </div>

      {/* Security Checklist */}
      <div className="settings-section">
        <h4 className="settings-section-title">{t('securityChecklist')}</h4>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-left">
              <ShieldIcon size={18} />
              <div><span className="settings-row-label">{t('kycStatus')}</span><span className="settings-row-value">{user.kyc === 'verified' ? t('verified') : t('unverified')}</span></div>
            </div>
            <span className={`settings-badge ${user.kyc === 'verified' ? 'verified' : ''}`}>{user.kyc === 'verified' ? '✓' : '—'}</span>
          </div>
          <div className="settings-row">
            <div className="settings-row-left">
              <KeyIcon size={18} />
              <div><span className="settings-row-label">{t('totpTitle')}</span><span className="settings-row-value">{user.totpEnabled ? t('enabled') : t('disabled')}</span></div>
            </div>
            <span className={`settings-badge ${user.totpEnabled ? 'verified' : ''}`}>{user.totpEnabled ? '✓' : '—'}</span>
          </div>
          <div className="settings-row">
            <div className="settings-row-left">
              <FingerprintIcon size={18} />
              <div><span className="settings-row-label">{t('biometric')}</span><span className="settings-row-value">{webauthnCreds.length > 0 ? `${webauthnCreds.length} ${t('registeredDevices')}` : t('disabled')}</span></div>
            </div>
            <span className={`settings-badge ${webauthnCreds.length > 0 ? 'verified' : ''}`}>{webauthnCreds.length > 0 ? '✓' : '—'}</span>
          </div>
          <div className="settings-row">
            <div className="settings-row-left">
              <MailIcon size={18} />
              <div><span className="settings-row-label">{t('emailVerified')}</span><span className="settings-row-value">{user.emailVerified ? t('verified') : t('unverified')}</span></div>
            </div>
            <span className={`settings-badge ${user.emailVerified ? 'verified' : ''}`}>{user.emailVerified ? '✓' : '—'}</span>
          </div>
        </div>
      </div>

      {/* TOTP */}
      <div className="settings-section">
        <h4 className="settings-section-title">{t('totpTitle')}</h4>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-left">
              <KeyIcon size={18} />
              <div>
                <span className="settings-row-label">{t('totpTitle')}</span>
                <span className="settings-row-value">{user.totpEnabled ? t('totpEnabled') : t('off')}</span>
              </div>
            </div>
            <span className={`settings-badge ${user.totpEnabled ? 'verified' : ''}`}>
              {user.totpEnabled ? '✓' : '—'}
            </span>
          </div>
          {totpStep === 'verify' && totpQr && (
            <div className="settings-expanded">
              {totpErr && <p className="error-text">{totpErr}</p>}
              <p className="settings-row-value">{t('scanQrCode')}</p>
              <div className="totp-qr-wrap"><img src={totpQr} alt="TOTP QR" /></div>
              <input className="settings-input otp-input" type="text" maxLength={6} value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
              <button className="btn-primary" onClick={verifyTotpEnable} disabled={totpLoading || totpCode.length !== 6}>
                {totpLoading ? t('loading') : t('verifyTotp')}
              </button>
            </div>
          )}
          {totpStep === 'disable' && (
            <div className="settings-expanded">
              {totpErr && <p className="error-text">{totpErr}</p>}
              <p className="settings-row-value">{t('disableTotpConfirm')}</p>
              <input className="settings-input otp-input" type="text" maxLength={6} value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
              <button className="btn-secondary" onClick={disableTotp} disabled={totpLoading || totpCode.length !== 6} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                {totpLoading ? t('loading') : t('disableTotp')}
              </button>
            </div>
          )}
          {totpStep === 'idle' && !user.totpEnabled && (
            <div className="settings-expanded">
              <p className="settings-row-value">{t('totpDesc')}</p>
              <button className="btn-primary" onClick={startTotpSetup} disabled={totpLoading}>
                {totpLoading ? t('loading') : t('setupTotp')}
              </button>
            </div>
          )}
          {user.totpEnabled && totpStep === 'idle' && (
            <div className="settings-expanded">
              <p className="settings-row-value"><CheckIcon size={14} /> {t('totpEnabled')}</p>
              <button className="btn-secondary" onClick={() => setTotpStep('disable')}>{t('disableTotp')}</button>
            </div>
          )}
        </div>
      </div>

      {/* Backup Codes Modal */}
      {showBackupModal && (
        <div className="settings-section">
          <div className="settings-card" style={{ border: '1px solid var(--warning)' }}>
            <h4 className="settings-section-title" style={{ color: 'var(--warning)' }}>{t('backupCodesTitle')}</h4>
            <p className="settings-row-value" style={{ marginBottom: 'var(--sp-8)' }}>{t('backupCodesWarning')}</p>
            <div className="backup-codes-grid">
              {backupCodes.map((code, i) => (
                <span key={i} className="backup-code">{code}</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-8)', marginTop: 'var(--sp-12)' }}>
              <button className="btn-secondary" onClick={() => { navigator.clipboard.writeText(backupCodes.join('\n')); }}>
                {t('copyAll')}
              </button>
              <button className="btn-secondary" onClick={() => {
                const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                a.download = 'sendly-backup-codes.txt'; a.click();
              }}>
                {t('download')}
              </button>
            </div>
            <button className="btn-primary" style={{ marginTop: 'var(--sp-12)' }} onClick={() => { setShowBackupModal(false); setBackupCodes([]); }}>
              {t('backupCodesSaved')}
            </button>
          </div>
        </div>
      )}

      {/* Biometric */}
      <div className="settings-section">
        <h4 className="settings-section-title">{t('biometricTitle')}</h4>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-left">
              <FingerprintIcon size={18} />
              <div>
                <span className="settings-row-label">{t('biometricTitle')}</span>
                <span className="settings-row-value">{webauthnCreds.length > 0 ? `${webauthnCreds.length} ${t('registeredDevices')}` : t('noBiometrics')}</span>
              </div>
            </div>
          </div>
          <div className="settings-expanded">
            {webauthnCreds.length > 0 && (
              <div className="webauthn-list">
                {webauthnCreds.map(c => (
                  <div key={c.id} className="webauthn-row">
                    <span className="settings-row-value">{c.deviceName || t('deviceName')}</span>
                    <button className="btn-link" style={{ color: 'var(--danger)' }} onClick={() => removeCredential(c.id)}>{t('removeDevice')}</button>
                  </div>
                ))}
              </div>
            )}
            <button className="btn-primary" onClick={registerBiometric} disabled={waLoading}>
              {waLoading ? t('loading') : t('addBiometric')}
            </button>
          </div>
        </div>
      </div>

      {/* Spending Limit */}
      <div className="settings-section">
        <h4 className="settings-section-title">{t('spendingLimit')}</h4>
        <div className="settings-card">
          <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 'var(--sp-8)' }}>
            <div className="settings-row-left">
              <div><span className="settings-row-label">{t('spendingLimit')}</span><span className="settings-row-value">{t('spendingLimitDesc')}</span></div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-8)' }}>
              <input className="settings-input" type="number" min="500" max="500000" step="1000" value={sendLimitInput} onChange={e => setSendLimitInput(e.target.value)} style={{ flex: 1 }} />
              <button className="settings-save-btn" onClick={saveSendLimit} disabled={sendLimitSaving} style={{ width: 'auto', padding: 'var(--sp-8) var(--sp-16)' }}>
                {sendLimitSaving ? t('loading') : sendLimitStatus || t('saveLimit')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Device Management */}
      <div className="settings-section">
        <h4 className="settings-section-title">{t('deviceManagement')}</h4>
        <div className="settings-card">
          {devicesLoading ? (
            <div className="settings-row"><span className="settings-row-value">{t('loading')}</span></div>
          ) : devices.length === 0 ? (
            <div className="settings-row"><span className="settings-row-value">{t('noDevices')}</span></div>
          ) : (
            devices.map((d, i) => (
              <div key={d.hash || i} className="settings-device-row">
                <span className="settings-device-hash">{d.hash?.slice(0, 16)}...</span>
                <span className="settings-device-date">{t('firstSeen')}: {new Date(d.firstSeen).toLocaleDateString()}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* General */}
      <div className="settings-section">
        <h4 className="settings-section-title">{t('general')}</h4>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-left">
              {darkMode ? <MoonIcon size={18} /> : <SunIcon size={18} />}
              <div>
                <span className="settings-row-label">{t('darkMode')}</span>
                <span className="settings-row-value">{darkMode ? t('on') : t('off')}</span>
              </div>
            </div>
            <Toggle checked={darkMode} onChange={() => toggleBool('darkMode', setDarkMode)} />
          </div>
          <div className="settings-row" style={{ cursor: 'pointer' }} onClick={() => {
            const langs = ['en', 'hi', 'es', 'fr', 'ar'];
            const idx = langs.indexOf(i18nInst.language);
            const next = langs[(idx + 1) % langs.length];
            i18nInst.changeLanguage(next);
            localStorage.setItem('lang', next);
          }}>
            <div className="settings-row-left">
              <GlobeIcon size={18} />
              <div>
                <span className="settings-row-label">{t('language')}</span>
                <span className="settings-row-value">{{ en: 'English', hi: 'हिन्दी', es: 'Español', fr: 'Français', ar: 'العربية' }[i18nInst.language] || 'English'}</span>
              </div>
            </div>
            <ArrowRightIcon size={16} />
          </div>
          <div className="settings-row">
            <div className="settings-row-left">
              <BitcoinIcon size={18} />
              <div>
                <span className="settings-row-label">{t('currency')}</span>
                <span className="settings-row-value">{t('inr')}</span>
              </div>
            </div>
            <ArrowRightIcon size={16} />
          </div>
        </div>
      </div>

      {/* Fees */}
      <div className="settings-section">
        <h4 className="settings-section-title">{t('fees')}</h4>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-left">
              <SendIcon size={18} />
              <div><span className="settings-row-label">{t('send')}</span><span className="settings-row-value">{t('sendFee')}</span></div>
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-left">
              <ReceiveIcon size={18} />
              <div><span className="settings-row-label">{t('deposit')}</span><span className="settings-row-value">{t('depositFee')}</span></div>
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-left">
              <BankIcon size={18} />
              <div><span className="settings-row-label">{t('expressDelivery')}</span><span className="settings-row-value">{t('expressFee')}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy */}
      <div className="settings-section">
        <h4 className="settings-section-title">{t('privacy')}</h4>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-left">
              <EyeIcon size={18} />
              <div><span className="settings-row-label">{t('showBalance')}</span><span className="settings-row-value">{t('showBalanceDesc')}</span></div>
            </div>
            <Toggle checked={showBalance} onChange={() => toggleBool('showBalance', setShowBalance)} />
          </div>
          <div className="settings-row">
            <div className="settings-row-left">
              <FingerprintIcon size={18} />
              <div><span className="settings-row-label">{t('privacyPin')}</span><span className="settings-row-value">{t('privacyPinDesc')}</span></div>
            </div>
            <Toggle checked={privacyPin} onChange={() => toggleBool('privacyPin', setPrivacyPin)} />
          </div>
          <div className="settings-row">
            <div className="settings-row-left">
              <ClockIcon size={18} />
              <div><span className="settings-row-label">{t('autoLock')}</span><span className="settings-row-value">{t('autoLockDesc')}</span></div>
            </div>
            {user.totpEnabled ? (
              <select className="settings-select" style={{ width: 'auto', minWidth: 100 }} value={autoLockTimer} onChange={e => { const v = e.target.value; setAutoLockTimer(v); localStorage.setItem('autoLockTimer', v); }}>
                <option value="off">{t('autoLockOff')}</option>
                <option value="1">{t('autoLock1min')}</option>
                <option value="5">{t('autoLock5min')}</option>
                <option value="15">{t('autoLock15min')}</option>
              </select>
            ) : (
              <span className="settings-row-value">{t('autoLockRequiresTotp')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="settings-section">
        <h4 className="settings-section-title">{t('account')}</h4>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-left">
              <InfoIcon size={18} />
              <div><span className="settings-row-label">{t('joined')}</span><span className="settings-row-value">{joinedDate}</span></div>
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-left">
              <ClockIcon size={18} />
              <div><span className="settings-row-label">{t('lastLogin')}</span><span className="settings-row-value">{lastLoginDate}</span></div>
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-left">
              <ContactsIcon size={18} />
              <div><span className="settings-row-label">{t('fullName')}</span><span className="settings-row-value">{user.name || '—'}</span></div>
            </div>
            <button className="btn-link" onClick={() => { setNameInput(user.name || ''); setEditingName(!editingName); }}>{t('editName')}</button>
          </div>
          {editingName && (
            <div className="settings-expanded">
              <input className="settings-input" type="text" value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder={t('fullName')} />
              <button className="settings-save-btn" onClick={saveName} disabled={!nameInput}>{t('saveName')}</button>
            </div>
          )}
          <div className="settings-row">
            <div className="settings-row-left">
              <ExitIcon size={18} style={{ color: 'var(--danger)' }} />
              <div><span className="settings-row-label" style={{ color: 'var(--danger)' }}>{t('deleteAccount')}</span></div>
            </div>
            <button className="btn-link" style={{ color: 'var(--danger)' }} onClick={() => setShowDeleteConfirm(true)}>{t('deleteAccountBtn')}</button>
          </div>
          {showDeleteConfirm && (
            <div className="settings-expanded">
              <p className="settings-danger-text">{t('deleteAccountConfirm')}</p>
              <button className="settings-delete-btn" onClick={deleteAccount}>{t('deleteAccountBtn')}</button>
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>{t('cancel')}</button>
            </div>
          )}
        </div>
      </div>

      {/* Notifications */}
      <div className="settings-section">
        <h4 className="settings-section-title">{t('notifications')}</h4>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-left">
              <SendIcon size={18} />
              <div><span className="settings-row-label">{t('sendAlerts')}</span><span className="settings-row-value">{t('sendAlertsDesc')}</span></div>
            </div>
            <Toggle checked={notifSend} onChange={() => toggleBool('notifSend', setNotifSend)} />
          </div>
          <div className="settings-row">
            <div className="settings-row-left">
              <ReceiveIcon size={18} />
              <div><span className="settings-row-label">{t('depositAlerts')}</span><span className="settings-row-value">{t('depositAlertsDesc')}</span></div>
            </div>
            <Toggle checked={notifDeposit} onChange={() => toggleBool('notifDeposit', setNotifDeposit)} />
          </div>
        </div>
      </div>

      {/* WhatsApp */}
      <div className="settings-section">
        <h4 className="settings-section-title">{t('whatsapp')}</h4>
        <div className="settings-card">
          <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 'var(--sp-8)' }}>
            <div className="settings-row-left">
              <div style={{ flex: 1 }}><span className="settings-row-label">{t('phoneNumber')}</span><span className="settings-row-value">{t('phoneHint')}</span></div>
            </div>
            <input className="settings-input" type="tel" placeholder="+919876543210" value={phone} onChange={e => { setPhone(e.target.value); localStorage.setItem('phone', e.target.value); }} />
          </div>
          <div className="settings-row">
            <div className="settings-row-left">
              <BellIcon size={18} />
              <div><span className="settings-row-label">{t('waAlerts')}</span><span className="settings-row-value">{t('waAlertsDesc')}</span></div>
            </div>
            <Toggle checked={waEnabled} onChange={() => { const next = !waEnabled; setWaEnabled(next); localStorage.setItem('waEnabled', next); }} />
          </div>
          <div className="settings-row">
            <button className="settings-save-btn" onClick={async () => {
              setSavingWA(true); setWaStatus('');
              try { await apiFetch('/notifications/prefs', token, { method: 'POST', body: JSON.stringify({ phone, notifyWhatsApp: waEnabled }) }); setWaStatus(t('saved')); } catch { setWaStatus(t('error')); }
              setSavingWA(false);
            }}>{savingWA ? t('saving') : waStatus || t('save')}</button>
          </div>
        </div>
      </div>

      {/* Support */}
      <div className="settings-section">
        <h4 className="settings-section-title">{t('support')}</h4>
        <div className="settings-card">
          {faqItems.map((item, i) => (
            <div key={i} className="settings-row settings-row-faq" onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}>
              <div className="settings-row-left">
                <QuestionCircleIcon size={18} />
                <div className="settings-faq-content">
                  <span className="settings-row-label">{t(item.qKey)}</span>
                  {expandedFaq === i && <span className="settings-row-value settings-faq-answer">{t(item.aKey)}</span>}
                </div>
              </div>
              <ChevronDownIcon size={16} className={`settings-faq-chevron ${expandedFaq === i ? 'open' : ''}`} />
            </div>
          ))}
          <a className="settings-row settings-btn" href="mailto:support@sendly.app" style={{ textDecoration: 'none' }}>
            <div className="settings-row-left">
              <InfoIcon size={18} />
              <div>
                <span className="settings-row-label">{t('emailSupport')}</span>
                <span className="settings-row-value">{t('emailSupportDesc')}</span>
              </div>
            </div>
            <ArrowRightIcon size={16} />
          </a>
        </div>
      </div>

      {/* About */}
      <div className="settings-section">
        <div className="settings-card">
          <div className="settings-row settings-row-about">
            <div className="settings-row-left">
              <InfoIcon size={18} />
              <div><span className="settings-row-label">{t('about')}</span><span className="settings-row-value">{t('aboutVersion')}</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-card">
          <button className="settings-row settings-btn" onClick={onLogout}>
            <div className="settings-row-left" style={{ color: 'var(--danger)' }}>
              <ExitIcon size={18} />
              <div><span className="settings-row-label" style={{ color: 'var(--danger)' }}>{t('logOut')}</span><span className="settings-row-value" style={{ color: 'var(--danger)' }}>{t('logOutDesc')}</span></div>
            </div>
            <ArrowRightIcon size={16} />
          </button>
          </div>
        </div>
      </>)}
    </div>
  );
}

export default function App() {
  const { t } = useTranslation();
  const [screen, setScreen] = useState('login');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [resetOobCode, setResetOobCode] = useState('');
  const [platformAuthAvail, setPlatformAuthAvail] = useState(null);

  useEffect(() => {
    const setDir = (lng) => { document.documentElement.dir = ['ar', 'he', 'fa', 'ur'].includes(lng) ? 'rtl' : 'ltr'; };
    setDir(i18n.language);
    i18n.on('languageChanged', setDir);
    return () => i18n.off('languageChanged', setDir);
  }, []);

  // ponytail: safari detects platform auth, chrome on macos doesn't
  useEffect(() => {
    PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable?.().then(setPlatformAuthAvail);
  }, []);

  // ponytail: check URL for password reset params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');
    if (mode === 'resetPassword' && oobCode) {
      setResetOobCode(oobCode);
      setScreen('resetPassword');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const t = await fbUser.getIdToken();
          setToken(t);
          const data = await apiFetch('/auth/verify', t, { method: 'POST' });
          setUser(data);
          setScreen('dashboard');
        } catch (err) {
          setAuthError(err.message);
          setScreen('login');
        }
      } else {
        setUser(null);
        setToken('');
        setScreen('login');
      }
      // ponytail: capture device fingerprint on login
      if (fbUser) {
        try {
          const fp = await FingerprintJS.load();
          const r = await fp.get();
          const t = await fbUser.getIdToken();
          apiFetch('/device/fingerprint', t, { method: 'POST', body: JSON.stringify({ hash: r.visitorId }) }).catch(() => {});
        } catch {}
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleGoogleLogin = async () => {
    setAuthError('');
    try { await signInWithPopup(auth, googleProvider); }
    catch (err) { if (err.code !== 'auth/popup-closed-by-user') setAuthError(err.message); }
  };

  const handleEmailLogin = async (email, password) => {
    setAuthError('');
    try {
      if (isSignUp) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (err) { setAuthError(err.message); }
  };

  const handleLogout = async () => {
    try { await signOut(auth); }
    catch (err) { setAuthError(err.message); }
  };

  const refreshUser = () => {
    apiFetch('/auth/verify', token, { method: 'POST' }).then(d => { setUser(d); setScreen('dashboard'); }).catch(() => setScreen('dashboard'));
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-logo"><BitcoinIcon size={32} /></div>
        <p className="loading-text">{t('loading')}</p>
      </div>
    );
  }

  switch (screen) {
    case 'login': return <LoginScreen onGoogleLogin={handleGoogleLogin} onEmailLogin={handleEmailLogin} isSignUp={isSignUp} setIsSignUp={setIsSignUp} error={authError} onForgotPassword={() => setScreen('forgotPassword')} />;
    case 'forgotPassword': return <ForgotPasswordScreen onBack={() => setScreen('login')} />;
    case 'resetPassword': return <ResetPasswordScreen oobCode={resetOobCode} onBack={() => setScreen('login')} />;
    case 'dashboard': return <DashboardScreen user={user} token={token} platformAuthAvail={platformAuthAvail} onSend={() => setScreen('send')} onDeposit={() => setScreen('deposit')} onHistory={() => setScreen('history')} onWallet={() => setScreen('wallet')} onClaim={() => setScreen('claim')} onSettings={() => setScreen('settings')} onKyc={() => setScreen('kyc')} onLogout={handleLogout} />;
    case 'kyc': return <KycScreen token={token} user={user} onBack={() => setScreen('settings')} onKycDone={refreshUser} />;
    case 'deposit': return <DepositScreen token={token} onBack={refreshUser} />;
    case 'send': return <SendScreen token={token} user={user} onBack={refreshUser} />;
    case 'history': return <HistoryScreen token={token} onBack={() => setScreen('dashboard')} />;
    case 'wallet': return <WalletScreen user={user} token={token} onBack={() => setScreen('dashboard')} onRemit={() => setScreen('remit')} onRecover={() => setScreen('recover')} />;
    case 'remit': return <RemitScreen user={user} token={token} onBack={() => setScreen('dashboard')} />;
    case 'claim': return <ClaimScreen user={user} token={token} onBack={() => setScreen('dashboard')} />;
    case 'recover': return <RecoveryScreen token={token} onBack={() => setScreen('wallet')} onRecovered={() => setScreen('wallet')} />;
    case 'zk': return <ZKScreen user={user} token={token} onBack={() => setScreen('settings')} />;
    case 'settings': return <SettingsScreen user={user} token={token} onBack={() => setScreen('dashboard')} onLogout={handleLogout} onKyc={() => setScreen('kyc')} onZk={() => setScreen('zk')} onRefreshUser={refreshUser} />;
    default: return <LoginScreen onGoogleLogin={handleGoogleLogin} onEmailLogin={handleEmailLogin} isSignUp={isSignUp} setIsSignUp={setIsSignUp} error={authError} onForgotPassword={() => setScreen('forgotPassword')} />;
  }
}
