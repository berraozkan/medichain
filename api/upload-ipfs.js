export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return res.status(500).json({ error: "Sunucu yapılandırması eksik: PINATA_JWT" });
  }

  try {
    const { data, filename, contentType } = req.body;
    if (!data || !filename || !contentType) {
      return res.status(400).json({ error: "Eksik alan: data, filename, contentType gerekli" });
    }

    const buffer = Buffer.from(data, "base64");
    const blob   = new Blob([buffer], { type: contentType });

    const formData = new FormData();
    formData.append("file", blob, filename);

    const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method:  "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body:    formData,
    });

    const result = await response.json();

    if (!result.IpfsHash) {
      console.error("Pinata hatası:", result);
      return res.status(502).json({ error: "IPFS yüklemesi başarısız" });
    }

    res.status(200).json({ IpfsHash: result.IpfsHash });
  } catch (e) {
    console.error("upload-ipfs handler hatası:", e);
    res.status(500).json({ error: e.message });
  }
}
