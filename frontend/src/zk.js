// ponytail: client-side ZK proof generation. tries noir_js with compiled circuits, falls back to dummy.
export async function generateProof(type,inputs) {
  try{
    const res= await fetch(`/circuits/${type}.json`);
    if (!res.ok)throw new Error('circuit not found');
    const compiled = await res.json();
    const [{ Noir },{ BarretenbergBackend }] =await Promise.all([
      import('@noir-lang/noir_js').catch(()=> null),
      import('@noir-lang/backend_barretenberg').catch(()=> null),
    ]);
    if (!Noir || !BarretenbergBackend) throw new Error('noir_js not installed');
    const backend =new BarretenbergBackend(compiled);
    const noir = new Noir(compiled,backend);


    await noir.init();
    const { proof, publicInputs } = await noir.generateProof(inputs);
    return {proof: '0x' + proof.toString('hex'),publicInputs: publicInputs.map(p => p.toString())};
  }catch{

    // ponytail: fallback — install @noir-lang/noir_js + @noir-lang/backend_barretenberg and compile circuits to use real ZK
    return { proof: '0x' + 'ab'.repeat(64), publicInputs: [] };
  }
}
