# MediChain — UML Diyagramları

---

## 1. Sınıf Diyagramı (Class Diagram)

```mermaid
classDiagram
    direction TB

    %% ── Smart Contract katmanı ──────────────────────────────────────
    class MediChain {
        <<Solidity Contract>>
        +uint256 dataCount
        +mapping medicalRecords
        -mapping dataHashes
        +mapping hasAccess
        +mapping totalEarnings
        +listData(previewHash, dataHash, price)
        +purchaseData(id) payable
        +revokeAccess(id, researcher)
        +delistData(id)
        +relistData(id)
        +updatePrice(id, newPrice)
        +transferRecordOwnership(id, newOwner)
        +rotateKey(id, newPreviewHash, newDataHash)
        +deleteRecord(id)
        +getDataHash(id) view
    }

    class MedicalData {
        <<struct>>
        +string previewHash
        +uint256 price
        +address payable owner
        +bool isActive
    }

    class ReentrancyGuard {
        <<OpenZeppelin>>
        #nonReentrant modifier
    }

    MediChain --> MedicalData : içerir
    MediChain --|> ReentrancyGuard : miras alır

    %% ── API / Serverless katmanı ────────────────────────────────────
    class PrepareKeyHandler {
        <<Vercel Serverless>>
        -KEY_DERIVATION_SECRET: string
        +POST(patientAddress, previewHash, signature) K: string
        -verifySignature(message, signature, address) bool
        -hmacSha256(secret, data) hex
    }

    class GetKeyHandler {
        <<Vercel Serverless>>
        -KEY_DERIVATION_SECRET: string
        -SEPOLIA_RPC_URL: string
        +POST(recordId, requesterAddress, signature) K: string
        -verifySignature(message, signature, address) bool
        -checkOnChainAccess(address, recordId) bool
        -hmacSha256(secret, ownerAddress+previewHash) hex
    }

    class UploadIPFSHandler {
        <<Vercel Serverless>>
        -PINATA_JWT: string
        +POST(data, filename, contentType) IpfsHash: string
    }

    %% ── Frontend — Context ──────────────────────────────────────────
    class WalletContext {
        <<React Context>>
        +account: string
        +contract: ethers.Contract
        +records: MedicalRecord[]
        +loadingRecords: bool
        +toasts: Toast[]
        +connectWallet()
        +loadRecords()
        +addToast(message, type, duration)
        +removeToast(id)
    }

    class MedicalRecord {
        <<DTO>>
        +id: number
        +previewHash: string
        +price: BigInt
        +owner: string
        +isActive: bool
        +userHasAccess: bool
    }

    WalletContext "1" o-- "0..*" MedicalRecord : tutar

    %% ── Frontend — Sayfalar ─────────────────────────────────────────
    class UploadPage {
        <<React Component>>
        -file: File
        -price: string
        -category: string
        -description: string
        -loading: bool
        -progress: number
        +uploadAndList()
        -selectFile(f)
        -reset()
    }

    class MarketplacePage {
        <<React Component>>
        -filter: string
        -sort: string
        -categoryFilter: string
        -metadata: Map
        +fetchAllMetadata(records)
        +purchaseRecord(id, price)
        +viewRecord(id)
    }

    class MyDataPage {
        <<React Component>>
        -expandedAccess: Map
        -purchasers: Map
        -priceInputs: Map
        +loadPurchasers(recordId)
        +revokeAccess(recordId, addr)
        +delistRecord(id)
        +relistRecord(id)
        +updatePrice(recordId)
        +transferOwnership(recordId)
        +triggerRotateKey(recordId)
        +deleteRecord(recordId)
    }

    class PurchasesPage {
        <<React Component>>
        +viewRecord(id)
    }

    class Header {
        <<React Component>>
        +connectWallet()
    }

    %% ── Frontend — Yardımcılar ──────────────────────────────────────
    class CryptoUtils {
        <<ES Module>>
        +encryptFile(file) encryptedBytes,key,iv
        +encryptDataHash(cid, Khex) encStr
        +decryptDataHash(encStr, Khex) cid
        +decryptAndDownload(metadata)
    }

    class IPFSUtils {
        <<ES Module>>
        +uploadToIPFS(bytes, filename, contentType) hash
        +fetchFromIPFS(hash) Response
        +ipfsUrl(hash) string
    }

    %% ── İlişkiler ───────────────────────────────────────────────────
    UploadPage    ..> WalletContext : useWallet()
    MarketplacePage ..> WalletContext : useWallet()
    MyDataPage    ..> WalletContext : useWallet()
    PurchasesPage ..> WalletContext : useWallet()
    Header        ..> WalletContext : useWallet()

    UploadPage    ..> CryptoUtils : şifreler
    UploadPage    ..> IPFSUtils   : yükler
    MarketplacePage ..> IPFSUtils : metadata çeker
    MarketplacePage ..> CryptoUtils : şifre çözer
    MyDataPage    ..> CryptoUtils : anahtar rotasyonu
    MyDataPage    ..> IPFSUtils   : yeniden yükler

    WalletContext ..> MediChain : ethers.Contract
    UploadPage    ..> PrepareKeyHandler : POST /api/prepare-key
    MyDataPage    ..> PrepareKeyHandler : POST /api/prepare-key
    MarketplacePage ..> GetKeyHandler   : POST /api/get-key
    PurchasesPage ..> GetKeyHandler     : POST /api/get-key
    UploadPage    ..> UploadIPFSHandler : POST /api/upload-ipfs
    IPFSUtils     ..> UploadIPFSHandler : POST /api/upload-ipfs

    GetKeyHandler ..> MediChain : hasAccess() + medicalRecords()
```

