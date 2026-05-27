export const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs";

const GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs",
  "https://ipfs.io/ipfs",
  "https://dweb.link/ipfs",
];

export const ipfsUrl = (hash) => `${IPFS_GATEWAY}/${hash}`;

// Race multiple gateways, return first successful response
export async function fetchFromIPFS(hash) {
  const controllers = GATEWAYS.map(() => new AbortController());
  try {
    return await Promise.any(
      GATEWAYS.map((gw, i) =>
        fetch(`${gw}/${hash}`, { signal: controllers[i].signal }).then((r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r;
        })
      )
    );
  } finally {
    controllers.forEach((c) => c.abort());
  }
}

function bytesToBase64(bytes) {
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export async function uploadToIPFS(bytes, filename, contentType) {
  const devJwt = import.meta.env.VITE_PINATA_JWT;
  if (import.meta.env.DEV && devJwt) {
    const formData = new FormData();
    formData.append("file", new Blob([bytes], { type: contentType }), filename);
    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${devJwt}` },
      body: formData,
    });
    const data = await res.json();
    if (!data.IpfsHash) throw new Error("IPFS yüklemesi başarısız oldu.");
    return data.IpfsHash;
  }

  const res = await fetch("/api/upload-ipfs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: bytesToBase64(new Uint8Array(bytes)), filename, contentType }),
  });
  const result = await res.json();
  if (!result.IpfsHash) throw new Error(result.error || "IPFS yüklemesi başarısız oldu.");
  return result.IpfsHash;
}
