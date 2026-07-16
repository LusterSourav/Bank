import { useState, useEffect } from 'react';
import {useTranslation}from 'react-i18next';
import {ArrowLeftIcon, CheckIcon, ClockIcon} from '@bitcoin-design/bitcoin-icons-react/outline';

const API=import.meta.env.VITE_API_URL;

export default function ClaimScreen({token,user,onBack }){
  const { t } = useTranslation();
  const[escrows, setEscrows] =useState([]);
  const [loading, setLoading]= useState(true);

  useEffect(()=> {


    if (!user.walletAddress) return;
    // ponytail: query Escrow collection from backend — chain events are polled by watcher
    apiFetch('/escrows/pending').then(d => {setEscrows(d); setLoading(false); }).catch(()=> setLoading(false));
  }, [user.walletAddress]);

  async function apiFetch(path, opts = {}) {

    const res=await fetch(`${API}${path}`,{
      ...opts,
      headers:{ 'Content-Type': 'application/json', ...(token ?{Authorization: `Bearer ${token}`}:{}),...opts.headers },
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'request failed');
    return d;


  }

  const claim = async (escrowId) => {
    try {
      await apiFetch('/claim', {method: 'POST',body: JSON.stringify({ escrowId }) });
      setEscrows(prev => prev.filter(e => e.escrowId !== escrowId));
    } catch (e) { alert(e.message); }


  };

  return (
    <div className="dashboard page-enter">
      <header className="dash-header">
        <button className="btn-ghost" onClick={onBack}><ArrowLeftIcon size={16} /> Back</button>
        <h3>Claim Funds</h3>
        <div />
      </header>

      {loading && <p className="empty-state">Loading...</p>}

      {!loading && escrows.length === 0 && (
        <div className="empty-state"><ClockIcon size={16}/> <span>No pending escrows</span></div>
      )}

      <div className="tx-list">
        {escrows.map(e => (
          <div key={e.escrowId}className="tx-item">
            <div className="tx-info">
              <div className="tx-details">
                <span className="tx-type">Incoming</span>
                <span className="tx-recipient">{e.senderAddress?.slice(0, 10)}...</span>
              </div>
            </div>
            <div className="tx-right">
              <span className="tx-amount">${e.amount}</span>
              <button className="btn-primary" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => claim(e.escrowId)}>
                <CheckIcon size={14} /> Claim
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
