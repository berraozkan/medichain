import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { useWallet } from "../context/WalletContext";
import { encryptFile } from "../utils/crypto";
import { WalletIcon } from "../components/Icons";

const STEPS          = ["Dosya Seçimi", "Fiyat Belirleme", "Blockchain Kaydı"];
const CATEGORIES     = ["Kan Tahlili", "MRI / Görüntüleme", "EKG", "Röntgen", "Patoloji", "Ameliyat Raporu", "Diğer"];
const MAX_FILE_BYTES = 3.3 * 1024 * 1024;

function bytesToBase64(bytes) {
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function uploadBytesToIPFS(bytes, filename, contentType) {
  // Local dev: VITE_PINATA_JWT varsa doğrudan çağır (JWT bundle'a gömülmez çünkü prod'da bu değişken set edilmez)
  const devJwt = import.meta.env.VITE_PINATA_JWT;
  if (import.meta.env.DEV && devJwt) {
    const formData = new FormData();
    formData.append("file", new Blob([bytes], { type: contentType }), filename);
    const res  = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method:  "POST",
      headers: { Authorization: `Bearer ${devJwt}` },
      body:    formData,
    });
    const data = await res.json();
    if (!data.IpfsHash) throw new Error("IPFS yüklemesi başarısız oldu.");
    return data.IpfsHash;
  }

  // Production: JWT sunucu tarafında, istemciye hiç gönderilmez
  const res = await fetch("/api/upload-ipfs", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ data: bytesToBase64(new Uint8Array(bytes)), filename, contentType }),
  });
  const result = await res.json();
  if (!result.IpfsHash) throw new Error(result.error || "IPFS yüklemesi başarısız oldu.");
  return result.IpfsHash;
}

