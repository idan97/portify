/**
 * Buy-Only Rebalance Algorithm
 * 
 * Problem: You have existing holdings across asset classes and new cash to invest.
 * You never sell — only buy. How do you distribute the new cash to get as close
 * to target allocations as possible?
 * 
 * Algorithm (iterative proportional filling):
 * 1. Calculate the new total = sum(current values) + freeCash
 * 2. For each asset, compute ideal = newTotal * targetPercent
 * 3. Gap = ideal - currentValue. If gap <= 0, this asset is "over-allocated" — lock it (buy = 0)
 * 4. Distribute cash proportionally among assets with positive gaps
 * 5. But distributing changes the effective total for remaining assets,
 *    so we iterate: lock over-allocated assets and redistribute until stable
 * 6. If all assets are over-allocated, distribute remaining cash proportionally by target weight
 */

export function calculateBuyOnlyRebalance(assetClasses, freeCash) {
  if (!assetClasses || assetClasses.length === 0 || freeCash <= 0) {
    return { allocations: [], remainingCash: freeCash, totalAfter: 0 };
  }

  const assets = assetClasses.map(ac => ({
    id: ac.id,
    name: ac.name,
    color: ac.color,
    currentValue: ac.currentValue || 0,
    targetPercent: ac.target_percent || 0,
  }));

  const currentTotal = assets.reduce((sum, a) => sum + a.currentValue, 0);
  const newTotal = currentTotal + freeCash;
  
  // Track how much each asset gets
  const buyAmounts = {};
  assets.forEach(a => { buyAmounts[a.id] = 0; });

  let cashRemaining = freeCash;
  const locked = new Set(); // Assets that are over-allocated (don't buy more)
  
  // Iterate until stable (max 20 iterations as safety)
  for (let iteration = 0; iteration < 20 && cashRemaining > 0.01; iteration++) {
    // Calculate gaps for unlocked assets
    const gaps = [];
    let totalPositiveGap = 0;

    for (const asset of assets) {
      if (locked.has(asset.id)) continue;
      
      const currentWithBuys = asset.currentValue + buyAmounts[asset.id];
      const idealValue = newTotal * (asset.targetPercent / 100);
      const gap = idealValue - currentWithBuys;

      if (gap <= 0) {
        // This asset is already at or above target — lock it
        locked.add(asset.id);
        continue;
      }

      gaps.push({ id: asset.id, gap });
      totalPositiveGap += gap;
    }

    if (gaps.length === 0) {
      // All assets are at or above target. Distribute remaining cash by target weight.
      const totalTargetWeight = assets.reduce((sum, a) => sum + a.targetPercent, 0);
      if (totalTargetWeight > 0) {
        for (const asset of assets) {
          const share = (asset.targetPercent / totalTargetWeight) * cashRemaining;
          buyAmounts[asset.id] += share;
        }
      }
      cashRemaining = 0;
      break;
    }

    if (cashRemaining >= totalPositiveGap) {
      // We have enough cash to fill all gaps
      for (const { id, gap } of gaps) {
        buyAmounts[id] += gap;
        cashRemaining -= gap;
      }
      // After filling, some may become over-allocated in next iteration
    } else {
      // Not enough cash — distribute proportionally by gap size
      for (const { id, gap } of gaps) {
        const share = (gap / totalPositiveGap) * cashRemaining;
        buyAmounts[id] += share;
      }
      cashRemaining = 0;
    }
  }

  // Build result
  const allocations = assets.map(asset => {
    const buyAmount = buyAmounts[asset.id] || 0;
    const newValue = asset.currentValue + buyAmount;
    const newPercent = newTotal > 0 ? (newValue / newTotal) * 100 : 0;
    const currentPercent = newTotal > 0 ? (asset.currentValue / newTotal) * 100 : 0;

    return {
      id: asset.id,
      name: asset.name,
      color: asset.color,
      currentValue: asset.currentValue,
      currentPercent,
      targetPercent: asset.targetPercent,
      buyAmount: Math.round(buyAmount * 100) / 100,
      newValue,
      newPercent,
      gapFromTarget: asset.targetPercent - newPercent,
    };
  });

  return {
    allocations,
    remainingCash: Math.round(cashRemaining * 100) / 100,
    totalAfter: newTotal,
    totalBefore: currentTotal,
    cashInvested: freeCash - Math.round(cashRemaining * 100) / 100,
  };
}