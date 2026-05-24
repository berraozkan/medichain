import { useEffect } from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  useEffect(() => {
    document.title = "MediChain — Sayfa Bulunamadı";
  }, []);

  return (
    <main className="main">
      <div className="not-found">
        <div className="not-found-code">404</div>
        <h2>Sayfa Bulunamadı</h2>
        <p>Aradığınız sayfa mevcut değil veya taşınmış olabilir.</p>
        <Link to="/" className="btn btn-primary">
          Ana Sayfaya Dön
        </Link>
      </div>
    </main>
  );
}
