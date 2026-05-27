# MediChain — Merkeziyetsiz Tıbbi Veri Pazaryeri

Hastalar, tıbbi verilerini tarayıcıda **AES-256-GCM** ile şifreleyip IPFS'e yükleyebilir ve Ethereum akıllı sözleşmesi aracılığıyla araştırmacılara satabilir. Ödeme aracısız, doğrudan hasta cüzdanına aktarılır.

---

## Mimari

```
Tarayıcı (React + ethers.js)
    │
    ├── Web Crypto API → AES-256-GCM şifreleme (istemci tarafında)
    │
    ├── /api/upload-ipfs (Vercel serverless) → Pinata → IPFS
    │
    └── MetaMask → MediChain.sol (Sepolia Testnet)
```

### İki Hash Güvenlik Mimarisi

Her kayıt IPFS'te **iki ayrı JSON** olarak saklanır:

| Dosya | İçerik | Erişim |
|-------|--------|--------|
| `preview.json` | `{ category, description }` | Herkese açık (pazar yeri önizlemesi) |
| `data.json` | `{ fileName, encryptedFileHash, key, iv }` | Yalnızca sahip veya alıcı |

Akıllı sözleşmede `previewHash` public mapping'de, `dataHash` private mapping'de tutulur. Şifre çözme anahtarı (`key`) yalnızca `getDataHash()` yetkisi olan kullanıcılara ulaşır.

### Veri Akışı (Yükleme)

1. Dosya tarayıcıda AES-256-GCM ile şifrelenir → `encryptedFileHash` IPFS'e yüklenir
2. `preview.json` ve `data.json` paralel olarak IPFS'e yüklenir (sunucu taraflı JWT ile)
3. `listData(previewHash, dataHash, price)` çağrısıyla her iki hash akıllı sözleşmeye kaydedilir

### Veri Akışı (Satın Alma & İndirme)

1. Araştırmacı `purchaseData(id)` çağırır → ETH doğrudan hasta cüzdanına aktarılır
2. `getDataHash(id)` ile `data.json` hash'i okunur (yalnızca `hasAccess = true` ise)
3. IPFS'ten `data.json` çekilir → şifre çözme anahtarı elde edilir
4. Şifreli dosya IPFS'ten indirilir, tarayıcıda çözülür ve yerel olarak kaydedilir

---

## Akıllı Sözleşme

