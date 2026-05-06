export function getSavedPlan() {
  try {
    const storedUser = JSON.parse(localStorage.getItem('bb_user') || '{}');
    return localStorage.getItem('bb_plan') || storedUser.plan || 'free';
  } catch {
    return localStorage.getItem('bb_plan') || 'free';
  }
}

export function getPlanRules(plan = getSavedPlan()) {
  if (plan === 'pro') {
    return {
      plan,
      watchlistLimit: Infinity,
      alertKinds: ['price', 'news', 'technical'],
      newsAnalysis: 'full',
      showNewsSentiment: true,
      showSignalFactors: true,
      eftDailyLimit: 250000,
      billyTransferLimit: null,
      billyAnalyst: true,
    };
  }

  if (plan === 'plus') {
    return {
      plan,
      watchlistLimit: Infinity,
      alertKinds: ['price', 'news'],
      newsAnalysis: 'plus',
      showNewsSentiment: true,
      showSignalFactors: false,
      eftDailyLimit: 75000,
      billyTransferLimit: 1000000,
      billyAnalyst: false,
    };
  }

  return {
    plan: 'free',
    watchlistLimit: 1,
    alertKinds: ['price'],
    newsAnalysis: 'basic',
    showNewsSentiment: false,
    showSignalFactors: false,
    eftDailyLimit: 10000,
    billyTransferLimit: 100000,
    billyAnalyst: false,
  };
}
