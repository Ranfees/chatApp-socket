const base64ToBuffer = (base64) => {
  if (!base64 || typeof base64 !== 'string') {
    throw new Error("Invalid Base64 string provided to base64ToBuffer");
  }
  const cleanBase64 = base64.trim().replace(/\s/g, '');
  try {
    const binary = window.atob(cleanBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (e) {
    console.error("atob decoding failed:", e);
    throw e;
  }
};

const bufferToBase64 = (buffer) => {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
};

const deriveKeyFromPassword = async (password) => {
  const encoder = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("chat-app-consistent-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
};

export const protectPrivateKey = async (privateKeyBase64, password) => {
  const aesKey = await deriveKeyFromPassword(password);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    new TextEncoder().encode(privateKeyBase64)
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return bufferToBase64(combined.buffer);
};

export const unlockPrivateKey = async (protectedKeyBase64, password) => {
  try {
    const combined = new Uint8Array(base64ToBuffer(protectedKeyBase64));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const aesKey = await deriveKeyFromPassword(password);
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      aesKey,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    throw new Error("Password incorrect or key corrupted");
  }
};

export const encryptFor = async (text, publicKeyBase64) => {
  const publicKey = await window.crypto.subtle.importKey(
    "spki",
    base64ToBuffer(publicKeyBase64),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    new TextEncoder().encode(text)
  );
  return bufferToBase64(encrypted);
};

export const decryptWith = async (encryptedBase64, privateKeyBase64) => {
  try {
    const privateKey = await window.crypto.subtle.importKey(
      "pkcs8",
      base64ToBuffer(privateKeyBase64),
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["decrypt"]
    );
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      base64ToBuffer(encryptedBase64)
    );
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error("RSA Decryption Error:", err);
    return "[Decryption Error]";
  }
};