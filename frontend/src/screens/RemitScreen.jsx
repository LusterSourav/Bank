import{useState, useEffect}from 'react';
import{useTranslation}from 'react-i18next';
import{ArrowLeftIcon,SendIcon,InfoIcon,LockIcon}from '@bitcoin-design/bitcoin-icons-react/outline';
import{formatCurrency}from '../utils/formatCurrency';

const API= import.meta.env.VITE_API_URL;

export default function RemitScreen({token, user, onBack}) {
  const { t}= useTranslation();


  const[amount,setAmount]=useState('');

  const [receiver, setReceiver]=useState();


  const[rate,setRate]=useState(null);
  const [loading,setLoading]=useState(false);
  const[error,setError]=useState('');
  const[done,setDone]=useState(false);


  useEffect(() => {
    // fetches rate, fallback to 83.5 if API down
    apiFetch('/rate').then(d => setRate(d.rate)).catch(()=> setRate(83.5));
  },[]);

  async function apiFetch(path,opts={}){
    const res = await fetch(`${API}${path}`,{


      ...opts,
      headers:{ 'Content-Type': 'application/json',...(token ? {Authorization: `Bearer ${token}` }: {}),...opts.headers},
    });
    const d =await res.json();
    if(!res.ok)throw new Error(d.error || 'request failed');
    return d;
  }

  const converted = amount && rate ? (parseFloat(amount)/ rate).toFixed(2) : null;



  const handleSend = async()=>{
    if (!amount || !receiver) return;


    setLoading(true);setError('');
    try{
      const d=await apiFetch('/remit',{method: 'POST',body: JSON.stringify({receiverAddress: receiver,amount: parseFloat(amount)})});
      setDone(true);
    }catch(e){setError(e.message);}


    setLoading(false);

  };

  if(done){
    return(
      <div className="success-screen page-enter">
        <div className="success-card">
          <div className="success-icon">✓</div>
          <h2>Remittance Sent!</h2>
          <p>{formatCurrency(amount,'INR')} escrowed. Receiver can claim once verified.</p>
          <button className="btn-primary" onClick={onBack}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard page-enter">
      <header className="dash-header">
        <button className="btn-ghost" onClick={onBack}><ArrowLeftIcon size={16}/> Back</button>
        <h3>Send Cross-Border</h3>
        <div />
      </header>

      <div className="send-card">
        <div className="form-group">
          <label>Recipient Wallet Address</label>
          <input type="text" value={receiver}onChange={e => setReceiver(e.target.value)}placeholder="0x..." />
        </div>

        <div className="form-group">
          <label>Amount(INR)</label>
          <div className="amount-input">
            <span className="currency">₹</span>
            <input type="number" value={amount}onChange={e => setAmount(e.target.value)}placeholder="0.00" min="1" />
          </div>
        </div>

        {rate &&(
          <div className="forex-summary">
            <div className="forex-row"><span>Exchange rate</span><span>1 USD=₹{rate.toFixed(2)}</span></div>
            {converted && <div className="forex-row"><span>Receiver gets</span><span>${converted} USDC</span></div>}
          </div>
        )}


        {error && <p className="error-text"><InfoIcon size={14}/>{error}</p>}

        <button className="btn-primary" onClick={handleSend}disabled={loading || !amount || !receiver}>
          {loading ? 'Processing...' : <><LockIcon size={16}/> Send {formatCurrency(amount || 0,'INR')}</>}
        </button>
      </div>
    </div>
  );
}
