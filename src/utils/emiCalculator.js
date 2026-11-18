export function simulateLoan(principal, annualRate, emi) {
  const P = Number(principal);
  const rate = Number(annualRate) / 1200;
  const payment = Number(emi);

  if (
    !Number.isFinite(P) ||
    P <= 0 ||
    !Number.isFinite(rate) ||
    rate < 0 ||
    !Number.isFinite(payment) ||
    payment <= 0
  ) {
    return { valid: false, paidOff: false };
  }

  const firstMonthInterest = P * rate;
  const firstMonthPrincipal = Math.max(
    0,
    Math.min(payment, P + firstMonthInterest) - firstMonthInterest,
  );
  if (payment <= firstMonthInterest + 1e-9) {
    return {
      valid: true,
      paidOff: false,
      firstMonthInterest,
      firstMonthPrincipal: 0,
      shortfall: firstMonthInterest - payment,
    };
  }

  let balance = P;
  let totalInterest = 0;
  let totalPaid = 0;
  let months = 0;
  let finalPayment = 0;

  // Hard cap protects the UI from pathological values.
  while (balance > 0.005 && months < 1200) {
    const interest = balance * rate;
    const amountDue = balance + interest;
    const actualPayment = Math.min(payment, amountDue);
    const principalPaid = actualPayment - interest;

    if (principalPaid <= 0) {
      return {
        valid: true,
        paidOff: false,
        firstMonthInterest,
        firstMonthPrincipal,
        shortfall: interest - actualPayment,
      };
    }

    balance = Math.max(0, balance - principalPaid);
    totalInterest += interest;
    totalPaid += actualPayment;
    months += 1;
    finalPayment = actualPayment;
  }

  if (balance > 0.005) {
    return {
      valid: true,
      paidOff: false,
      firstMonthInterest,
      exceededLimit: true,
    };
  }

  return {
    valid: true,
    paidOff: true,
    firstMonthInterest,
    firstMonthPrincipal,
    principalRepaid: P,
    interestToPrincipalRatio: totalInterest / P,
    months,
    totalInterest,
    totalPaid,
    finalPayment,
  };
}

export function compareScenarios(loan) {
  const current = simulateLoan(
    loan.principal,
    loan.annualRate,
    loan.currentEmi,
  );
  const scenarios = (loan.scenarios || []).map((emi) =>
    simulateLoan(loan.principal, loan.annualRate, emi),
  );

  return { current, scenarios };
}
