import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

async function deploy() {
  const [patient, researcher, other] = await ethers.getSigners();
  const MediChain = await ethers.getContractFactory("MediChain");
  const contract  = await MediChain.deploy();
  return { contract, patient, researcher, other };
}

const PRICE        = ethers.parseEther("0.01");
const PREVIEW_HASH = "QmPreviewHash";
const DATA_HASH    = "QmDataHash";

async function listed(ctx: Awaited<ReturnType<typeof deploy>>) {
  await ctx.contract.connect(ctx.patient).listData(PREVIEW_HASH, DATA_HASH, PRICE);
  return ctx;
}

async function purchased(ctx: Awaited<ReturnType<typeof deploy>>) {
  await listed(ctx);
  await ctx.contract.connect(ctx.researcher).purchaseData(1, { value: PRICE });
  return ctx;
}

describe("MediChain", function () {

  // ── listData ──────────────────────────────────────────────────────────────
  describe("listData", function () {
    it("dataCount artar", async function () {
      const { contract, patient } = await deploy();
      await contract.connect(patient).listData(PREVIEW_HASH, DATA_HASH, PRICE);
      expect(await contract.dataCount()).to.equal(1n);
    });

    it("kayıt doğru alanlarla oluşur", async function () {
      const ctx = await deploy();
      await listed(ctx);
      const r = await ctx.contract.medicalRecords(1);
      expect(r.previewHash).to.equal(PREVIEW_HASH);
      expect(r.price).to.equal(PRICE);
      expect(r.owner).to.equal(ctx.patient.address);
      expect(r.isActive).to.be.true;
    });

    it("DataListed olayını yayar", async function () {
      const { contract, patient } = await deploy();
      await expect(contract.connect(patient).listData(PREVIEW_HASH, DATA_HASH, PRICE))
        .to.emit(contract, "DataListed")
        .withArgs(1n, patient.address, PRICE);
    });

    it("birden fazla kayıt eklenebilir", async function () {
      const { contract, patient } = await deploy();
      await contract.connect(patient).listData("QmPreview1", "QmData1", PRICE);
      await contract.connect(patient).listData("QmPreview2", "QmData2", PRICE * 2n);
      expect(await contract.dataCount()).to.equal(2n);
    });

    it("boş previewHash reddeder", async function () {
      const { contract, patient } = await deploy();
      await expect(
        contract.connect(patient).listData("", DATA_HASH, PRICE)
      ).to.be.revertedWith("Onizleme hash bos olamaz");
    });

    it("boş dataHash reddeder", async function () {
      const { contract, patient } = await deploy();
      await expect(
        contract.connect(patient).listData(PREVIEW_HASH, "", PRICE)
      ).to.be.revertedWith("Veri hash bos olamaz");
    });

    it("sıfır fiyatı reddeder", async function () {
      const { contract, patient } = await deploy();
      await expect(
        contract.connect(patient).listData(PREVIEW_HASH, DATA_HASH, 0n)
      ).to.be.revertedWith("Fiyat sifirdan buyuk olmali");
    });
  });

  // ── purchaseData ──────────────────────────────────────────────────────────
  describe("purchaseData", function () {
    it("erişim hakkı verir", async function () {
      const ctx = await listed(await deploy());
      await ctx.contract.connect(ctx.researcher).purchaseData(1, { value: PRICE });
      expect(await ctx.contract.hasAccess(ctx.researcher.address, 1)).to.be.true;
    });

    it("ETH'yi tam fiyat olarak sahibe aktarır", async function () {
      const ctx = await listed(await deploy());
      const before = await ethers.provider.getBalance(ctx.patient.address);
      await ctx.contract.connect(ctx.researcher).purchaseData(1, { value: PRICE });
      const after  = await ethers.provider.getBalance(ctx.patient.address);
      expect(after - before).to.equal(PRICE);
    });

    it("fazla ödemeyi alıcıya iade eder", async function () {
      const ctx = await listed(await deploy());
      const overpay = PRICE * 3n;
      const before  = await ethers.provider.getBalance(ctx.researcher.address);
      const tx      = await ctx.contract.connect(ctx.researcher).purchaseData(1, { value: overpay });
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const after   = await ethers.provider.getBalance(ctx.researcher.address);
      expect(before - after - gasUsed).to.equal(PRICE);
    });

    it("totalEarnings güncellenir", async function () {
      const ctx = await listed(await deploy());
      await ctx.contract.connect(ctx.researcher).purchaseData(1, { value: PRICE });
      expect(await ctx.contract.totalEarnings(ctx.patient.address)).to.equal(PRICE);
    });

    it("DataPurchased olayını yayar", async function () {
      const ctx = await listed(await deploy());
      await expect(ctx.contract.connect(ctx.researcher).purchaseData(1, { value: PRICE }))
        .to.emit(ctx.contract, "DataPurchased")
        .withArgs(1n, ctx.researcher.address);
    });

    it("yetersiz ödemeyi reddeder", async function () {
      const ctx = await listed(await deploy());
      await expect(
        ctx.contract.connect(ctx.researcher).purchaseData(1, { value: PRICE / 2n })
      ).to.be.revertedWith("Yetersiz odeme");
    });

    it("pasif kaydı satın almayı reddeder", async function () {
      const ctx = await listed(await deploy());
      await ctx.contract.connect(ctx.patient).delistData(1);
      await expect(
        ctx.contract.connect(ctx.researcher).purchaseData(1, { value: PRICE })
      ).to.be.revertedWith("Bu veri satista degil");
    });

    it("aynı kaydı iki kez satın almayı reddeder", async function () {
      const ctx = await purchased(await deploy());
      await expect(
        ctx.contract.connect(ctx.researcher).purchaseData(1, { value: PRICE })
      ).to.be.revertedWith("Zaten erisim var");
    });

    it("sahibin kendi kaydını satın almasını reddeder", async function () {
      const ctx = await listed(await deploy());
      await expect(
        ctx.contract.connect(ctx.patient).purchaseData(1, { value: PRICE })
      ).to.be.revertedWith("Kendi kaydini satin alamazsin");
    });

    it("mevcut olmayan kaydı reddeder", async function () {
      const { contract, researcher } = await deploy();
      await expect(
        contract.connect(researcher).purchaseData(99, { value: PRICE })
      ).to.be.revertedWith("Kayit mevcut degil");
    });
  });

  // ── getDataHash ───────────────────────────────────────────────────────────
  describe("getDataHash", function () {
    it("erişimi olan araştırmacı dataHash'i okur", async function () {
      const ctx = await purchased(await deploy());
      expect(await ctx.contract.connect(ctx.researcher).getDataHash(1)).to.equal(DATA_HASH);
    });

    it("sahip kendi dataHash'ini okur (satın almadan)", async function () {
      const ctx = await listed(await deploy());
      expect(await ctx.contract.connect(ctx.patient).getDataHash(1)).to.equal(DATA_HASH);
    });

    it("previewHash ile dataHash farklıdır", async function () {
      const ctx = await purchased(await deploy());
      const record = await ctx.contract.medicalRecords(1);
      const dataHash = await ctx.contract.connect(ctx.researcher).getDataHash(1);
      expect(record.previewHash).to.equal(PREVIEW_HASH);
      expect(dataHash).to.equal(DATA_HASH);
      expect(record.previewHash).to.not.equal(dataHash);
    });

    it("erişimi olmayan kullanıcıyı reddeder", async function () {
      const ctx = await listed(await deploy());
      await expect(
        ctx.contract.connect(ctx.other).getDataHash(1)
      ).to.be.revertedWith("Erisim izniniz yok");
    });

    it("iptal sonrası hash okunamaz", async function () {
      const ctx = await purchased(await deploy());
      await ctx.contract.connect(ctx.patient).revokeAccess(1, ctx.researcher.address);
      await expect(
        ctx.contract.connect(ctx.researcher).getDataHash(1)
      ).to.be.revertedWith("Erisim izniniz yok");
    });
  });

  // ── revokeAccess ──────────────────────────────────────────────────────────
  describe("revokeAccess", function () {
    it("hasta araştırmacının erişimini iptal eder", async function () {
      const ctx = await purchased(await deploy());
      await ctx.contract.connect(ctx.patient).revokeAccess(1, ctx.researcher.address);
      expect(await ctx.contract.hasAccess(ctx.researcher.address, 1)).to.be.false;
    });

    it("DataRevoked olayını araştırmacı adresiyle yayar", async function () {
      const ctx = await purchased(await deploy());
      await expect(ctx.contract.connect(ctx.patient).revokeAccess(1, ctx.researcher.address))
        .to.emit(ctx.contract, "DataRevoked")
        .withArgs(1n, ctx.researcher.address);
    });

    it("yalnızca sahip iptal edebilir", async function () {
      const ctx = await purchased(await deploy());
      await expect(
        ctx.contract.connect(ctx.other).revokeAccess(1, ctx.researcher.address)
      ).to.be.revertedWith("Sadece sahip iptal edebilir");
    });

    it("sıfır adresini reddeder", async function () {
      const ctx = await listed(await deploy());
      await expect(
        ctx.contract.connect(ctx.patient).revokeAccess(1, ethers.ZeroAddress)
      ).to.be.revertedWith("Gecersiz adres");
    });
  });

  // ── delistData & relistData ───────────────────────────────────────────────
  describe("delistData / relistData", function () {
    it("kayıt pasif hale gelir", async function () {
      const ctx = await listed(await deploy());
      await ctx.contract.connect(ctx.patient).delistData(1);
      const r = await ctx.contract.medicalRecords(1);
      expect(r.isActive).to.be.false;
    });

    it("yalnızca sahip kaldırabilir", async function () {
      const ctx = await listed(await deploy());
      await expect(
        ctx.contract.connect(ctx.other).delistData(1)
      ).to.be.revertedWith("Sadece sahip kaldirabilir");
    });

    it("zaten pasif kaydı kaldırmayı reddeder", async function () {
      const ctx = await listed(await deploy());
      await ctx.contract.connect(ctx.patient).delistData(1);
      await expect(
        ctx.contract.connect(ctx.patient).delistData(1)
      ).to.be.revertedWith("Zaten pasif");
    });

    it("pasif kaydı tekrar aktif eder", async function () {
      const ctx = await listed(await deploy());
      await ctx.contract.connect(ctx.patient).delistData(1);
      await ctx.contract.connect(ctx.patient).relistData(1);
      const r = await ctx.contract.medicalRecords(1);
      expect(r.isActive).to.be.true;
    });

    it("zaten aktif kaydı tekrar listelemeyi reddeder", async function () {
      const ctx = await listed(await deploy());
      await expect(
        ctx.contract.connect(ctx.patient).relistData(1)
      ).to.be.revertedWith("Zaten aktif");
    });

    it("yalnızca sahip tekrar listeleyebilir", async function () {
      const ctx = await listed(await deploy());
      await ctx.contract.connect(ctx.patient).delistData(1);
      await expect(
        ctx.contract.connect(ctx.other).relistData(1)
      ).to.be.revertedWith("Sadece sahip aktif edebilir");
    });
  });

  // ── updatePrice ───────────────────────────────────────────────────────────
  describe("updatePrice", function () {
    it("fiyatı günceller", async function () {
      const ctx = await listed(await deploy());
      const newPrice = ethers.parseEther("0.05");
      await ctx.contract.connect(ctx.patient).updatePrice(1, newPrice);
      const r = await ctx.contract.medicalRecords(1);
      expect(r.price).to.equal(newPrice);
    });

    it("PriceUpdated olayını yayar", async function () {
      const ctx = await listed(await deploy());
      const newPrice = ethers.parseEther("0.05");
      await expect(ctx.contract.connect(ctx.patient).updatePrice(1, newPrice))
        .to.emit(ctx.contract, "PriceUpdated")
        .withArgs(1n, newPrice);
    });

    it("yalnızca sahip güncelleyebilir", async function () {
      const ctx = await listed(await deploy());
      await expect(
        ctx.contract.connect(ctx.other).updatePrice(1, ethers.parseEther("0.05"))
      ).to.be.revertedWith("Sadece sahip fiyat guncelleyebilir");
    });

    it("sıfır fiyatı reddeder", async function () {
      const ctx = await listed(await deploy());
      await expect(
        ctx.contract.connect(ctx.patient).updatePrice(1, 0n)
      ).to.be.revertedWith("Fiyat sifirdan buyuk olmali");
    });
  });

  // ── transferRecordOwnership ───────────────────────────────────────────────
  describe("transferRecordOwnership", function () {
    it("sahipliği devreder", async function () {
      const ctx = await listed(await deploy());
      await ctx.contract.connect(ctx.patient).transferRecordOwnership(1, ctx.other.address);
      const r = await ctx.contract.medicalRecords(1);
      expect(r.owner).to.equal(ctx.other.address);
    });

    it("OwnershipTransferred olayını yayar", async function () {
      const ctx = await listed(await deploy());
      await expect(ctx.contract.connect(ctx.patient).transferRecordOwnership(1, ctx.other.address))
        .to.emit(ctx.contract, "OwnershipTransferred")
        .withArgs(1n, ctx.patient.address, ctx.other.address);
    });

    it("yalnızca sahip devredebilir", async function () {
      const ctx = await listed(await deploy());
      await expect(
        ctx.contract.connect(ctx.other).transferRecordOwnership(1, ctx.researcher.address)
      ).to.be.revertedWith("Sadece sahip devredebilir");
    });

    it("sıfır adrese devri reddeder", async function () {
      const ctx = await listed(await deploy());
      await expect(
        ctx.contract.connect(ctx.patient).transferRecordOwnership(1, ethers.ZeroAddress)
      ).to.be.revertedWith("Gecersiz adres");
    });

    it("kendine devri reddeder", async function () {
      const ctx = await listed(await deploy());
      await expect(
        ctx.contract.connect(ctx.patient).transferRecordOwnership(1, ctx.patient.address)
      ).to.be.revertedWith("Zaten sahipsiniz");
    });
  });

  // ── totalEarnings ─────────────────────────────────────────────────────────
  describe("totalEarnings", function () {
    it("birden fazla satışta kazanç birikir", async function () {
      const { contract, patient, researcher, other } = await deploy();
      await contract.connect(patient).listData("QmPreview1", "QmData1", PRICE);
      await contract.connect(patient).listData("QmPreview2", "QmData2", PRICE * 2n);
      await contract.connect(researcher).purchaseData(1, { value: PRICE });
      await contract.connect(other).purchaseData(2, { value: PRICE * 2n });
      expect(await contract.totalEarnings(patient.address)).to.equal(PRICE * 3n);
    });
  });

  // ── rotateKey ─────────────────────────────────────────────────────────────
  describe("rotateKey", function () {
    it("hash'leri günceller", async function () {
      const ctx = await listed(await deploy());
      await ctx.contract.connect(ctx.patient).rotateKey(1, "QmNewPreview", "QmNewData");
      const r = await ctx.contract.medicalRecords(1);
      expect(r.previewHash).to.equal("QmNewPreview");
      expect(await ctx.contract.connect(ctx.patient).getDataHash(1)).to.equal("QmNewData");
    });

    it("KeyRotated olayını yayar", async function () {
      const ctx = await listed(await deploy());
      await expect(ctx.contract.connect(ctx.patient).rotateKey(1, "QmNewPreview", "QmNewData"))
        .to.emit(ctx.contract, "KeyRotated")
        .withArgs(1n);
    });

    it("erişimi iptal edilen araştırmacı eski hash'i okuyamaz, yenisini de okuyamaz", async function () {
      const ctx = await purchased(await deploy());
      await ctx.contract.connect(ctx.patient).revokeAccess(1, ctx.researcher.address);
      await ctx.contract.connect(ctx.patient).rotateKey(1, "QmNewPreview", "QmNewData");
      await expect(
        ctx.contract.connect(ctx.researcher).getDataHash(1)
      ).to.be.revertedWith("Erisim izniniz yok");
    });

    it("yalnızca sahip anahtar döndürebilir", async function () {
      const ctx = await listed(await deploy());
      await expect(
        ctx.contract.connect(ctx.other).rotateKey(1, "QmNewPreview", "QmNewData")
      ).to.be.revertedWith("Sadece sahip anahtari donusturebilir");
    });

    it("boş hash reddeder", async function () {
      const ctx = await listed(await deploy());
      await expect(
        ctx.contract.connect(ctx.patient).rotateKey(1, "", "QmNewData")
      ).to.be.revertedWith("Onizleme hash bos olamaz");
    });
  });

  // ── deleteRecord ──────────────────────────────────────────────────────────
  describe("deleteRecord", function () {
    it("kaydı pasife alır ve hash'leri temizler (kriptografik silme)", async function () {
      const ctx = await listed(await deploy());
      await ctx.contract.connect(ctx.patient).deleteRecord(1);
      const r = await ctx.contract.medicalRecords(1);
      expect(r.isActive).to.be.false;
      expect(r.previewHash).to.equal("");
    });

    it("DataDeleted olayını yayar", async function () {
      const ctx = await listed(await deploy());
      await expect(ctx.contract.connect(ctx.patient).deleteRecord(1))
        .to.emit(ctx.contract, "DataDeleted")
        .withArgs(1n, ctx.patient.address);
    });

    it("silme sonrası dataHash okunamaz", async function () {
      const ctx = await listed(await deploy());
      await ctx.contract.connect(ctx.patient).deleteRecord(1);
      await expect(
        ctx.contract.connect(ctx.patient).getDataHash(1)
      ).to.be.revertedWith("Kayit silinmis veya mevcut degil");
    });

    it("yalnızca sahip silebilir", async function () {
      const ctx = await listed(await deploy());
      await expect(
        ctx.contract.connect(ctx.other).deleteRecord(1)
      ).to.be.revertedWith("Sadece sahip silebilir");
    });
  });
});
