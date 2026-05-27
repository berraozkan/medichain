// Encrypt an IPFS CID string with AES-256-GCM using a 32-byte hex key.
// Returns "enc:<hex(iv + ciphertext)>" — never reveals the raw CID in calldata.
export async function encryptDataHash(cid, Khex) {
  const keyBytes = hexToBuf(Khex);
  const key = await window.crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(cid)
  );
  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);
  return "enc:" + bufToHex(combined);
}

// Decrypt an "enc:..." string back to the original IPFS CID.
// Plain CIDs (no prefix) are returned as-is for backward compatibility.
export async function decryptDataHash(encStr, Khex) {
  if (!encStr.startsWith("enc:")) return encStr;
  const combined = hexToBuf(encStr.slice(4));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const key = await window.crypto.subtle.importKey("raw", hexToBuf(Khex), { name: "AES-GCM" }, false, ["decrypt"]);
  const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

function bufToHex(buf) {
  return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBuf(hex) {
  return new Uint8Array(hex.match(/.{2}/g).map((b) => parseInt(b, 16)));
}

export async function encryptFile(file) {
  const key = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const fileBuffer = await file.arrayBuffer();
  const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, fileBuffer);
  const rawKey = await window.crypto.subtle.exportKey("raw", key);

  return {
    encryptedBytes: new Uint8Array(encrypted),
    key: bufToBase64(new Uint8Array(rawKey)),
    iv: bufToBase64(iv),
  };
}

import { fetchFromIPFS } from "./ipfs.js";

export async function decryptAndDownload(metadata) {
  const { encryptedFileHash, key, iv, fileName } = metadata;
  const res = await fetchFromIPFS(encryptedFileHash);
  if (!res.ok) throw new Error("Şifreli dosya IPFS'ten alınamadı.");
  const encryptedBytes = await res.arrayBuffer();

  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    base64ToBuf(key),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBuf(iv) },
    cryptoKey,
    encryptedBytes
  );

  const blob = new Blob([decrypted]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "medical_record";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function bufToBase64(buf) {
  return btoa(String.fromCharCode(...buf));
}

function base64ToBuf(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
