import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { useWallet } from "../context/WalletContext";
import { WalletIcon, ClockIcon, FileIcon } from "../components/Icons";

const shortAddr = (addr) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "");
const shortHash = (h)    => (h    ? `${h.slice(0, 18)}...`                    : "");

export default function MyData() {
  const { account, contract, records, loadingRecords, loadRecords, connectWallet, addToast, removeToast } = useWallet();

  useEffect(() => {
    document.title = "MediChain — Kayıtlarım";
  }, []);

  const [expandedAccess, setExpandedAccess] = useState({});
  const [purchasers, setPurchasers]         = useState({});
  const [loadingBuyers, setLoadingBuyers]   = useState({});
  const [revokeInputs, setRevokeInputs]     = useState({});

  const myRecords    = records.filter((r) => account && r.owner.toLowerCase() === account.toLowerCase());
  const totalActive  = myRecords.filter((r) => r.isActive).length;
  const totalPassive = myRecords.length - totalActive;

  async function loadPurchasers(recordId) {
    if (!contract) return;
    setLoadingBuyers((prev) => ({ ...prev, [recordId]: true }));
    try {
      const filter   = contract.filters.DataPurchased(recordId, null);
      const events   = await contract.queryFilter(filter, 0, "latest");
      const uniqueBuyers = [...new Set(events.map((e) => e.args.buyer))];
      const withAccess = await Promise.all(
        uniqueBuyers.map(async (addr) => ({
          address:    addr,
          hasAccess:  await contract.hasAccess(addr, recordId),
          everBought: true,
        }))
      );
      setPurchasers((prev) => ({ ...prev, [recordId]: withAccess }));
    } catch (e) {
      addToast("Satın alan listesi alınamadı: " + e.message, "error");
    } finally {
      setLoadingBuyers((prev) => ({ ...prev, [recordId]: false }));
    }
  }

  async function revokeAccess(recordId, researcherAddr) {
    if (!contract) return;
    if (!ethers.isAddress(researcherAddr)) {
      addToast("Geçersiz cüzdan adresi.", "error"); return;
    }
    const tid = addToast("Erişim iptal ediliyor...", "loading", 0);
    try {
      const tx = await contract.revokeAccess(recordId, researcherAddr);
      await tx.wait();
      removeToast(tid);
      addToast("Erişim başarıyla iptal edildi.", "success");
      setRevokeInputs((prev) => ({ ...prev, [recordId]: "" }));
      loadPurchasers(recordId);
    } catch (e) {
      removeToast(tid);
      addToast("Hata: " + e.message, "error");
    }
  }

  async function delistRecord(id) {
    if (!contract) return;
    const tid = addToast("Kayıt satıştan kaldırılıyor...", "loading", 0);
    try {
      const tx = await contract.delistData(id);
      await tx.wait();
      removeToast(tid);
      addToast(`Kayıt #${id} satıştan kaldırıldı.`, "success");
      loadRecords();
    } catch (e) {
      removeToast(tid);
      addToast("Hata: " + e.message, "error");
    }
  }

  async function relistRecord(id) {
    if (!contract) return;
    const tid = addToast("Kayıt tekrar listeleniyor...", "loading", 0);
    try {
      const tx = await contract.relistData(id);
      await tx.wait();
      removeToast(tid);
      addToast(`Kayıt #${id} tekrar listelendi.`, "success");
      loadRecords();
    } catch (e) {
      removeToast(tid);
      addToast("Hata: " + e.message, "error");
    }
  }

  function toggleAccess(id) {
    setExpandedAccess((prev) => {
      const next = !prev[id];
      if (next && !purchasers[id]) loadPurchasers(id);
      return { ...prev, [id]: next };
    });
  }

  if (!account) {
    return (
      <main className="main">
        <div className="empty" style={{ paddingTop: 80 }}>
          <div className="empty-icon"><WalletIcon size={44} color="var(--gray-300)" /></div>
          <h3>Cüzdan Bağlantısı Gerekli</h3>
          <p>Kayıtlarınızı yönetebilmek için MetaMask cüzdanınızı bağlamanız gerekmektedir.</p>
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
          <p className="section-label">Erişim Yönetimi</p>
          <h1 className="page-title">Kayıtlarım</h1>
          <p className="page-subtitle">
            Sisteme eklediğiniz tıbbi kayıtları yönetin, satın alma geçmişini görüntüleyin
            ve araştırmacı erişimlerini kontrol edin.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => loadRecords()} disabled={loadingRecords}>
            {loadingRecords ? "Yükleniyor..." : "Yenile"}
          </button>
          <Link to="/upload" className="btn btn-primary btn-sm">
            Kayıt Ekle
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{myRecords.length}</div>
          <div className="stat-label">Toplam Kayıt</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--success)" }}>{totalActive}</div>
          <div className="stat-label">Aktif Listeme</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--gray-400)" }}>{totalPassive}</div>
          <div className="stat-label">Pasif Kayıt</div>
        </div>
      </div>

      {loadingRecords ? (
        <div className="empty">
          <div className="empty-icon"><ClockIcon size={44} color="var(--gray-300)" /></div>
          <h3>Yükleniyor...</h3>
        </div>
      ) : myRecords.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><FileIcon size={44} color="var(--gray-300)" /></div>
          <h3>Henüz kayıt eklemediniz</h3>
          <p>Pazar yerine ilk tıbbi kaydınızı ekleyerek araştırmacılarla bağlantı kurun.</p>
          <Link to="/upload" className="btn btn-primary" style={{ marginTop: 16 }}>
            İlk Kaydı Ekle
          </Link>
        </div>
      ) : (
        <div className="records-grid">
          {myRecords.map((r) => {
            const accessOpen    = expandedAccess[r.id];
            const buyers        = purchasers[r.id] || [];
            const buyersLoading = loadingBuyers[r.id];
            const activeBuyers  = buyers.filter((b) => b.hasAccess).length;

            return (
              <div className="record-card" key={r.id}>
                <div className="record-header">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="record-id">Kayıt {String(r.id).padStart(3, "0")}</span>
                    <span className="owner-badge">Sahibi</span>
                  </div>
                  <span className={`record-status ${r.isActive ? "active" : "inactive"}`}>
                    {r.isActive ? "Aktif" : "Pasif"}
                  </span>
                </div>

                <div className="record-info">
                  <div className="record-row">
                    <span className="record-row-label">Önizleme Hash</span>
                    <span className="record-row-value">{shortHash(r.previewHash)}</span>
                  </div>
                  <div className="record-row">
                    <span className="record-row-label">Satış Fiyatı</span>
                    <span className="record-price">{ethers.formatEther(r.price)} ETH</span>
                  </div>
                  {purchasers[r.id] && (
                    <div className="record-row">
                      <span className="record-row-label">Aktif Erişim</span>
                      <span style={{ fontWeight: 600, color: activeBuyers > 0 ? "var(--success)" : "var(--gray-400)", fontSize: ".82rem" }}>
                        {activeBuyers} araştırmacı
                      </span>
                    </div>
                  )}
                </div>

                <div className="record-actions">
                  {r.isActive ? (
                    <button className="btn btn-ghost btn-sm" onClick={() => delistRecord(r.id)}>
                      Satıştan Kaldır
                    </button>
                  ) : (
                    <button className="btn btn-outline btn-sm" onClick={() => relistRecord(r.id)}>
                      Tekrar Listele
                    </button>
                  )}
                  <button
                    className={`btn btn-sm ${accessOpen ? "btn-dark" : "btn-outline"}`}
                    onClick={() => toggleAccess(r.id)}
                  >
                    Erişim Yönetimi {accessOpen ? "▲" : "▼"}
                  </button>
                </div>

                {accessOpen && (
                  <div className="access-panel">
                    <div className="access-panel-header">
                      <span className="access-panel-title">Erişim Kayıtları</span>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => loadPurchasers(r.id)}
                        disabled={buyersLoading}
                      >
                        {buyersLoading ? <><span className="spinner-dark" /> Yükleniyor</> : "Yenile"}
                      </button>
                    </div>

                    {buyersLoading ? (
                      <div className="access-loading">
                        <span className="spinner-dark" />
                        Satın alma geçmişi blockchain'den alınıyor...
                      </div>
                    ) : buyers.length === 0 ? (
                      <div className="access-empty">
                        Bu kayıt henüz herhangi bir araştırmacı tarafından satın alınmamış.
                      </div>
                    ) : (
                      <div className="purchaser-list">
                        <div className="purchaser-list-label">
                          Satın Alanlar — {buyers.length} araştırmacı, {activeBuyers} aktif erişim
                        </div>
                        {buyers.map((b) => (
                          <div key={b.address} className="purchaser-row">
                            <div>
                              <div className="purchaser-addr" title={b.address}>{shortAddr(b.address)}</div>
                              <span className={`access-badge ${b.hasAccess ? "has-access" : "no-access"}`}>
                                {b.hasAccess ? "Erişim Aktif" : "Erişim İptal"}
                              </span>
                            </div>
                            {b.hasAccess && (
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => revokeAccess(r.id, b.address)}
                              >
                                İptal Et
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="revoke-manual">
                      <div className="access-panel-title" style={{ marginBottom: 10 }}>
                        Manuel Erişim İptali
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          className="form-input"
                          placeholder="Araştırmacı cüzdan adresi (0x...)"
                          value={revokeInputs[r.id] || ""}
                          onChange={(e) => setRevokeInputs((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          style={{ flex: 1 }}
                        />
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => revokeAccess(r.id, revokeInputs[r.id] || "")}
                          disabled={!revokeInputs[r.id]}
                        >
                          İptal Et
                        </button>
                      </div>
                      <p style={{ fontSize: ".72rem", color: "var(--gray-500)", marginTop: 8, lineHeight: 1.5 }}>
                        Listede görünmeyen bir araştırmacının erişimini iptal etmek için adresini doğrudan girin.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
