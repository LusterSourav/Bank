import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon, ShieldIcon, CheckIcon } from '@bitcoin-design/bitcoin-icons-react/outline';

const API = import.meta.env.VITE_API_URL;

export default function ZKScreen({ token, user, onBack }) {
  const { t } = useTranslation();
  const [type, setType] = useState('');
  const [step, setStep] = useState('select'); // select | proving | done
  const [error, setError] = useState('');

  async function apiFetch(path, opts = {}) {
    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'request failed');
    return d;
  }

  // ponytail: stub — real NoirJS proving will happen here
  // the browser loads noir_wasm, takes the ID hash, generates Groth16 proof
  // for now we simulate with a dummy proof
  const startProof = async (proofType) => {
    setType(proofType);
    setStep('proving');
    setError('');

    try {
      // ponytail: placeholder — NoirJS integration in next sprint
      // const proof = await generateProof(proofType, idData);
      const dummyProof = '0x' + 'ab'.repeat(64);
      await apiFetch('/zk/verify', {
        method: 'POST',
        body: JSON.stringify({ proof: dummyProof, type: proofType }),
      });
      setStep('done');
    } catch (e) {
      setError(e.message);
      setStep('select');
    }
  };

  if (step === 'done') {
    return (
      <div className="success-screen page-enter">
        <div className="success-card">
          <div className="success-icon"><CheckIcon size={40} /></div>
          <h2>Verified!</h2>
          <p>Your {type} proof has been submitted and verified on-chain.</p>
          <button className="btn-primary" onClick={onBack}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard page-enter">
      <header className="dash-header">
        <button className="btn-ghost" onClick={onBack}><ArrowLeftIcon size={16} /> Back</button>
        <h3>ZK Verification</h3>
        <div />
      </header>

      <div className="kyc-card">
        {step === 'select' && (
          <>
            <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
              Prove your identity without sharing your documents. Select what to verify:
            </p>
            {error && <p className="error-text">{error}</p>}
            <button className="method-btn" style={{ marginBottom: 12 }} onClick={() => startProof('age')} disabled={user.zkStatus?.ageVerified}>
              <ShieldIcon size={24} /> {user.zkStatus?.ageVerified ? '✓ Age Verified' : 'Prove Age (18+)'}
            </button>
            <button className="method-btn" onClick={() => startProof('country')} disabled={user.zkStatus?.countryVerified}>
              <ShieldIcon size={24} /> {user.zkStatus?.countryVerified ? '✓ Country Verified' : 'Prove Country of Residence'}
            </button>
          </>
        )}
        {step === 'proving' && (
          <div className="empty-state">
            <p>Generating {type} proof...</p>
            <p style={{ fontSize: 12, marginTop: 8 }}>This runs in your browser — your data never leaves.</p>
          </div>
        )}
      </div>
    </div>
  );
}
