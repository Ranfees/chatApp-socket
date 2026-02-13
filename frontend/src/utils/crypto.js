const base64ToBuffer = (base64) => {
  // Ensure we have a string and remove any whitespace/newlines
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

// Encrypt for a specific Public Key
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

// Decrypt using your Private Key
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
    return "[Decryption Error]";
  }
};