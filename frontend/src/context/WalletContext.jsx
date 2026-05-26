import { createContext, useContext, useState, useRef } from "react";
import { ethers } from "ethers";

export const CONTRACT_ADDRESS = "0x5D54F7c9383c7076b7661858Acf6d0DE95C21552";
const SEPOLIA_CHAIN_ID = 11155111n;

export const ABI = [
  "function listData(string memory _ipfsHash, uint256 _price) external",
  "function purchaseData(uint256 _id) external payable",
  "function getDataHash(uint256 _id) external view returns (string memory)",
  "function revokeAccess(uint256 _id, address _researcher) external",
  "function delistData(uint256 _id) external",
  "function updatePrice(uint256 _id, uint256 _newPrice) external",
  "function dataCount() external view returns (uint256)",
  "function medicalRecords(uint256) external view returns (string ipfsHash, uint256 price, address owner, bool isActive)",
  "function hasAccess(address, uint256) external view returns (bool)",
  "function totalEarnings(address) external view returns (uint256)",
  "event DataListed(uint256 indexed id, address indexed owner, uint256 price)",
  "event DataPurchased(uint256 indexed id, address indexed buyer)",
  "event DataRevoked(uint256 indexed id, address indexed researcher)",
  "event PriceUpdated(uint256 indexed id, uint256 newPrice)",
];

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [account, setAccount]               = useState(null);
  const [contract, setContract]             = useState(null);
  const [records, setRecords]               = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [wrongNetwork, setWrongNetwork]     = useState(false);
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
                rpcUrls: ["https://eth-sepolia.g.alchemy.com/v2/OIMag4uYY7GuwhtZfWcBo"],
                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              }],
            });
          } else {
            throw switchError;
          }
        }
      }
      setWrongNetwork(false);

      const provider = new ethers.BrowserProvider(window.ethereum);

      const signer  = await provider.getSigner();
      const address = await signer.getAddress();
      setAccount(address);
      const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      setContract(c);
      addToast("Cüzdan başarıyla bağlandı!", "success");
      await loadRecords(c);

      window.ethereum.on("chainChanged", () => window.location.reload());
      window.ethereum.on("accountsChanged", () => window.location.reload());
    } catch (e) {
      addToast("Bağlantı hatası: " + e.message, "error");
    }
  }

  async function loadRecords(c) {
    const target = c || contract;
    if (!target) return;
    try {
      setLoadingRecords(true);
      const count = await target.dataCount();
      const ids = Array.from({ length: Number(count) }, (_, i) => i + 1);
      const results = await Promise.all(ids.map((i) => target.medicalRecords(i)));
      const items = results.map((r, idx) => ({
        id: ids[idx],
        ipfsHash: r.ipfsHash,
        price: r.price,
        owner: r.owner,
        isActive: r.isActive,
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
      account, contract, records, loadingRecords, wrongNetwork,
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
