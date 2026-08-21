import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import RemitScreen from '../screens/RemitScreen.jsx';

vi.mock('../i18n.js', () => ({
  default: {
    use: () => ({ init: () => {} }),
    on: () => {},
    off: () => {},
    language: 'en',
    t: (key) => key,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
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

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

const props = {
  user: { uid: 'u1', phone: '+15550000000', name: 'Test User' },
  token: 'fake-jwt-token',
  onBack: vi.fn(),
};

describe('RemitScreen', () => {
  it('renders without crashing', () => {
    render(<RemitScreen {...props} />);
    expect(screen.getAllByTestId('icon').length).toBeGreaterThan(0);
  });
});
