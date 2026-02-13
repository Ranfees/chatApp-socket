export const bufferToBase64 = (buffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)));

export const base64ToBuffer = (base64) =>
  Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

// 🔑 Generate RSA Key Pair
export const generateRSAKeys = async () => {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const publicKey = await window.crypto.subtle.exportKey(
    "spki",
    keyPair.publicKey
  );

  const privateKey = await window.crypto.subtle.exportKey(
    "pkcs8",
    keyPair.privateKey
  );

  return {
    publicKey: bufferToBase64(publicKey),
    privateKey: bufferToBase64(privateKey),
  };
};
export const encryptMessage = async (
  message,
  receiverPublicKeyBase64,
  senderPublicKeyBase64
) => {
  // Generate AES key
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedTextBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    new TextEncoder().encode(message)
  );

  const exportedAESKey = await window.crypto.subtle.exportKey("raw", aesKey);

  // Import receiver public key
  const receiverPublicKey = await window.crypto.subtle.importKey(
    "spki",
    base64ToBuffer(receiverPublicKeyBase64),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );

  // Import sender public key
  const senderPublicKey = await window.crypto.subtle.importKey(
    "spki",
    base64ToBuffer(senderPublicKeyBase64),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );

  // Encrypt AES key for both
  const encryptedKeyForReceiver = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    receiverPublicKey,
    exportedAESKey
  );

  const encryptedKeyForSender = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    senderPublicKey,
    exportedAESKey
  );

  return {
    encryptedText: bufferToBase64(encryptedTextBuffer),
    encryptedKeyForReceiver: bufferToBase64(encryptedKeyForReceiver),
    encryptedKeyForSender: bufferToBase64(encryptedKeyForSender),
    iv: bufferToBase64(iv),
  };
};

export const decryptMessage = async (msg, privateKeyBase64) => {
  const privateKey = await window.crypto.subtle.importKey(
    "pkcs8",
    base64ToBuffer(privateKeyBase64),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );

  // Decrypt AES key
  const decryptedAESKeyBuffer = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    base64ToBuffer(msg.encryptedKey)
  );

  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    decryptedAESKeyBuffer,
    { name: "AES-GCM" },
    true,
    ["decrypt"]
  );

  const decryptedTextBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBuffer(msg.iv),
    },
    aesKey,
    base64ToBuffer(msg.encryptedText)
  );

  return new TextDecoder().decode(decryptedTextBuffer);
};
