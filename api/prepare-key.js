import { createHmac } from "crypto";
import { ethers } from "ethers";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.KEY_DERIVATION_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "Sunucu yapılandırması eksik: KEY_DERIVATION_SECRET" });
  }

  try {
    const { patientAddress, previewHash, signature } = req.body;
    if (!patientAddress || !previewHash || !signature) {
      return res.status(400).json({ error: "Eksik alan: patientAddress, previewHash, signature gerekli" });
    }

    const message = `MediChain anahtar talebi: ${patientAddress.toLowerCase()}:${previewHash}`;
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== patientAddress.toLowerCase()) {
      return res.status(401).json({ error: "İmza doğrulaması başarısız" });
    }

    const K = createHmac("sha256", secret)
      .update(`${patientAddress.toLowerCase()}:${previewHash}`)
      .digest("hex");

    return res.status(200).json({ K });
  } catch (e) {
    console.error("prepare-key hatası:", e);
    return res.status(500).json({ error: e.message });
  }
}
