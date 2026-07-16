import { useState, useEffect } from 'react';
import { useTranslation} from 'react-i18next';
import{ArrowLeftIcon,SendIcon,QrCodeIcon} from '@bitcoin-design/bitcoin-icons-react/outline';

const API=import.meta.env.VITE_API_URL;
// ponytail: add new stablecoins here (address, decimals, label)
const TOKENS = [
  { addr: import.meta.env.VITE_USDC_ADDRESS, dec: 6, label: 'USDC' },
  {addr: import.meta.env.VITE_EURC_ADDRESS || '0x7f50786A2b2d42E0D2D5a2d5bCcfc8ACb5f5c5C5', dec: 6, label: 'EURC'},
];

export default function WalletScreen({ user,token, onBack, onRemit,onRecover }) {
  const{ t}=useTranslation();
  const [balances, setBalances] = useState({});

  useEffect(()=> {


    if (!user.walletAddress)return;
    const load = async () => {
      try{
        const{ethers}= window;

        const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_POLYGON_RPC);
        const abi = ['function balanceOf(address account) view returns (uint256)'];
        const bals = {};
        for (const tk of TOKENS) {
          try {


            const contract = new ethers.Contract(tk.addr, abi, provider);
            const bal = await contract.balanceOf(user.walletAddress);
            bals[tk.label]=ethers.formatUnits(bal, tk.dec);
          } catch { bals[tk.label] ='?'; }
        }
        setBalances(bals);


      }catch { /* chain not reachable */}
    };
    load();
  },[user.walletAddress]);

  return(
    <div className="dashboard page-enter">
      <header className="dash-header">
        <button className="btn-ghost" onClick={onBack}><ArrowLeftIcon size={16} /> {t('back')}</button>
        <h3>Wallet</h3>
        <div />
      </header>

      {TOKENS.filter(tk => balances[tk.label] !== undefined).map(tk => (
        <div className="balance-card" key={tk.label}>
          <p className="balance-label">{tk.label}</p>
          <h2 className="balance-amount">{balances[tk.label] ?? '...'}</h2>
        </div>
      ))}

      <div className="balance-actions" style={{ justifyContent: 'center', gap: 12 }}>
        <button className="btn-primary" onClick={onRemit}>
          <SendIcon size={18}/> Send
        </button>
        {user.walletAddress && (
          <button className="btn-secondary" onClick={()=> {
            navigator.clipboard.writeText(user.walletAddress);
          }}>
            <QrCodeIcon size={18}/> Copy Address
          </button>
        )}

      </div>

        {user.walletAddress && (
        <p className="wallet-address" style={{ textAlign: 'center', fontSize: 12,color: 'var(--text-secondary)',marginTop: 12}}>
          {user.walletAddress.slice(0, 10)}...{user.walletAddress.slice(-4)}
        </p>
      )}
      <div style={{textAlign: 'center',marginTop: 16}}>
        <button className="btn-ghost" onClick={onRecover}style={{fontSize: 12,color: 'var(--warning)'}}>
          Lost access? Recover wallet
        </button>
      </div>
    </div>
  );
}
