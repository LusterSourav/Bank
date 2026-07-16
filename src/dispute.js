// llm suggests, admin confirms
async function resolveDispute(escrowId) {
  const { Escrow}= await import('./models.js');
  const e=await Escrow.findOne({ escrowId});

  if (!e)throw new Error('escrow not found');

  // mvp — 50/50 split. llm later.
  return {
    suggestion: 'split_50',
    amount: e.amount / 2,
    note: `Escrow ${escrowId}: 50/50 split suggested. Review and call release() or refund().`,
  };
}
