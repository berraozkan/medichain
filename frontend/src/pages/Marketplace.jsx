import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { useWallet } from "../context/WalletContext";
import { decryptAndDownload } from "../utils/crypto";
import { WalletIcon, InboxIcon, ClockIcon } from "../components/Icons";

const shortAddr = (addr) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
const shortHash = (h) => (h ? `${h.slice(0, 16)}...` : "");

export default function Marketplace() {
  const {
    account,
    contract,
    records,
    loadingRecords,
    loadRecords,
    connectWallet,
    addToast,
    removeToast,
  } = useWallet();
  const [filter, setFilter] = useState("active");
  const [sort, setSort] = useState("default");
  const [purchasing, setPurchasing] = useState(null);
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    document.title = "MediChain — Pazar Yeri";
  }, []);

  const filtered = records
    .filter((r) => {
      if (filter === "active") return r.isActive;
      if (filter === "mine")
        return account && r.owner.toLowerCase() === account.toLowerCase();
      return true;
    })
    .sort((a, b) => {
      if (sort === "price_asc") return Number(a.price - b.price);
      if (sort === "price_desc") return Number(b.price - a.price);
      return a.id - b.id;
    });

  const tabCounts = {
    active: records.filter((r) => r.isActive).length,
    all: records.length,
    mine: records.filter(
      (r) => account && r.owner.toLowerCase() === account.toLowerCase(),
    ).length,
  };

  async function purchaseRecord(id, price) {
    if (!contract) {
      addToast("Önce cüzdanınızı bağlayın.", "error");
      return;
    }
    setPurchasing(id);
    const tid = addToast(
      "İşlem gönderiliyor, lütfen bekleyin...",
      "loading",
      0,
    );
    try {
      const tx = await contract.purchaseData(id, { value: price });
      await tx.wait();
      removeToast(tid);
      addToast(
        `Kayıt #${id} satın alındı. "Satın Aldıklarım" sayfasından indirebilirsiniz.`,
        "success",
      );
      loadRecords();
    } catch (e) {
      removeToast(tid);
      addToast("İşlem başarısız: " + e.message, "error");
    } finally {
      setPurchasing(null);
    }
  }

  async function viewRecord(id) {
    if (!contract) {
      addToast("Önce cüzdanınızı bağlayın.", "error");
      return;
    }
    setViewing(id);
    try {
      const metadataHash = await contract.getDataHash(id);
      const res = await fetch(
        `https://gateway.pinata.cloud/ipfs/${metadataHash}`,
      );
      const text = await res.text();
      try {
        const meta = JSON.parse(text);
        if (meta.version === 2 && meta.encryptedFileHash && meta.key) {
          await decryptAndDownload(meta);
          addToast("Dosya başarıyla indirildi.", "success");
          return;
        }
      } catch (_) {}
      window.open(
        `https://gateway.pinata.cloud/ipfs/${metadataHash}`,
        "_blank",
      );
    } catch {
      addToast("Bu kayda erişim izniniz bulunmuyor.", "error");
    } finally {
      setViewing(null);
    }
  }

  const tabs = [
    { key: "active", label: "Aktif" },
    { key: "all", label: "Tümü" },
    ...(account ? [{ key: "mine", label: "Kayıtlarım" }] : []),
  ];

  return (
    <main className="main">
      <div className="page-hero">
        <div>
          <p className="section-label">Pazar Yeri</p>
          <h1 className="page-title">Tıbbi Kayıt Listesi</h1>
          <p className="page-subtitle">
            Araştırmacılar için listelenmiş tıbbi kayıtları inceleyin ve satın
            alarak erişim hakkı edinin.
          </p>
        </div>
        {account && (
          <Link to="/upload" className="btn btn-primary">
            Kayıt Ekle
          </Link>
        )}
      </div>

      {/* Tab + Araçlar */}
      <div className="market-toolbar">
        <div className="market-toolbar-top">
          <div className="tabs">
            {tabs.map((t) => (
              <button
                key={t.key}
                className={`tab ${filter === t.key ? "active" : ""}`}
                onClick={() => setFilter(t.key)}
              >
                {t.label}
                <span className="tab-count">{tabCounts[t.key]}</span>
              </button>
            ))}
          </div>

          <div className="toolbar-right">
            <span
              style={{
                fontSize: ".78rem",
                color: "var(--gray-400)",
                whiteSpace: "nowrap",
              }}
            >
              Sırala:
            </span>

            <select
              className="form-input"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              style={{ minWidth: 160 }}
            >
              <option value="default">Varsayılan</option>
              <option value="price_asc">Fiyat: Düşükten Yükseğe</option>
              <option value="price_desc">Fiyat: Yüksekten Düşüğe</option>
            </select>
          </div>
        </div>
      </div>

      {!account ? (
        <div className="empty">
          <div className="empty-icon">
            <WalletIcon size={44} color="var(--gray-300)" />
          </div>
          <h3>Pazar Yerini Görüntülemek İçin Bağlanın</h3>
          <p>
            Tıbbi kayıtlara erişmek için MetaMask cüzdanınızı bağlamanız
            gerekmektedir.
          </p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            onClick={connectWallet}
          >
            Cüzdan Bağla
          </button>
        </div>
      ) : loadingRecords ? (
        <div className="empty">
          <div className="empty-icon">
            <ClockIcon size={44} color="var(--gray-300)" />
          </div>
          <h3>Kayıtlar yükleniyor...</h3>
          <p>Blockchain'den veriler alınıyor, lütfen bekleyin.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">
            <InboxIcon size={44} color="var(--gray-300)" />
          </div>
          <h3>Bu kategoride kayıt bulunmuyor</h3>
          <p>
            {filter === "mine"
              ? "Henüz sisteme kayıt eklemediniz."
              : "Şu an bu filtre için listelenmiş kayıt bulunmuyor."}
          </p>
          {filter === "mine" && (
            <Link
              to="/upload"
              className="btn btn-primary"
              style={{ marginTop: 16 }}
            >
              İlk Kaydı Ekle
            </Link>
          )}
        </div>
      ) : (
        <div className="market-grid">
          {filtered.map((r) => {
            const isOwner = account?.toLowerCase() === r.owner.toLowerCase();
            const isBuying = purchasing === r.id;
            const isViewing = viewing === r.id;

            return (
              <div className="market-card" key={r.id}>
                <div className="record-header">
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span className="record-id">
                      Kayıt {String(r.id).padStart(3, "0")}
                    </span>
                    {isOwner && <span className="owner-badge">Sahibi</span>}
                    <span
                      style={{
                        background: "#f0fdf4",
                        color: "#15803d",
                        fontSize: ".65rem",
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: 4,
                        letterSpacing: ".03em",
                      }}
                    >
                      AES-256
                    </span>
                  </div>
                  <span
                    className={`record-status ${
                      r.isActive ? "active" : "inactive"
                    }`}
                  >
                    {r.isActive ? "Aktif" : "Pasif"}
                  </span>
                </div>

                <div className="market-price-row">
                  <span className="market-price">
                    {ethers.formatEther(r.price)} ETH
                  </span>
                  <span
                    style={{
                      fontSize: ".72rem",
                      color: "var(--gray-400)",
                      textTransform: "uppercase",
                      letterSpacing: ".04em",
                    }}
                  >
                    Sepolia
                  </span>
                </div>

                <div className="record-info">
                  <div className="record-row">
                    <span className="record-row-label">Metadata Hash</span>
                    <span className="record-row-value">
                      {shortHash(r.ipfsHash)}
                    </span>
                  </div>
                  <div className="record-row">
                    <span className="record-row-label">Kayıt Sahibi</span>
                    <span className="record-row-value">
                      {shortAddr(r.owner)}
                    </span>
                  </div>
                </div>

                <div className="record-actions">
                  {r.isActive && !isOwner && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => purchaseRecord(r.id, r.price)}
                      disabled={isBuying}
                      style={{ flex: 1, justifyContent: "center" }}
                    >
                      {isBuying ? (
                        <>
                          <span className="spinner" /> İşleniyor
                        </>
                      ) : (
                        "Satın Al"
                      )}
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => viewRecord(r.id)}
                    disabled={isViewing}
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    {isViewing ? (
                      <>
                        <span className="spinner-dark" /> Yükleniyor
                      </>
                    ) : (
                      "İndir"
                    )}
                  </button>
                  {isOwner && (
                    <Link
                      to="/my-data"
                      className="btn btn-outline btn-sm"
                      style={{ flex: 1, justifyContent: "center" }}
                    >
                      Yönet
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
