# EMI Repay Simulator

A frontend-only React/Vite EMI comparison simulator.

## Run locally

```bash
npm install
npm run dev
```

Open the localhost URL printed by Vite.

## Production build

```bash
npm run build
npm run preview
```

## Included packages

- Vite + React
- IndexedDB for persistent, account-separated loan profiles, mirrored to per-account JSON in localStorage for fallback
- localStorage for demo account records and saved theme; sessionStorage for the active session
- ahooks for browser storage hooks
- Motion for React for transitions
- @mojs/core for the savings celebration burst
- @blobatar/react and Facehash for generated avatars
- @animateicons/react for the animated celebration icon
- Ding for accessible toast notifications
- jsPDF and jsPDF-AutoTable for downloadable EMI reports
- React Spinners for the short successful login/registration state

## Authentication warning

This is intentionally a local demonstration, not production authentication. Passwords are hashed in the browser with PBKDF2 and a per-user salt; plaintext passwords are not stored. Account records and hashes are stored separately from loan data, but can still be inspected, copied, or modified by someone with access to the device. Loan profiles are stored in IndexedDB (or localStorage when IndexedDB is unavailable). Nothing synchronizes across browsers or devices. Do not reuse a real password or use this for sensitive accounts. There is no server-side identity verification, recovery, rate limiting, or secure session management.

The public demo account is `dummytest` / `dummytest@test.com` with password `password01`. It is seeded locally on first use and can be shown from the login or registration screen. This credential is intentionally public and is not suitable for private data.

## Loan profiles and backups

Create and manage multiple named loans from the account menu. Each browser account has its own IndexedDB collection and a versioned JSON mirror; IndexedDB is preferred, with the JSON mirror used when no valid database record is available. The **JSON backup & restore** dialog includes template download, export, and import; import supports merging profiles or explicitly replacing the current local collection. A browser app cannot overwrite the static project files, so downloads are the supported way to create or edit JSON files on disk. Login activity is local informational metadata, not verified security evidence. PDF reports are generated from the currently visible loan values. Existing single-loan browser data is migrated to a `My Loan` profile when first loaded.

## Calculation assumptions

- Interest is calculated monthly on a reducing balance.
- Monthly rate = annual nominal rate / 1200.
- EMI is assumed to be paid at the end of each month.
- The final payment is reduced to the exact amount due.
- Calculations retain floating-point precision internally and round only for display.
- The stated remaining tenure is shown as a bank-statement reference. The calculated payoff tenure is derived from principal, annual rate, and EMI.
- Floating-rate changes, fees, insurance, daily interest conventions, and lender-specific rounding are not modelled.

## Download interaction

The PDF action opens an in-app file-retrieval animation and reports generation stages through Ding notifications while jsPDF creates the actual loan report. It does not embed an external animation demo or download sample content.