---

## 2. Sıralama Diyagramı — Kayıt Yükleme (Upload) Akışı

```mermaid
sequenceDiagram
    actor Hasta as Hasta (Tarayıcı)
    participant UI as Upload Sayfası
    participant Crypto as crypto.js
    participant IPFS as ipfs.js
    participant API_IPFS as /api/upload-ipfs
    participant API_KEY as /api/prepare-key
    participant MM as MetaMask
    participant SC as MediChain Sözleşmesi
    participant Pinata as Pinata / IPFS

    Hasta->>UI: Dosya seç, kategori & fiyat gir
    Hasta->>UI: "Şifrele ve Listele" butonuna tıkla

    UI->>Crypto: encryptFile(file)
    Crypto-->>UI: { encryptedBytes, key, iv }

    UI->>IPFS: uploadToIPFS(encryptedBytes, "enc_dosya")
    IPFS->>API_IPFS: POST /api/upload-ipfs
    API_IPFS->>Pinata: pinFileToIPFS
    Pinata-->>API_IPFS: IpfsHash (encryptedFileHash)
    API_IPFS-->>IPFS: IpfsHash
    IPFS-->>UI: encryptedFileHash

    Note over UI: previewData = {version,category,description} (anahtar yok)<br/>fullData = {version,fileName,category,description,encryptedFileHash,key,iv}

    par Preview & Data JSON yükleme (paralel)
        UI->>IPFS: uploadToIPFS(previewData.json)
        IPFS->>API_IPFS: POST /api/upload-ipfs
        API_IPFS->>Pinata: pinFileToIPFS
        Pinata-->>API_IPFS: previewHash
        API_IPFS-->>UI: previewHash
    and
        UI->>IPFS: uploadToIPFS(fullData.json)
        IPFS->>API_IPFS: POST /api/upload-ipfs
        API_IPFS->>Pinata: pinFileToIPFS
        Pinata-->>API_IPFS: dataHash
        API_IPFS-->>UI: dataHash
    end

    UI->>MM: signMessage("MediChain anahtar talebi: addr:previewHash")
    MM-->>UI: signature

    UI->>API_KEY: POST /api/prepare-key {patientAddress, previewHash, signature}
    API_KEY->>API_KEY: verifySignature → adres eşleşmesi kontrol
    API_KEY->>API_KEY: K = HMAC-SHA256(secret, "addr:previewHash")
    API_KEY-->>UI: { K }

    UI->>Crypto: encryptDataHash(dataHash, K)
    Crypto-->>UI: "enc:<hex(iv+ciphertext)>"

    UI->>MM: contract.listData(previewHash, encDataHash, fiyat)
    MM->>SC: listData() tx
    SC->>SC: medicalRecords[id] = MedicalData<br/>dataHashes[id] = encDataHash
    SC-->>MM: DataListed event
    MM-->>UI: tx.wait() tamamlandı
    UI-->>Hasta: "Kayıt başarıyla eklendi"
```

