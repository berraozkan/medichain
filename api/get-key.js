import { createHmac } from "crypto";
import { ethers } from "ethers";

const CONTRACT_ADDRESS = "0x6f6b3AA1649093aBCA0fc1eC53909e4A5022A08C";
const ABI = [
  "function hasAccess(address, uint256) external view returns (bool)",
  "function medicalRecords(uint256) external view returns (string previewHash, uint256 price, address owner, bool isActive)",
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.KEY_DERIVATION_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "Sunucu yapılandırması eksik: KEY_DERIVATION_SECRET" });
  }

  try {
    const { recordId, requesterAddress, signature } = req.body;
    if (!recordId || !requesterAddress || !signature) {
      return res.status(400).json({ error: "Eksik alan: recordId, requesterAddress, signature gerekli" });
    }

    // Requester proves they own the address
    const message = `MediChain erişim talebi: ${recordId}`;
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== requesterAddress.toLowerCase()) {
      return res.status(401).json({ error: "İmza doğrulaması başarısız" });
    }

    // Verify on-chain access
    const provider = new ethers.JsonRpcProvider(
      process.env.SEPOLIA_RPC_URL || "https://rpc.ankr.com/eth_sepolia"
    );
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    const [hasAccess, record] = await Promise.all([
      contract.hasAccess(requesterAddress, recordId),
      contract.medicalRecords(recordId),
    ]);

    const isOwner = record.owner.toLowerCase() === requesterAddress.toLowerCase();
    if (!hasAccess && !isOwner) {
      return res.status(403).json({ error: "Bu kayda erişim yetkiniz yok" });
    }

    // Derive the same K used at upload time
    const K = createHmac("sha256", secret)
      .update(`${record.owner.toLowerCase()}:${record.previewHash}`)
      .digest("hex");

    return res.status(200).json({ K });
  } catch (e) {
    console.error("get-key hatası:", e);
    return res.status(500).json({ error: e.message });
  }
}
