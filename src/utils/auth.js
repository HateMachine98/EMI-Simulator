const ITERATIONS = 150000;

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map((part) => parseInt(part, 16)));
}

async function derivePasswordHash(password, salt) {
  if (!window.crypto?.subtle) {
    throw new Error("Secure browser cryptography is unavailable. Use localhost or HTTPS.");
  }

  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  return toHex(new Uint8Array(bits));
}

export async function createPasswordRecord(password) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await derivePasswordHash(password, salt);

  return {
    salt: toHex(salt),
    passwordHash,
    passwordAlgorithm: `PBKDF2-SHA256-${ITERATIONS}`,
  };
}

export async function verifyPassword(password, record) {
  const calculated = await derivePasswordHash(password, fromHex(record.salt));
  if (calculated.length !== record.passwordHash.length) return false;

  let difference = 0;
  for (let i = 0; i < calculated.length; i += 1) {
    difference |= calculated.charCodeAt(i) ^ record.passwordHash.charCodeAt(i);
  }
  return difference === 0;
}