---

## 3. Sıralama Diyagramı — Satın Alma & Dosya İndirme Akışı

```mermaid
sequenceDiagram
    actor Araştırmacı as Araştırmacı (Tarayıcı)
    participant UI as Marketplace Sayfası
    participant MM as MetaMask
    participant SC as MediChain Sözleşmesi
    participant API_KEY as /api/get-key
    participant Crypto as crypto.js
    participant IPFS_GW as IPFS Gateway

    Note over Araştırmacı,UI: ── 1. Satın Alma ──

    Araştırmacı->>UI: "Satın Al" butonuna tıkla
    UI->>MM: contract.purchaseData(id, {value: price})
    MM->>SC: purchaseData() ETH gönder

    SC->>SC: hasAccess[buyer][id] = true<br/>totalEarnings[owner] += price
    SC->>SC: owner.call{value: price} (ETH transfer)
    SC-->>MM: DataPurchased event
    MM-->>UI: tx.wait() tamamlandı
    UI-->>Araştırmacı: "Satın alındı, indirebilirsiniz"

    Note over Araştırmacı,UI: ── 2. Dosya İndirme ──

    Araştırmacı->>UI: "İndir" butonuna tıkla
    UI->>MM: contract.getDataHash(id)
    SC-->>UI: encDataHash ("enc:...")

    UI->>MM: signMessage("MediChain erişim talebi: id")
    MM-->>UI: signature

    UI->>API_KEY: POST /api/get-key {recordId, requesterAddress, signature}
    API_KEY->>API_KEY: verifySignature → adres eşleşmesi
    API_KEY->>SC: hasAccess(requester, id)
    SC-->>API_KEY: true
    API_KEY->>SC: medicalRecords(id) → owner, previewHash
    SC-->>API_KEY: owner, previewHash
    API_KEY->>API_KEY: K = HMAC-SHA256(secret, "owner:previewHash")
    API_KEY-->>UI: { K }

    UI->>Crypto: decryptDataHash(encDataHash, K)
    Crypto-->>UI: dataHash (gerçek IPFS CID)

    UI->>IPFS_GW: fetchFromIPFS(dataHash) — 3 gateway yarışı
    IPFS_GW-->>UI: fullData.json {encryptedFileHash, key, iv, ...}

    UI->>Crypto: decryptAndDownload(metadata)
    Crypto->>IPFS_GW: fetchFromIPFS(encryptedFileHash)
    IPFS_GW-->>Crypto: şifreli dosya bytes
    Crypto->>Crypto: AES-256-GCM decrypt(key, iv, bytes)
    Crypto-->>Araştırmacı: dosya indirildi (Blob → <a download>)
```

---

## 4. Bileşen / Mimari Diyagramı (Component Diagram)

