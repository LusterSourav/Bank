//platform job verification connectors. returns true/false/null.
const FIVERR_API= 'https://api.fiverr.com/v1';

export const connectors={
  fiverr: async (jobId)=>{
    const key= process.env.FIVERR_API_KEY;
    if(!key) return null;
    const res=await fetch(`${FIVERR_API}/orders/${jobId}`,{
      headers:{Authorization: `Bearer ${key}`},
    });
    if(!res.ok)return null;


    const order=await res.json();
    return order.status === 'completed';
  },
};

export async function verifyJob(platform,jobId){
  const fn=connectors[platform];

  if(!fn)return null;
  try{ return await fn(jobId);}catch{return null;}

}
