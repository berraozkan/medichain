import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { LockIcon, ChainIcon, TransferIcon, KeyIcon } from "../components/Icons";

const features = [
  {
    Icon: LockIcon,
    color: "var(--primary)",
    bg: "var(--primary-light)",
    title: "AES-256-GCM Şifreleme",
    desc: "Dosyalar sunucuya ulaşmadan tarayıcıda şifrelenir. IPFS'e yalnızca şifreli veri yüklenir; ham kayıt asla ağa çıkmaz.",
  },
  {
    Icon: ChainIcon,
    color: "var(--success)",
    bg: "var(--success-light)",
    title: "Blockchain Güvencesi",
    desc: "Erişim hakları ve işlem geçmişi Ethereum akıllı sözleşmesinde tutulur; kayıtlar değiştirilemez ve şeffaftır.",
  },
  {
    Icon: TransferIcon,
    color: "#c2410c",
    bg: "#fff7ed",
    title: "Aracısız Ödeme",
    desc: "Araştırmacı veri satın aldığında ETH, herhangi bir aracı platform olmaksızın doğrudan hasta cüzdanına aktarılır.",
  },
  {
    Icon: KeyIcon,
    color: "#6d28d9",
    bg: "#f5f3ff",
    title: "Erişim Yönetimi",
    desc: "Her araştırmacı için erişim izni bağımsız olarak yönetilir; hasta istediği zaman yetkiyi iptal edebilir.",
  },
];

const steps = [
  {
    role: "Hasta",
    color: "card-icon-blue",
    letter: "H",
    items: [
      "MetaMask cüzdanını bağla",
      "Tıbbi kaydı seç; kategori, açıklama ve satış fiyatını belirle",
      "Dosya tarayıcıda AES-256-GCM ile şifrelenir, IPFS'e yüklenir ve metadata hash'i blockchain'e kaydedilir",
      "Her satın alımda ETH otomatik olarak cüzdana aktarılır",
      "Araştırmacı erişimleri istenildiğinde iptal edilebilir",
    ],
  },
  {
    role: "Araştırmacı",
    color: "card-icon-green",
    letter: "A",
    items: [
      "MetaMask cüzdanını bağla",
      "Pazar yerinde listelenen tıbbi kayıtları incele",
      "Satın alma işlemini MetaMask üzerinden onayla",
      "Erişim hakkı anında akıllı sözleşmeye kaydedilir",
      "Şifreli dosyayı \"Satın Aldıklarım\" panelinden indir",
    ],
  },
];

export default function Home() {
  const { account, connectWallet, records } = useWallet();
  const activeCount = records.filter((r) => r.isActive).length;
  const connected   = account !== null;

  useEffect(() => {
    document.title = "MediChain — Ana Sayfa";
  }, []);

  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-inner">
          {/* Sol — başlık ve aksiyonlar */}
          <div className="hero-text">
            <div className="hero-eyebrow">Merkeziyetsiz Sağlık Verisi Platformu</div>
            <h1>
              Tıbbi Kayıtlarınızı<br />
              <em>Güvenle Paylaşın</em>
            </h1>
            <p>
              MediChain; hastalar ile tıbbi araştırmacılar arasında uçtan uca şifreli,
              blockchain tabanlı ve aracısız bir tıbbi veri paylaşım altyapısı sunar.
            </p>
            <div className="hero-actions">
              <Link to="/marketplace" className="btn btn-primary btn-lg">
                Pazar Yerini İncele
              </Link>
              {account ? (
                <Link to="/upload" className="btn btn-hero-ghost btn-lg">
                  Kayıt Ekle
                </Link>
              ) : (
                <button className="btn btn-hero-ghost btn-lg" onClick={connectWallet}>
                  Cüzdan Bağla
                </button>
              )}
            </div>
          </div>

          {/* Sağ — teknik mimari kartı */}
          <div className="hero-spec-card">
            <div className="hero-spec-label">Teknik Mimari</div>
            <div className="hero-spec-row">
              <span>Şifreleme</span><span>AES-256-GCM</span>
            </div>
            <div className="hero-spec-row">
              <span>Depolama</span><span>IPFS / Pinata</span>
            </div>
            <div className="hero-spec-row">
              <span>Blockchain</span><span>Ethereum</span>
            </div>
            <div className="hero-spec-row">
              <span>Test Ağı</span><span>Sepolia</span>
            </div>
            <div className="hero-spec-row">
              <span>Sözleşme</span><span>Solidity 0.8.28</span>
            </div>
            <div className="hero-spec-divider" />
            <div className="hero-spec-check">İstemci taraflı şifreleme</div>
            <div className="hero-spec-check">Akıllı sözleşme erişim kontrolü</div>
            <div className="hero-spec-check">Aracısız ETH transferi</div>
          </div>
        </div>

        {/* İstatistikler — tam genişlik alt satır */}
        <div className="hero-stats">
          <div className="hero-stat">
            <div className="hero-stat-value">{connected ? records.length : "—"}</div>
            <div className="hero-stat-label">Toplam Kayıt</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-value">{connected ? activeCount : "—"}</div>
            <div className="hero-stat-label">Aktif Listeleme</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-value">100%</div>
            <div className="hero-stat-label">Merkeziyetsiz</div>
          </div>
        </div>
      </section>

      <main className="main" style={{ paddingTop: 24 }}>

        <div>
          <p className="section-label">Platform Avantajları</p>
          <h2 className="section-title">Kontrol Tamamen Sizde</h2>
          <div className="features-grid" style={{ marginTop: 20 }}>
            {features.map((f) => (
              <div className="feature-card" key={f.title}>
                <div style={{
                  width: 46, height: 46, borderRadius: 10,
                  background: f.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 14, color: f.color,
                }}>
                  <f.Icon size={22} color={f.color} />
                </div>
                <div className="feature-title">{f.title}</div>
                <div className="feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <hr className="divider" />

        <div>
          <p className="section-label">Kullanım Rehberi</p>
          <h2 className="section-title">İki Rol, Tek Platform</h2>
          <div className="grid-2" style={{ marginTop: 20 }}>
            {steps.map((s, si) => (
              <div className="card" key={s.role}>
                <div className="card-header">
                  <div className={`card-icon ${s.color}`}>{s.letter}</div>
                  <div>
                    <div className="card-title">{s.role} olarak kullanım</div>
                    <div className="card-subtitle">Adım adım süreç</div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="test-steps">
                    {s.items.map((text, i) => (
                      <div className="test-step" key={i}>
                        <span className={`test-step-n ${si === 1 ? "green" : ""}`}>{i + 1}</span>
                        <span className="test-step-text">{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <hr className="divider" />

        <div className="cta-section">
          <div className="cta-title">Platforma Hemen Katılın</div>
          <p className="cta-desc">
            Cüzdanınızı bağlayın, tıbbi kaydınızı yükleyin ve araştırmacılarla güvenli bağlantı kurun.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/marketplace" className="btn btn-primary btn-lg">
              Pazar Yerini İncele
            </Link>
            <Link to="/upload" className="btn btn-hero-ghost btn-lg">
              Kayıt Ekle
            </Link>
          </div>
        </div>

      </main>
    </div>
  );
}
