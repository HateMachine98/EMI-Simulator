import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const loanProfilesAtom = atomWithStorage("emi-studio-loan-profiles", {});
export const themeAtom = atomWithStorage("emi-studio-theme", "dark");

export const defaultLoan = {
  currentEmi: 40174,
  balanceTenure: 123,
  annualRate: 8.85,
  principal: 3214278,
  scenarios: [40500, 41000, 41500],
};
