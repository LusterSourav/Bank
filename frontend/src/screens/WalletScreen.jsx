import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon, SendIcon, QrCodeIcon } from '@bitcoin-design/bitcoin-icons-react/outline';

const API = import.meta.env.VITE_API_URL;

export default function WalletScreen({ user, token, onBack, onRemit }) {
  const { t } = useTranslation();
  const [balance, setBalance] = useState('...');

  useEffect(() => {
    if (!user.walletAddress) return;
    const load = async () => {
      try {
        const { ethers } = window;
        const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_POLYGON_RPC);
        const abi = ['function balanceOf(address account) view returns (uint256)'];
        const contract = new ethers.Contract(import.meta.env.VITE_USDC_ADDRESS, abi, provider);
        const bal = await contract.balanceOf(user.walletAddress);
        setBalance(ethers.formatUnits(bal, 6));
      } catch { /* chain not reachable, keep placeholder */ }
    };
    load();
  }, [user.walletAddress]);

  return (
    <div className="dashboard page-enter">
      <header className="dash-header">
        <button className="btn-ghost" onClick={onBack}><ArrowLeftIcon size={16} /> {t('back')}</button>
        <h3>Wallet</h3>
        <div />
      </header>

      <div className="balance-card">
        <p className="balance-label">USDC</p>
        <h2 className="balance-amount">{balance}</h2>
      </div>

      <div className="balance-actions" style={{ justifyContent: 'center', gap: 12 }}>
        <button className="btn-primary" onClick={onRemit}>
          <SendIcon size={18} /> Send
        </button>
        {user.walletAddress && (
          <button className="btn-secondary" onClick={() => {
            navigator.clipboard.writeText(user.walletAddress);
          }}>
            <QrCodeIcon size={18} /> Copy Address
          </button>
        )}
      </div>

      {user.walletAddress && (
        <p className="wallet-address" style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)', marginTop: 12 }}>
          {user.walletAddress.slice(0, 10)}...{user.walletAddress.slice(-4)}
        </p>
      )}
    </div>
  );
}
