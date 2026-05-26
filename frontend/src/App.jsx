import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletProvider, useWallet } from "./context/WalletContext";
import { CONTRACT_ADDRESS } from "./context/WalletContext";
import Header    from "./components/Header";
import Toast     from "./components/Toast";
import Home        from "./pages/Home";
import Marketplace from "./pages/Marketplace";
import Upload      from "./pages/Upload";
import MyData      from "./pages/MyData";
import Purchases   from "./pages/Purchases";
import NotFound    from "./pages/NotFound";
import "./App.css";


function Footer() {
  return (
    <footer className="footer">
      <p>
        <strong>MediChain</strong>
        <span className="footer-divider">|</span>
        Merkeziyetsiz Tıbbi Kayıt Platformu
        <span className="footer-divider">|</span>
        Sepolia Testnet
        <span className="footer-divider">|</span>
        <a
          href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
          target="_blank"
          rel="noreferrer"
        >
          Akıllı Sözleşme
        </a>
      </p>
    </footer>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <BrowserRouter>
        <Header />
        <div className="page-wrapper">
          <Routes>
            <Route path="/"            element={<Home />}        />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/upload"      element={<Upload />}      />
            <Route path="/my-data"     element={<MyData />}      />
            <Route path="/purchases"   element={<Purchases />}   />
            <Route path="*"            element={<NotFound />}    />
          </Routes>
        </div>
        <Footer />
        <Toast />
      </BrowserRouter>
    </WalletProvider>
  );
}