```mermaid
graph TB
    subgraph Tarayıcı["🌐 Tarayıcı (React SPA)"]
        direction TB
        WC["WalletContext\n(ethers.js + MetaMask)"]
        UP["Upload\nSayfası"]
        MP["Marketplace\nSayfası"]
        MD["MyData\nSayfası"]
        PU["Purchases\nSayfası"]
        CR["crypto.js\n(Web Crypto API)"]
        IP["ipfs.js\n(Pinata + Gateways)"]
        UP --> WC
        MP --> WC
        MD --> WC
        PU --> WC
        UP --> CR
        UP --> IP
        MP --> IP
        MP --> CR
        MD --> CR
        MD --> IP
    end

    subgraph Vercel["☁️ Vercel (Serverless API)"]
        direction TB
        AK["/api/prepare-key\n(anahtar türetme)"]
        GK["/api/get-key\n(erişim doğrulama)"]
        UI2["/api/upload-ipfs\n(IPFS proxy)"]
    end

    subgraph Blockchain["⛓️ Ethereum Sepolia"]
        SC["MediChain.sol\n(Akıllı Sözleşme)"]
        MC3["Multicall3\n(toplu okuma)"]
    end

    subgraph IPFS["📦 IPFS / Pinata"]
        PIN["Pinata Pin API\n(yükleme)"]
        GW1["gateway.pinata.cloud"]
        GW2["ipfs.io"]
        GW3["dweb.link"]
    end

    MM["🦊 MetaMask\n(imza + tx)"]

    %% Bağlantılar
    WC <-->|"eth_requestAccounts\neth_chainId\nwallet_switch"| MM
    MM <-->|"listData / purchaseData\nrevokeAccess / rotateKey\ndeleteRecord"| SC
    WC <-->|"dataCount / medicalRecords\nhasAccess"| MC3
    MC3 <--> SC

    UP -->|"POST {data,filename}"| UI2
    MD -->|"POST {data,filename}"| UI2
    UI2 -->|"pinFileToIPFS"| PIN

    UP -->|"POST {addr,previewHash,sig}"| AK
    MD -->|"POST {addr,previewHash,sig}"| AK
    AK -->|"HMAC-SHA256"| AK

    MP -->|"POST {recordId,addr,sig}"| GK
    PU -->|"POST {recordId,addr,sig}"| GK
    GK <-->|"hasAccess / medicalRecords"| SC

    IP -->|"fetchFromIPFS"| GW1
    IP -->|"fetchFromIPFS"| GW2
    IP -->|"fetchFromIPFS"| GW3
```

---

## 5. Durum Diyagramı — Tıbbi Kayıt Yaşam Döngüsü

```mermaid
stateDiagram-v2
    [*] --> Aktif : listData()\nHasta kaydı yükler

    Aktif --> Pasif        : delistData()\nHasta satıştan kaldırır
    Pasif --> Aktif        : relistData()\nHasta tekrar listeler

    Aktif --> Aktif        : purchaseData()\nAraştırmacı satın alır\n[erişim açılır]
    Aktif --> Aktif        : revokeAccess()\nHasta erişimi iptal eder
    Aktif --> Aktif        : updatePrice()\nHasta fiyatı günceller
    Aktif --> Aktif        : rotateKey()\nHasta anahtarı döndürür
    Aktif --> Aktif        : transferOwnership()\nSahiplik devredilir

    Aktif --> Silindi      : deleteRecord()\nKriptografik silme\n(GDPR Md. 17)
    Pasif --> Silindi      : deleteRecord()\nKriptografik silme\n(GDPR Md. 17)

    Silindi --> [*]
```

---

## 6. Kullanım Senaryosu Diyagramı (Use Case)

```mermaid
graph LR
    subgraph Aktörler
        H(["👤 Hasta"])
        A(["🔬 Araştırmacı"])
        S(["🖥️ Sunucu (API)"])
    end

    subgraph MediChain Sistemi
        UC1["Cüzdan Bağla"]
        UC2["Kayıt Yükle & Listele"]
        UC3["Kayıt Satın Al"]
        UC4["Dosya İndir / Şifre Çöz"]
        UC5["Erişimi İptal Et"]
        UC6["Fiyat Güncelle"]
        UC7["Satıştan Kaldır / Tekrar Listele"]
        UC8["Şifreleme Anahtarı Döndür"]
        UC9["Sahipliği Devret"]
        UC10["Kaydı Kalıcı Sil"]
        UC11["İmza Doğrula & Anahtar Türet"]
        UC12["IPFS'e Yükle (Proxy)"]
    end

    H --> UC1
    H --> UC2
    H --> UC5
    H --> UC6
    H --> UC7
    H --> UC8
    H --> UC9
    H --> UC10

    A --> UC1
    A --> UC3
    A --> UC4

    UC2 --> UC11
    UC2 --> UC12
    UC4 --> UC11
    UC8 --> UC11
    UC8 --> UC12

    S --> UC11
    S --> UC12
```
