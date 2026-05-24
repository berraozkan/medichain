import { useWallet } from "../context/WalletContext";

const LABELS = {
  success: "Başarılı",
  error:   "Hata",
  info:    "Bilgi",
  loading: "İşleniyor",
};

export default function Toast() {
  const { toasts, removeToast } = useWallet();
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="toast-label">{LABELS[t.type]}</span>
            <button
              onClick={() => removeToast(t.id)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--gray-400)", fontSize: "1rem", lineHeight: 1,
                padding: "0 0 0 8px", fontFamily: "inherit",
              }}
              aria-label="Kapat"
            >
              ×
            </button>
          </div>
          <span className="toast-msg">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
