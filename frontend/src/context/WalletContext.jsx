import { createContext, useContext, useState, useRef } from "react";
import { ethers } from "ethers";

export const CONTRACT_ADDRESS = "0x96016fDe170Eb2e6E6b54f34C767319Fc8e8D946";
const SEPOLIA_CHAIN_ID = 11155111n;

export const ABI = [
  "function listData(string calldata _previewHash, string calldata _dataHash, uint256 _price) external",
  "function purchaseData(uint256 _id) external payable",
  "function getDataHash(uint256 _id) external view returns (string memory)",
  "function revokeAccess(uint256 _id, address _researcher) external",
  "function delistData(uint256 _id) external",
  "function relistData(uint256 _id) external",
  "function updatePrice(uint256 _id, uint256 _newPrice) external",
  "function transferRecordOwnership(uint256 _id, address _newOwner) external",
  "function dataCount() external view returns (uint256)",
  "function medicalRecords(uint256) external view returns (string previewHash, uint256 price, address owner, bool isActive)",
  "function hasAccess(address, uint256) external view returns (bool)",
  "function totalEarnings(address) external view returns (uint256)",
  "event DataListed(uint256 indexed id, address indexed owner, uint256 price)",
  "event DataPurchased(uint256 indexed id, address indexed buyer)",
  "event DataRevoked(uint256 indexed id, address indexed researcher)",
  "event PriceUpdated(uint256 indexed id, uint256 newPrice)",
  "event OwnershipTransferred(uint256 indexed id, address indexed oldOwner, address indexed newOwner)",
];

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [account, setAccount]               = useState(null);
  const [contract, setContract]             = useState(null);
  const [records, setRecords]               = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [toasts, setToasts]                 = useState([]);
  const toastId = useRef(0);

  function addToast(message, type = "info", duration = 4000) {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (duration > 0)
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
    return id;
  }

  function removeToast(id) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  async function connectWallet() {
    if (!window.ethereum) {
      addToast("MetaMask bulunamadı! Lütfen tarayıcınıza MetaMask yükleyin.", "error");
      return;
    }
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });

      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      if (parseInt(chainId, 16) !== 11155111) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xaa36a7" }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: "0xaa36a7",
                chainName: "Sepolia",
                rpcUrls: [import.meta.env.VITE_SEPOLIA_RPC_URL || "https://rpc.ankr.com/eth_sepolia"],
                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              }],
            });
          } else {
            throw switchError;
          }
        }
      }
      const provider = new ethers.BrowserProvider(window.ethereum);

      const signer  = await provider.getSigner();
      const address = await signer.getAddress();
      setAccount(address);
      const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      setContract(c);
      addToast("Cüzdan başarıyla bağlandı!", "success");
      await loadRecords(c, address);

      window.ethereum.on("chainChanged", () => window.location.reload());
      window.ethereum.on("accountsChanged", () => window.location.reload());
    } catch (e) {
      addToast("Bağlantı hatası: " + e.message, "error");
    }
  }

  async function loadRecords(c, addr) {
    const target  = c || contract;
    const userAddr = addr || account;
    if (!target) return;
    try {
      setLoadingRecords(true);
      const count = await target.dataCount();
      const ids   = Array.from({ length: Number(count) }, (_, i) => i + 1);
      const [results, accessResults] = await Promise.all([
        Promise.all(ids.map((i) => target.medicalRecords(i))),
        userAddr
          ? Promise.all(ids.map((i) => target.hasAccess(userAddr, i)))
          : Promise.resolve(ids.map(() => false)),
      ]);
      const items = results.map((r, idx) => ({
        id: ids[idx],
        previewHash: r.previewHash,
        price: r.price,
        owner: r.owner,
        isActive: r.isActive,
        userHasAccess: accessResults[idx],
      }));
      setRecords(items);
    } catch (e) {
      addToast("Veriler yüklenemedi: " + e.message, "error");
    } finally {
      setLoadingRecords(false);
    }
  }

  return (
    <WalletContext.Provider value={{
      account, contract, records, loadingRecords,
      toasts, addToast, removeToast,
      connectWallet, loadRecords,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
