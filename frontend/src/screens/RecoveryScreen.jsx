import { useState } from 'react';
import { ArrowLeftIcon, KeyIcon, InfoIcon } from '@bitcoin-design/bitcoin-icons-react/outline';

const API = import.meta.env.VITE_API_URL;

export default function RecoveryScreen({token, onBack, onRecovered }){
  const[backupShare,setBackupShare] =useState('');
  const [loading, setLoading]= useState(false);
  const [error, setError] = useState('');
  const[done,setDone]=useState(false);

  const handleRecover= async()=> {


    if (!backupShare)return;
    setLoading(true); setError('');
    try {
      const res =await fetch(`${API}/recover-wallet`, {

        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({backupShare }),
      });
      const data =await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone(true);
      onRecovered(data.walletAddress);


    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  if (done) {
    return (
      <div className="success-screen page-enter">
        <div className="success-card">
          <div className="success-icon">✓</div>
          <h2>Wallet Recovered</h2>
          <p>Your wallet has been restored. Use the Wallet screen to view balances and send funds.</p>
          <button className="btn-primary" onClick={onBack}>Go to Wallet</button>
        </div>
      </div>
    );
  }



  return (
    <div className="dashboard page-enter">
      <header className="dash-header">
        <button className="btn-ghost" onClick={onBack}><ArrowLeftIcon size={16} /> Back</button>
        <h3>Recover Wallet</h3>
        <div />
      </header>

      <div className="send-card">
        <div className="form-group">
          <label>Backup Share</label>
          <textarea
            value={backupShare}
            onChange={e => setBackupShare(e.target.value)}
            placeholder="Paste your backup recovery share here"
            rows={4}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, padding: 'var(--sp-12)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)' }}
          />
        </div>

        {error && <p className="error-text"><InfoIcon size={14} />{error}</p>}

        <button className="btn-primary" onClick={handleRecover} disabled={loading || !backupShare}>
          {loading ? 'Recovering...' : <><KeyIcon size={16}/> Recover Wallet</>}
        </button>
      </div>
    </div>
  );
}