export default function Upload() {
  const { account, contract, connectWallet, addToast, removeToast, loadRecords } = useWallet();

  useEffect(() => {
    document.title = "MediChain — Kayıt Yükle";
  }, []);

  const [file, setFile]             = useState(null);
  const [price, setPrice]           = useState("");
  const [category, setCategory]     = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [loading, setLoading]       = useState(false);
  const [progress, setProgress]     = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [dragOver, setDragOver]     = useState(false);
  const [lastHash, setLastHash]     = useState(null);
  const fileInputRef = useRef(null);

  const stepIdx = file ? (price ? 2 : 1) : 0;

  async function uploadAndList() {
    if (!contract) { addToast("Önce cüzdanınızı bağlayın.", "error"); return; }
    if (!file)     { addToast("Lütfen bir dosya seçin.", "error"); return; }
    if (file.size > MAX_FILE_BYTES) {
      addToast(`Dosya çok büyük (${(file.size / 1024 / 1024).toFixed(1)} MB). Maksimum 3.3 MB.`, "error"); return;
    }
    if (!price || isNaN(price) || Number(price) <= 0) {
      addToast("Geçerli bir fiyat giriniz (örn: 0.01).", "error"); return;
    }
    setLoading(true);
    setProgress(10);
    setActiveStep(1);
    let activeToastId = addToast("Dosya şifreleniyor...", "loading", 0);

    try {
      // 1. Dosyayı şifrele
      const { encryptedBytes, key, iv } = await encryptFile(file);
      setProgress(25);

      removeToast(activeToastId);
      activeToastId = addToast("Şifreli dosya IPFS'e yükleniyor...", "loading", 0);

      // 2. Şifreli dosyayı IPFS'e yükle
      const encryptedFileHash = await uploadBytesToIPFS(
        encryptedBytes,
        `enc_${file.name}`,
        "application/octet-stream"
      );
      setProgress(50);

      removeToast(activeToastId);
      activeToastId = addToast("Metadata IPFS'e yükleniyor...", "loading", 0);

      // 3a. Herkese açık önizleme JSON (şifreleme anahtarı içermez)
      const previewData = {
        version: 2,
        category,
        description: description.trim(),
      };
      // 3b. Özel veri JSON (şifreleme anahtarını içerir — sadece yetkililere)
      const fullData = {
        version: 2,
        fileName: file.name,
        category,
        description: description.trim(),
        encryptedFileHash,
        key,
        iv,
      };
      const enc = new TextEncoder();
      const [previewHash, dataHash] = await Promise.all([
        uploadBytesToIPFS(enc.encode(JSON.stringify(previewData)), "preview.json", "application/json"),
        uploadBytesToIPFS(enc.encode(JSON.stringify(fullData)),    "data.json",    "application/json"),
      ]);
      setProgress(70);

      setActiveStep(2);
      removeToast(activeToastId);
      activeToastId = addToast("İşlem blockchain'e gönderiliyor...", "loading", 0);

      // 4. İki hash'i ve fiyatı akıllı sözleşmeye kaydet
      const tx = await contract.listData(previewHash, dataHash, ethers.parseEther(price));
      setProgress(85);
      await tx.wait();
      setProgress(100);
      setActiveStep(3);
      setLastHash(previewHash);

      removeToast(activeToastId);
      activeToastId = null;
      addToast("Kayıt başarıyla sisteme eklendi.", "success");
      loadRecords();
    } catch (e) {
      if (activeToastId) removeToast(activeToastId);
      addToast("Hata: " + e.message, "error");
      setActiveStep(0);
      setProgress(0);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFile(null); setPrice(""); setCategory(CATEGORIES[0]); setDescription("");
    setActiveStep(0); setProgress(0); setLastHash(null);
  }

  function selectFile(f) {
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      addToast(
        `Dosya çok büyük (${(f.size / 1024 / 1024).toFixed(1)} MB). Maksimum boyut 3.3 MB'dır.`,
        "error",
        7000
      );
      return;
    }
    setFile(f);
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    selectFile(e.dataTransfer.files[0]);
  }

  if (!account) {
    return (
      <main className="main">
        <div className="empty" style={{ paddingTop: 80 }}>
          <div className="empty-icon"><WalletIcon size={44} color="var(--gray-300)" /></div>
          <h3>Cüzdan Bağlantısı Gerekli</h3>
          <p>Kayıt ekleyebilmek için MetaMask cüzdanınızı bağlamanız gerekmektedir.</p>
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
          <p className="section-label">Kayıt Ekle</p>
          <h1 className="page-title">Tıbbi Kayıt Yükle</h1>
          <p className="page-subtitle">
            Dosyanız AES-256-GCM ile tarayıcınızda şifrelenir; şifreli hali IPFS'e yüklenir.
            Şifre çözme anahtarı yalnızca satın alan araştırmacıya iletilir.
          </p>
        </div>
        <Link to="/marketplace" className="btn btn-ghost">
          Pazar Yerine Dön
        </Link>
      </div>

      <div className="step-indicator">
        {STEPS.map((s, i) => (
          <div key={s} className={`step-item ${i < stepIdx ? "done" : i === stepIdx ? "current" : ""}`}>
            <div className="step-circle">{i < stepIdx ? "✓" : i + 1}</div>
            <span className="step-label">{s}</span>
            {i < STEPS.length - 1 && <div className="step-line" />}
          </div>
        ))}
      </div>

      {activeStep === 3 ? (
        <div className="upload-success">
          <div className="success-icon">✓</div>
          <h2>Kayıt Başarıyla Eklendi</h2>
          <p>Tıbbi kaydınız AES-256-GCM ile şifrelenmiş olarak pazar yerinde yayınlandı.</p>
          <div className="success-hash">
            <span>Metadata IPFS Hash</span>
            <code>{lastHash}</code>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/marketplace" className="btn btn-primary">Pazar Yerini Görüntüle</Link>
            <button className="btn btn-ghost" onClick={reset}>Yeni Kayıt Ekle</button>
          </div>
        </div>
      ) : (
        <div className="grid-upload">
          <div className="card">
            <div className="card-header">
              <div className="card-icon card-icon-blue">+</div>
              <div>
                <div className="card-title">Kayıt Bilgileri</div>
                <div className="card-subtitle">Dosya, kategori ve fiyat bilgilerini girin</div>
              </div>
            </div>
            <div className="card-body">
              {/* Dosya */}
              <div className="form-group">
                <label className="form-label">Dosya</label>
                <div
                  className={`file-drop ${dragOver ? "dragover" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <input ref={fileInputRef} type="file" onChange={(e) => selectFile(e.target.files[0])} />
                  <div className="file-drop-icon">↑</div>
                  {file ? (
                    <div>
                      <span className="file-name">{file.name}</span>
                      <p style={{ marginTop: 6, fontSize: ".75rem", color: "var(--gray-400)" }}>
                        {file.size >= 1024 * 1024
                          ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
                          : `${(file.size / 1024).toFixed(1)} KB`}
                        {" / maks. 3.3 MB"}
                      </p>
                    </div>
                  ) : (
                    <p>
                      <strong>Dosya seçmek için tıklayın</strong> ya da buraya sürükleyin.<br />
                      Maksimum dosya boyutu: 3.3 MB
                    </p>
                  )}
                </div>
              </div>

              {/* Kategori */}
              <div className="form-group">
                <label className="form-label">Kategori</label>
                <select
                  className="form-input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Açıklama */}
              <div className="form-group">
                <label className="form-label">Açıklama <span style={{ color: "var(--gray-400)", fontWeight: 400, textTransform: "none" }}>(isteğe bağlı)</span></label>
                <textarea
                  className="form-input"
                  placeholder="Örn: 2024 yılı rutin kan tahlili, 35 yaş erkek hasta..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  style={{ resize: "vertical" }}
                />
              </div>

              {/* Fiyat */}
              <div className="form-group">
                <label className="form-label">Satış Fiyatı (ETH)</label>
                <div style={{ position: "relative" }}>
                  <input
                    className="form-input"
                    type="number" step="0.001" min="0"
                    placeholder="Örnek: 0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    style={{ paddingRight: 52 }}
                  />
                  <span style={{
                    position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)",
                    fontSize: ".75rem", fontWeight: 700, color: "var(--gray-400)", letterSpacing: ".04em"
                  }}>ETH</span>
                </div>
                {price && !isNaN(price) && Number(price) > 0 && (
                  <p style={{ fontSize: ".75rem", color: "var(--success)", marginTop: 5 }}>
                    Her satışta {price} ETH alacaksınız.
                  </p>
                )}
              </div>

              {progress > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".75rem", color: "var(--gray-500)", marginBottom: 6 }}>
                    <span>
                      {activeStep === 1
                        ? progress < 30 ? "Şifreleniyor..." : "IPFS'e yükleniyor..."
                        : "Blockchain'e kaydediliyor..."}
                    </span>
                    <span style={{ fontWeight: 600 }}>{progress}%</span>
                  </div>
                  <div className="progress-bar-wrap">
                    <div className="progress-bar" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              <button
                className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={uploadAndList}
                disabled={loading}
              >
                {loading ? <><span className="spinner" /> İşleniyor...</> : "Şifrele ve Listele"}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card">
              <div className="card-header">
                <div className="card-icon card-icon-slate">i</div>
                <div>
                  <div className="card-title">Süreç Hakkında</div>
                  <div className="card-subtitle">Arka planda gerçekleşen adımlar</div>
                </div>
              </div>
              <div className="card-body">
                {[
                  { step: "1", title: "AES-256-GCM Şifreleme", desc: "Dosya, tarayıcınızda rastgele üretilen bir anahtar ile şifrelenir. Ham dosya asla sunucuya gönderilmez." },
                  { step: "2", title: "IPFS Yüklemesi", desc: "Yalnızca şifreli dosya Pinata aracılığıyla IPFS'e yüklenir. Şifre çözme anahtarı metadata JSON'unda saklanır." },
                  { step: "3", title: "Blockchain Kaydı", desc: "Metadata hash'i ve fiyat akıllı sözleşmeye yazılır. Anahtar yalnızca hasAccess yetkisi olanlara ulaşır." },
                  { step: "4", title: "Satış", desc: "Araştırmacı satın aldığında ETH doğrudan hesabınıza aktarılır; şifreli dosyayı çözecek anahtarı elde eder." },
                ].map((item) => (
                  <div key={item.step} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--gray-100)" }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: "var(--gray-100)", color: "var(--gray-500)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: ".7rem", fontWeight: 700, flexShrink: 0, marginTop: 2
                    }}>{item.step}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: ".85rem", marginBottom: 2, color: "var(--gray-800)" }}>{item.title}</div>
                      <div style={{ fontSize: ".78rem", color: "var(--gray-500)", lineHeight: 1.5 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="info-box info-box-info">
              <strong>Güvenlik Notu:</strong> Şifreleme Web Crypto API (AES-256-GCM) ile tarayıcınızda gerçekleşir.
              Şifre çözme anahtarı yalnızca akıllı sözleşme üzerinden erişim yetkisi kazanan araştırmacıya ulaşır.
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
