import { defaultLoan } from "../store/atoms";

const DB_NAME = "emi-studio-data";
const DB_VERSION = 1;
const STORE_NAME = "user-loans";
const FALLBACK_PREFIX = "emi-studio-user-loans:";
const JSON_MIRROR_PREFIX = "emi-studio-user-loans-json:";
const LEGACY_KEY = "emi-studio-loan-profiles";
const pendingLoads = new Map();

function makeId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `loan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "userKey" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Could not open browser storage"));
    request.onblocked = () =>
      reject(new Error("Browser storage upgrade is blocked"));
  });
}

async function readIndexed(userKey) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get(userKey);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () =>
      reject(request.error || new Error("Could not read loan profiles"));
    db.onversionchange = () => db.close();
  });
}

async function writeIndexed(value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error || new Error("Could not save loan profiles"));
    transaction.onabort = () =>
      reject(transaction.error || new Error("Loan profile save was cancelled"));
    db.onversionchange = () => db.close();
  });
}

function fallbackKey(userKey) {
  return `${FALLBACK_PREFIX}${encodeURIComponent(userKey)}`;
}

function jsonMirrorKey(userKey) {
  return `${JSON_MIRROR_PREFIX}${encodeURIComponent(userKey)}`;
}

function readFallback(userKey) {
  try {
    return JSON.parse(
      localStorage.getItem(jsonMirrorKey(userKey)) ||
        localStorage.getItem(fallbackKey(userKey)) ||
        "null",
    );
  } catch {
    return null;
  }
}

function writeJsonMirror(value) {
  const json = JSON.stringify(value, null, 2);
  localStorage.setItem(jsonMirrorKey(value.userKey), json);
}

function findLegacyLoan(userKey) {
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "{}");
    const entry = Object.entries(legacy).find(
      ([username]) => username.toLowerCase() === userKey,
    );
    return entry?.[1] || null;
  } catch {
    return null;
  }
}

function normalizeLoan(loan) {
  return {
    ...defaultLoan,
    ...(loan && typeof loan === "object" ? loan : {}),
    scenarios:
      Array.isArray(loan?.scenarios) && loan.scenarios.length === 3
        ? [...loan.scenarios]
        : [...defaultLoan.scenarios],
  };
}

function normalizeCollection(value, userKey) {
  if (!value || !Array.isArray(value.profiles)) return null;
  const profiles = value.profiles
    .filter(
      (profile) => profile && typeof profile.name === "string" && profile.loan,
    )
    .map((profile) => ({
      id: typeof profile.id === "string" ? profile.id : makeId(),
      name: profile.name.trim().slice(0, 60) || "My Loan",
      loan: normalizeLoan(profile.loan),
    }));
  if (!profiles.length) return null;
  const activeProfileId = profiles.some(
    (profile) => profile.id === value.activeProfileId,
  )
    ? value.activeProfileId
    : profiles[0].id;
  return { userKey, profiles, activeProfileId, schemaVersion: 1 };
}

export function loadUserLoanData(userKey) {
  const normalizedKey = userKey.trim().toLowerCase();
  if (pendingLoads.has(normalizedKey)) return pendingLoads.get(normalizedKey);
  const pending = loadUserLoanDataInternal(normalizedKey).finally(() =>
    pendingLoads.delete(normalizedKey),
  );
  pendingLoads.set(normalizedKey, pending);
  return pending;
}

async function loadUserLoanDataInternal(normalizedKey) {
  let value;
  let usedFallback = false;
  try {
    value = await readIndexed(normalizedKey);
  } catch {
    value = readFallback(normalizedKey);
    usedFallback = Boolean(value);
  }

  let existing = normalizeCollection(value, normalizedKey);
  if (!existing) {
    value = readFallback(normalizedKey);
    usedFallback = Boolean(value);
    existing = normalizeCollection(value, normalizedKey);
  }
  if (existing) {
    if (usedFallback) await saveUserLoanData(normalizedKey, existing);
    return existing;
  }

  const legacyLoan = findLegacyLoan(normalizedKey);
  const initial = {
    userKey: normalizedKey,
    schemaVersion: 1,
    activeProfileId: makeId(),
    profiles: [
      {
        id: "",
        name: "My Loan",
        loan: normalizeLoan(legacyLoan || defaultLoan),
      },
    ],
  };
  initial.profiles[0].id = initial.activeProfileId;
  await saveUserLoanData(normalizedKey, initial);
  return initial;
}

export async function saveUserLoanData(userKey, value) {
  const normalizedKey = userKey.trim().toLowerCase();
  const safeValue = normalizeCollection(
    { ...value, userKey: normalizedKey },
    normalizedKey,
  );
  if (!safeValue) throw new Error("There are no valid loan profiles to save.");
  let indexedSaved = false;
  try {
    await writeIndexed(safeValue);
    indexedSaved = true;
  } catch {
    indexedSaved = false;
  }
  try {
    writeJsonMirror(safeValue);
  } catch (mirrorError) {
    if (!indexedSaved) throw mirrorError;
  }
  return safeValue;
}

export function createLoanProfile(name, loan = defaultLoan) {
  return {
    id: makeId(),
    name: name.trim().slice(0, 60),
    loan: normalizeLoan(loan),
  };
}

export function isValidImportedProfile(profile) {
  const loan = profile?.loan;
  return Boolean(
    profile &&
    typeof profile.name === "string" &&
    profile.name.trim() &&
    loan &&
    Number.isFinite(Number(loan.principal)) &&
    Number.isFinite(Number(loan.currentEmi)) &&
    Number.isFinite(Number(loan.annualRate)) &&
    Number.isFinite(Number(loan.balanceTenure)) &&
    Array.isArray(loan.scenarios) &&
    loan.scenarios.length === 3 &&
    loan.scenarios.every((amount) => Number.isFinite(Number(amount))),
  );
}
