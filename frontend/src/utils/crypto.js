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

import { ipfsUrl } from "./ipfs.js";

export async function decryptAndDownload(metadata) {
  const { encryptedFileHash, key, iv, fileName } = metadata;
  const res = await fetch(ipfsUrl(encryptedFileHash));
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
