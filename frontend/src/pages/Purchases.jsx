import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { useWallet } from "../context/WalletContext";
import { decryptAndDownload } from "../utils/crypto";
import { ipfsUrl } from "../utils/ipfs";
import { WalletIcon, InboxIcon, ClockIcon } from "../components/Icons";

const shortHash = (h) => (h ? `${h.slice(0, 16)}...` : "");

const CATEGORY_STYLES = {
  "Kan Tahlili":        "cat-blood",
  "MRI / Görüntüleme":  "cat-imaging",
  "EKG":               "cat-ekg",
  "Röntgen":           "cat-xray",
  "Patoloji":          "cat-patho",
  "Ameliyat Raporu":   "cat-surgery",
  "Diğer":             "cat-other",
};

function getCatClass(category) {
  return CATEGORY_STYLES[category] || "cat-other";
}

export default function Purchases() {
  const { account, contract, records, loadingRecords, connectWallet, addToast } = useWallet();
  const [downloading, setDownloading] = useState(null);
  const [metadata, setMetadata]       = useState({});

  useEffect(() => {
    document.title = "MediChain — Satın Aldıklarım";
  }, []);

  // userHasAccess is already loaded in WalletContext — no extra contract calls needed
  const purchases = records.filter(
    (r) => r.userHasAccess && account && r.owner.toLowerCase() !== account.toLowerCase()
  );

  async function fetchMetadata(record) {
    if (metadata[record.id]) return metadata[record.id];
    try {
      const metaHash = await contract.getDataHash(record.id);
      const res  = await fetch(ipfsUrl(metaHash));
      const text = await res.text();
      try {
        const meta = JSON.parse(text);
        if (meta.version === 2) {
          const result = { ...meta, _expanded: false };
          setMetadata((prev) => ({ ...prev, [record.id]: result }));
          return result;
        }
      } catch (_) {}
      const legacy = { _legacy: true, hash: metaHash };
      setMetadata((prev) => ({ ...prev, [record.id]: legacy }));
      return legacy;
    } catch (e) {
      addToast("Metadata alınamadı: " + e.message, "error");
      return null;
    }
  }

  async function handleDownload(record) {
    setDownloading(record.id);
    try {
      const meta = await fetchMetadata(record);
      if (!meta) return;
      if (meta._legacy) {
        window.open(ipfsUrl(meta.hash), "_blank");
        return;
      }
      await decryptAndDownload(meta);
      addToast(`"${meta.fileName || "Dosya"}" başarıyla indirildi.`, "success");
    } catch (e) {
      addToast("İndirme başarısız: " + e.message, "error");
    } finally {
      setDownloading(null);
    }
  }

  async function toggleDetails(record) {
    const meta = await fetchMetadata(record);
    if (!meta || meta._legacy) return;
    setMetadata((prev) => ({
      ...prev,
      [record.id]: { ...prev[record.id], _expanded: !prev[record.id]?._expanded },
    }));
  }

  if (!account) {
    return (
      <main className="main">
        <div className="empty" style={{ paddingTop: 80 }}>
          <div className="empty-icon"><WalletIcon size={44} color="var(--gray-300)" /></div>
          <h3>Cüzdan Bağlantısı Gerekli</h3>
          <p>Satın aldığınız kayıtları görmek için MetaMask cüzdanınızı bağlayın.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={connectWallet}>
            Cüzdan Bağla
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="main">
      <div className="page-hero">
        <div>
          <p className="section-label">Araştırmacı Paneli</p>
          <h1 className="page-title">Satın Aldıklarım</h1>
          <p className="page-subtitle">
            Erişim izniniz olan tıbbi kayıtları görüntüleyin ve şifreli dosyaları indirin.
          </p>
        </div>
        <Link to="/marketplace" className="btn btn-ghost">
          Pazar Yerine Dön
        </Link>
      </div>

      {loadingRecords ? (
        <div className="empty">
          <div className="empty-icon"><ClockIcon size={44} color="var(--gray-300)" /></div>
          <h3>Kayıtlar yükleniyor...</h3>
          <p>Blockchain'den veriler alınıyor, lütfen bekleyin.</p>
        </div>
      ) : purchases.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><InboxIcon size={44} color="var(--gray-300)" /></div>
          <h3>Henüz satın alınmış kayıt yok</h3>
          <p>Pazar yerinden tıbbi kayıt satın aldığınızda burada görünür.</p>
          <Link to="/marketplace" className="btn btn-primary" style={{ marginTop: 16 }}>
            Pazar Yerine Git
          </Link>
        </div>
      ) : (
        <>
          <div className="stats-row" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-value">{purchases.length}</div>
              <div className="stat-label">Satın Alınan</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: "var(--success)" }}>
                {purchases.filter((r) => r.isActive).length}
              </div>
              <div className="stat-label">Aktif Kayıt</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: "var(--primary)", fontSize: "1.4rem" }}>
                {ethers.formatEther(purchases.reduce((sum, r) => sum + r.price, 0n))} ETH
              </div>
              <div className="stat-label">Toplam Harcama</div>
            </div>
          </div>

          <div className="records-grid">
            {purchases.map((r) => {
              const meta          = metadata[r.id];
              const isDownloading = downloading === r.id;
              const catClass      = meta && !meta._legacy ? getCatClass(meta.category) : "cat-other";

              return (
                <div className="record-card" key={r.id}>
                  <div className="record-header">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span className="record-id">Kayıt {String(r.id).padStart(3, "0")}</span>
                      {meta && !meta._legacy && meta.category && (
                        <span className={`access-badge ${catClass}`} style={{ textTransform: "none", letterSpacing: 0 }}>
                          {meta.category}
                        </span>
                      )}
                    </div>
                    <span className={`record-status ${r.isActive ? "active" : "inactive"}`}>
                      {r.isActive ? "Aktif" : "Pasif"}
                    </span>
                  </div>

                  {meta && !meta._legacy && meta._expanded && (
                    <div style={{
                      background: "var(--gray-50)", border: "1px solid var(--gray-200)",
                      borderRadius: "var(--radius-sm)", padding: "12px 14px",
                      fontSize: ".82rem", color: "var(--gray-700)", lineHeight: 1.7,
                      display: "flex", flexDirection: "column", gap: 4,
                    }}>
                      {meta.fileName && <div><strong>Dosya adı:</strong> {meta.fileName}</div>}
                      {meta.description && <div><strong>Açıklama:</strong> {meta.description}</div>}
                    </div>
                  )}

                  <div className="record-info">
                    <div className="record-row">
                      <span className="record-row-label">Önizleme Hash</span>
                      <span className="record-row-value">{shortHash(r.previewHash)}</span>
                    </div>
                    <div className="record-row">
                      <span className="record-row-label">Ödenen Fiyat</span>
                      <span className="record-price">{ethers.formatEther(r.price)} ETH</span>
                    </div>
                  </div>

                  <div className="record-actions">
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleDownload(r)}
                      disabled={isDownloading}
                      style={{ flex: 1, justifyContent: "center" }}
                    >
                      {isDownloading ? <><span className="spinner" /> İndiriliyor...</> : "İndir"}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => toggleDetails(r)}
                      style={{ justifyContent: "center" }}
                    >
                      {meta && !meta._legacy && meta._expanded ? "Gizle" : "Detay"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