**Ağ:** Sepolia Testnet  
**Adres:** `0x96016fDe170Eb2e6E6b54f34C767319Fc8e8D946`  
**Explorer:** [sepolia.etherscan.io](https://sepolia.etherscan.io/address/0x96016fDe170Eb2e6E6b54f34C767319Fc8e8D946)

### Fonksiyonlar

| Fonksiyon | Açıklama |
|-----------|----------|
| `listData(previewHash, dataHash, price)` | Yeni kayıt ekler; iki hash ve fiyatı kaydeder |
| `purchaseData(id)` | ETH ödeyerek kayda erişim hakkı satın alır |
| `getDataHash(id)` | Sahip veya alıcıya `data.json` hash'ini döner |
| `revokeAccess(id, researcher)` | Hasta, araştırmacının erişimini iptal eder |
| `delistData(id)` | Kaydı satıştan kaldırır |
| `relistData(id)` | Pasif kaydı tekrar aktif eder |
| `updatePrice(id, newPrice)` | Satış fiyatını günceller |
| `transferRecordOwnership(id, newOwner)` | Kaydın sahipliğini başka bir adrese devreder |
| `rotateKey(id, newPreviewHash, newDataHash)` | Şifre çözme anahtarını döndürür; eski araştırmacıların anahtarını geçersiz kılar |
| `deleteRecord(id)` | Kriptografik silme: hash'leri temizler, kaydı kalıcı olarak devre dışı bırakır (GDPR Art. 17) |

### Güvenlik

- **ReentrancyGuard** (OpenZeppelin) — `purchaseData` yeniden giriş saldırılarına karşı korumalı
- **CEI deseni** — state değişiklikleri ETH transferinden önce gerçekleşir
- **Private mapping** — `dataHashes` sözleşme ABI'sinde görünmez, yalnızca `getDataHash()` ile erişilir
- **Sahip koruması** — kullanıcı kendi kaydını satın alamaz

---

## Kurulum

### Gereksinimler

- Node.js 22+
- MetaMask tarayıcı eklentisi
- Sepolia testnet ETH ([sepoliafaucet.com](https://sepoliafaucet.com))
- Pinata hesabı ([pinata.cloud](https://pinata.cloud))

### Adımlar

```bash
# 1. Bağımlılıkları yükle
npm install
cd frontend && npm install && cd ..

# 2. Ortam değişkenlerini yapılandır
cp .env.example .env                        # SEPOLIA_RPC_URL, PRIVATE_KEY
cp frontend/.env.example frontend/.env     # VITE_PINATA_JWT (local dev)

# 3. Frontend'i başlat
cd frontend && npm run dev
```

Tarayıcıda `http://localhost:5173` adresini açın. MetaMask'ı **Sepolia** ağına bağlayın.

### Ortam Değişkenleri

**`frontend/.env`** (yerel geliştirme):

| Değişken | Zorunlu | Açıklama |
|----------|---------|----------|
| `VITE_PINATA_JWT` | Evet (local) | Pinata API JWT — yalnızca `npm run dev`'de kullanılır |
| `VITE_SEPOLIA_RPC_URL` | Hayır | Özel RPC URL; boş bırakılırsa Ankr public endpoint kullanılır |

**Vercel Dashboard → Settings → Environment Variables** (production):

| Değişken | Açıklama |
|----------|----------|
| `PINATA_JWT` | Sunucu taraflı Pinata JWT; istemciye hiç gönderilmez |

---

## Testler

```bash
npx hardhat test test/MediChain.ts
```

**51 test**, 10 grup:

| Grup | Test Sayısı |
|------|-------------|
| `listData` | 7 |
| `purchaseData` | 9 |
| `getDataHash` | 5 |
| `revokeAccess` | 4 |
| `delistData / relistData` | 6 |
| `updatePrice` | 4 |
| `transferRecordOwnership` | 5 |
| `totalEarnings` | 1 |
| `rotateKey` | 5 |
| `deleteRecord` | 4 |

CI her `push` ve `pull_request`'te otomatik olarak çalışır (GitHub Actions).

---

## Yerel Geliştirme (Hardhat Node)

```bash
# 1. Yerel blockchain başlat
npx hardhat node

# 2. Sözleşmeyi deploy et
npx hardhat run deploy.js --network localhost

# 3. WalletContext.jsx içindeki CONTRACT_ADDRESS sabitini güncelle
# 4. MetaMask'a Localhost 8545 (Chain ID: 31337) ağını ekle
```

## Sepolia'ya Deploy

```bash
# .env dosyasını doldur: SEPOLIA_RPC_URL ve PRIVATE_KEY
npx hardhat run deploy.js --network sepolia
# Çıktıdaki adresi frontend/src/context/WalletContext.jsx içinde güncelle
```

---

## Proje Yapısı

```
MEDICHAIN-main/
├── contracts/
│   └── MediChain.sol              # Akıllı sözleşme (OpenZeppelin ReentrancyGuard)
├── test/
│   └── MediChain.ts               # 42 sözleşme testi
├── ignition/modules/
│   └── MediChain.js               # Hardhat Ignition deploy modülü
├── deploy.js                      # Alternatif deploy scripti
├── hardhat.config.js
├── .env.example                   # Sözleşme deploy ortam değişkenleri
├── api/
│   └── upload-ipfs.js             # Vercel serverless: Pinata JWT proxy
├── vercel.json                    # Vercel build + rewrite konfigürasyonu
└── frontend/
    ├── .env.example               # Frontend ortam değişkenleri
    ├── vite.config.js             # Code splitting: ethers / vendor / app
    └── src/
        ├── context/
        │   └── WalletContext.jsx  # Ethereum bağlantısı, kayıt state'i, hasAccess
        ├── utils/
        │   ├── crypto.js          # AES-256-GCM şifreleme / çözme
        │   └── ipfs.js            # IPFS gateway sabiti (ipfsUrl helper)
        ├── pages/
        │   ├── Home.jsx
        │   ├── Marketplace.jsx    # Kayıt listesi, kategori filtresi, satın alma
        │   ├── Upload.jsx         # Şifreleme + çift IPFS yüklemesi (maks. 3.3 MB)
        │   ├── MyData.jsx         # Hasta paneli: erişim yönetimi, fiyat, devir
        │   ├── Purchases.jsx      # Araştırmacı paneli: indirme
        │   └── NotFound.jsx
        └── components/
            ├── Header.jsx         # Navigasyon, karanlık mod, cüzdan butonu
            ├── Toast.jsx          # Bildirim sistemi
            └── Icons.jsx
```

---

## Kısıtlamalar ve Tasarım Kararları

### Anahtar Geri Alma
`revokeAccess` on-chain erişimi kaldırır; ancak araştırmacının daha önce aldığı şifre çözme anahtarı (`key`, `iv`) geçersiz kılınamaz. Tam çözüm için iki yaklaşım mevcuttur:

- **Anahtar rotasyonu (uygulandı):** `rotateKey(id, newPreviewHash, newDataHash)` — Hasta dosyayı yeni bir anahtarla yeniden şifreleyip yükler; eski araştırmacı yeni şifreli dosyayı çözemez.
- **Proxy Re-Encryption (önerilen gelecek çalışma):** Lit Protocol gibi bir ağ, anahtarı kullanıcıya hiç göndermeden on-chain koşul üzerinden erişimi anlık olarak denetler.

### GDPR Uyumu (Silinme Hakkı — Art. 17)
IPFS içerik-adreslidir; fiziksel silme mümkün değildir. `deleteRecord(id)` fonksiyonu **kriptografik silme** uygular:

1. Hash'ler sözleşmeden temizlenir → `getDataHash` artık revert eder
2. Pinata pin kaldırıldıktan sonra şifreli dosya IPFS'ten erişilemez hale gelir
3. Şifre çözme anahtarı olmadan kalan şifreli veri anlamsızdır

Bu yaklaşım GDPR Art. 17 kapsamında kabul gören *cryptographic erasure* tekniğidir. Blockchain tabanlı sistemlerde fiziksel silmeyle eşdeğer olduğu tartışılmakla birlikte akademik literatürde savunulabilir konumdadır.

### Diğer Sınırlılıklar
- **Maksimum dosya boyutu: 3.3 MB** — Vercel serverless body limiti (4.5 MB) ve base64 şişirmesi nedeniyle
- **Sepolia testnet** — Gerçek ETH kullanmayın
- **IPFS kalıcılığı** — Pinata ücretsiz planda pin'ler silinebilir
