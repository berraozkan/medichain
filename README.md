# MediChain — Merkeziyetsiz Tıbbi Veri Pazaryeri

Hastalar, tıbbi verilerini tarayıcıda **AES-256-GCM** ile şifreleyip IPFS'e yükleyebilir ve Ethereum akıllı sözleşmesi aracılığıyla araştırmacılara satabilir. Ödeme aracısız, doğrudan hasta cüzdanına aktarılır.

---

## Mimari

```
Tarayıcı (React + ethers.js)
    │
    ├── Web Crypto API → AES-256-GCM şifreleme (istemci tarafında)
    │
    ├── Pinata API → Şifreli dosya + metadata JSON → IPFS
    │
    └── MetaMask → MediChain.sol (Sepolia Testnet)
```

### Veri Akışı (Yükleme)

1. Kullanıcı dosya seçer → tarayıcıda AES-256-GCM ile şifrelenir
2. Şifreli dosya IPFS'e yüklenir → `encryptedFileHash` elde edilir
3. `{fileName, category, description, encryptedFileHash, key, iv}` içeren metadata JSON'u IPFS'e yüklenir
4. Yalnızca metadata hash'i akıllı sözleşmeye kaydedilir

### Veri Akışı (Satın Alma & İndirme)

1. Araştırmacı `purchaseData(id)` çağırır, ETH hasta cüzdanına aktarılır
2. `getDataHash(id)` ile metadata hash'i okunur (yalnızca `hasAccess = true` ise)
3. IPFS'ten metadata JSON'u çekilir → şifre çözme anahtarı elde edilir
4. Şifreli dosya IPFS'ten indirilir ve tarayıcıda çözülür

---

## Akıllı Sözleşme

**Ağ:** Sepolia Testnet  
**Adres:** `0x400B1A0f31e228C7F48Cf5d7EFE12Bb28E116D2d`  
**Explorer:** [sepolia.etherscan.io](https://sepolia.etherscan.io/address/0x400B1A0f31e228C7F48Cf5d7EFE12Bb28E116D2d)

### Fonksiyonlar

| Fonksiyon | Açıklama |
|-----------|----------|
| `listData(ipfsHash, price)` | Şifreli kayıt metadata hash'ini ve fiyatını sisteme ekler |
| `purchaseData(id)` | ETH ödeyerek kayda erişim hakkı satın alır |
| `getDataHash(id)` | Erişim izni olanlara metadata hash'ini döner |
| `revokeAccess(id, researcher)` | Hasta, araştırmacının erişimini iptal eder |
| `delistData(id)` | Kayıt sahibi kaydı satıştan kaldırır |

---

## Kurulum

### Gereksinimler

- Node.js 18+
- MetaMask tarayıcı eklentisi
- Sepolia testnet ETH ([faucet](https://sepoliafaucet.com))
- Pinata hesabı ([pinata.cloud](https://pinata.cloud))

### Adımlar

```bash
# 1. Bağımlılıkları yükle
npm install
cd frontend && npm install && cd ..

# 2. Pinata JWT'yi yapılandır
echo "VITE_PINATA_JWT=<jwt_tokeniniz>" > frontend/.env

# 3. Frontend'i başlat
cd frontend && npm run dev
```

Tarayıcıda `http://localhost:5173` adresini açın. MetaMask'ı **Sepolia** ağına bağlayın.

---

## Testler

```bash
# Akıllı sözleşme testleri
npx hardhat test
```

`test/MediChain.ts` dosyası şu senaryoları kapsar:
- `listData`: kayıt oluşturma, event yayımı
- `purchaseData`: erişim verilmesi, ETH transferi, hata durumları
- `getDataHash`: yetkili/yetkisiz erişim
- `revokeAccess`: iptal, event yayımı, yetki kontrolü
- `delistData`: pasifleştirme, yetki kontrolü

---

## Yerel Geliştirme (Hardhat Node)

```bash
# 1. Yerel blockchain başlat
npx hardhat node

# 2. Sözleşmeyi deploy et
npx hardhat run deploy.js --network localhost

# 3. frontend/.env dosyasında adresi güncelle
# CONTRACT_ADDRESS = <deploy çıktısındaki adres>

# 4. MetaMask'a Localhost 8545 (Chain ID: 31337) ağını ekle
```

---

## Proje Yapısı

```
MEDICHAIN-main/
├── contracts/
│   └── MediChain.sol          # Akıllı sözleşme
├── test/
│   └── MediChain.ts           # Sözleşme testleri
├── deploy.js                  # Deploy scripti
├── hardhat.config.js
└── frontend/
    ├── src/
    │   ├── context/
    │   │   └── WalletContext.jsx  # Ethereum bağlantısı, sözleşme state'i
    │   ├── utils/
    │   │   └── crypto.js          # AES-256-GCM şifreleme/çözme
    │   ├── pages/
    │   │   ├── Home.jsx
    │   │   ├── Marketplace.jsx    # Kayıt listesi, satın alma
    │   │   ├── Upload.jsx         # Şifreleme + yükleme
    │   │   ├── MyData.jsx         # Hasta paneli
    │   │   └── Purchases.jsx      # Araştırmacı paneli
    │   └── components/
    │       ├── Header.jsx
    │       └── Toast.jsx
    └── .env                       # VITE_PINATA_JWT
```

---

## Güvenlik

- Şifreleme yalnızca istemci tarafında gerçekleşir; ham dosya sunucuya gönderilmez
- Şifre çözme anahtarı, `hasAccess` yetkisi olan kullanıcılara sözleşme üzerinden ulaşır
- IPFS içeriği content-addressed'dir; hash bilinmeden dosyaya ulaşılamaz
- Bu proje **Sepolia testnet** üzerinde çalışır; gerçek ETH kullanmayın
