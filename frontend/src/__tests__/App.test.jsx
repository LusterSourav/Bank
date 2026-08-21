import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../firebase', () => ({
  auth: {},
  googleProvider: {},
}));

vi.mock('../i18n.js', () => ({
  default: {
    use: () => ({ init: () => {} }),
    on: () => {},
    off: () => {},
    language: 'en',
  },
}));

vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => Promise.resolve(null) }));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }) => children,
  PaymentElement: () => null,
  useStripe: () => null,
  useElements: () => null,
}));

vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: () => Promise.resolve({}),
  startAuthentication: () => Promise.resolve({}),
}));

vi.mock('@bitcoin-design/bitcoin-icons-react/outline', () => {
  const icon = (props) => <span data-testid="icon" {...props} />;
  return {
    BitcoinIcon: icon, SendIcon: icon, ReceiveIcon: icon, WalletIcon: icon,
    CheckIcon: icon, ArrowLeftIcon: icon, ArrowRightIcon: icon, GlobeIcon: icon,
    BankIcon: icon, CreditCardIcon: icon, ShieldIcon: icon, LockIcon: icon,
    LinkIcon: icon, ClockIcon: icon, GearIcon: icon, InfoIcon: icon,
    QuestionCircleIcon: icon, ExitIcon: icon, SearchIcon: icon, ContactsIcon: icon,
    KeyIcon: icon, FileIcon: icon, HomeIcon: icon, AlertCircleIcon: icon,
    QrCodeIcon: icon,
  };
});

vi.mock('../screens/WalletScreen', () => ({ default: () => <div data-testid="wallet" /> }));
vi.mock('../screens/RemitScreen', () => ({ default: () => <div data-testid="remit" /> }));
vi.mock('../screens/ClaimScreen', () => ({ default: () => <div data-testid="claim" /> }));
vi.mock('../screens/RecoveryScreen', () => ({ default: () => <div data-testid="recover" /> }));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, cb) => { cb(null); return () => {}; }),
  signInWithPopup: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  confirmPasswordReset: vi.fn(),
  verifyPasswordResetCode: vi.fn(),
}));

const { default: App } = await import('../App.jsx');

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/');
  localStorage.clear();
  window.__errorLog = [];
});

describe('App', () => {
  it('renders login screen when not authenticated', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('login-screen')).toBeInTheDocument();
    });
    expect(screen.getByTestId('login-email')).toBeInTheDocument();
    expect(screen.getByTestId('login-password')).toBeInTheDocument();
    expect(screen.getByTestId('login-submit')).toBeInTheDocument();
  });

  it('ErrorBoundary catches render errors', async () => {
    const { ErrorBoundary } = await import('../App.jsx');
    const Bad = () => { throw new Error('test boom'); };
    render(
      <ErrorBoundary>
        <Bad />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('test boom')).toBeInTheDocument();
  });
});
