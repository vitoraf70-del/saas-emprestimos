export const LOAN_PLANS = {
  500: { 4: 200, 6: 155, 8: 130 },
  700: { 4: 260, 6: 200, 8: 170 },
  1000: { 4: 355, 6: 275, 8: 235 }
} as const;

export const LOAN_AMOUNTS = [500, 700, 1000] as const;
export const LOAN_INSTALLMENTS = [4, 6, 8] as const;

export type LoanAmount = (typeof LOAN_AMOUNTS)[number];
export type LoanInstallments = (typeof LOAN_INSTALLMENTS)[number];

export function isValidLoanAmount(value: number): value is LoanAmount {
  return LOAN_AMOUNTS.includes(value as LoanAmount);
}

export function isValidInstallments(value: number): value is LoanInstallments {
  return LOAN_INSTALLMENTS.includes(value as LoanInstallments);
}

export function getInstallmentValue(valor: LoanAmount, parcelas: LoanInstallments) {
  return LOAN_PLANS[valor][parcelas];
}
