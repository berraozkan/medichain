import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

async function deploy() {
  const [patient, researcher, other] = await ethers.getSigners();
  const MediChain = await ethers.getContractFactory("MediChain");
  const contract  = await MediChain.deploy();
  return { contract, patient, researcher, other };
}

const PRICE    = ethers.parseEther("0.01");
const METADATA = "QmTestMetadataHash";

describe("MediChain", function () {

  // ── listData ──────────────────────────────────────────────────────────────
  describe("listData", function () {
    it("dataCount artar", async function () {
      const { contract, patient } = await deploy();
      await contract.connect(patient).listData(METADATA, PRICE);
      expect(await contract.dataCount()).to.equal(1n);
    });

    it("kayıt doğru alanlarla oluşur", async function () {
      const { contract, patient } = await deploy();
      await contract.connect(patient).listData(METADATA, PRICE);
      const r = await contract.medicalRecords(1);
      expect(r.ipfsHash).to.equal(METADATA);
      expect(r.price).to.equal(PRICE);
      expect(r.owner).to.equal(patient.address);
      expect(r.isActive).to.be.true;
    });

    it("DataListed olayını yayar", async function () {
      const { contract, patient } = await deploy();
      await expect(contract.connect(patient).listData(METADATA, PRICE))
        .to.emit(contract, "DataListed")
        .withArgs(1n, patient.address, PRICE);
    });

    it("birden fazla kayıt eklenebilir", async function () {
      const { contract, patient } = await deploy();
      await contract.connect(patient).listData("QmHash1", PRICE);
      await contract.connect(patient).listData("QmHash2", PRICE * 2n);
      expect(await contract.dataCount()).to.equal(2n);
    });
  });

  // ── purchaseData ──────────────────────────────────────────────────────────
  describe("purchaseData", function () {
    it("erişim hakkı verir", async function () {
      const { contract, patient, researcher } = await deploy();
      await contract.connect(patient).listData(METADATA, PRICE);
      await contract.connect(researcher).purchaseData(1, { value: PRICE });
      expect(await contract.hasAccess(researcher.address, 1)).to.be.true;
    });

    it("ETH'i hasta adresine aktarır", async function () {
      const { contract, patient, researcher } = await deploy();
      await contract.connect(patient).listData(METADATA, PRICE);
      const before = await ethers.provider.getBalance(patient.address);
      await contract.connect(researcher).purchaseData(1, { value: PRICE });
      const after  = await ethers.provider.getBalance(patient.address);
      expect(after - before).to.equal(PRICE);
    });

    it("DataPurchased olayını yayar", async function () {
      const { contract, patient, researcher } = await deploy();
      await contract.connect(patient).listData(METADATA, PRICE);
      await expect(contract.connect(researcher).purchaseData(1, { value: PRICE }))
        .to.emit(contract, "DataPurchased")
        .withArgs(1n, researcher.address);
    });

    it("yetersiz ödemeyi reddeder", async function () {
      const { contract, patient, researcher } = await deploy();
      await contract.connect(patient).listData(METADATA, PRICE);
      await expect(
        contract.connect(researcher).purchaseData(1, { value: PRICE / 2n })
      ).to.be.revertedWith("Yetersiz odeme");
    });

    it("pasif kaydı satın almayı reddeder", async function () {
      const { contract, patient, researcher } = await deploy();
      await contract.connect(patient).listData(METADATA, PRICE);
      await contract.connect(patient).delistData(1);
      await expect(
        contract.connect(researcher).purchaseData(1, { value: PRICE })
      ).to.be.revertedWith("Bu veri satista degil");
    });

    it("aynı kaydı iki kez satın almayı reddeder", async function () {
      const { contract, patient, researcher } = await deploy();
      await contract.connect(patient).listData(METADATA, PRICE);
      await contract.connect(researcher).purchaseData(1, { value: PRICE });
      await expect(
        contract.connect(researcher).purchaseData(1, { value: PRICE })
      ).to.be.revertedWith("Zaten erisim var");
    });
  });

  // ── getDataHash ───────────────────────────────────────────────────────────
  describe("getDataHash", function () {
    it("erişimi olan araştırmacı hash'i okur", async function () {
      const { contract, patient, researcher } = await deploy();
      await contract.connect(patient).listData(METADATA, PRICE);
      await contract.connect(researcher).purchaseData(1, { value: PRICE });
      expect(await contract.connect(researcher).getDataHash(1)).to.equal(METADATA);
    });

    it("erişimi olmayan kullanıcıyı reddeder", async function () {
      const { contract, patient, other } = await deploy();
      await contract.connect(patient).listData(METADATA, PRICE);
      await expect(
        contract.connect(other).getDataHash(1)
      ).to.be.revertedWith("Erisim izniniz yok");
    });
  });

  // ── revokeAccess ──────────────────────────────────────────────────────────
  describe("revokeAccess", function () {
    it("hasta araştırmacının erişimini iptal eder", async function () {
      const { contract, patient, researcher } = await deploy();
      await contract.connect(patient).listData(METADATA, PRICE);
      await contract.connect(researcher).purchaseData(1, { value: PRICE });
      expect(await contract.hasAccess(researcher.address, 1)).to.be.true;
      await contract.connect(patient).revokeAccess(1, researcher.address);
      expect(await contract.hasAccess(researcher.address, 1)).to.be.false;
    });

    it("DataRevoked olayını yayar", async function () {
      const { contract, patient, researcher } = await deploy();
      await contract.connect(patient).listData(METADATA, PRICE);
      await contract.connect(researcher).purchaseData(1, { value: PRICE });
      await expect(contract.connect(patient).revokeAccess(1, researcher.address))
        .to.emit(contract, "DataRevoked")
        .withArgs(1n);
    });

    it("yalnızca sahip iptal edebilir", async function () {
      const { contract, patient, researcher, other } = await deploy();
      await contract.connect(patient).listData(METADATA, PRICE);
      await contract.connect(researcher).purchaseData(1, { value: PRICE });
      await expect(
        contract.connect(other).revokeAccess(1, researcher.address)
      ).to.be.revertedWith("Sadece hasta iptal edebilir");
    });

    it("iptal sonrası hash okunamaz", async function () {
      const { contract, patient, researcher } = await deploy();
      await contract.connect(patient).listData(METADATA, PRICE);
      await contract.connect(researcher).purchaseData(1, { value: PRICE });
      await contract.connect(patient).revokeAccess(1, researcher.address);
      await expect(
        contract.connect(researcher).getDataHash(1)
      ).to.be.revertedWith("Erisim izniniz yok");
    });
  });

  // ── delistData ────────────────────────────────────────────────────────────
  describe("delistData", function () {
    it("kayıt pasif hale gelir", async function () {
      const { contract, patient } = await deploy();
      await contract.connect(patient).listData(METADATA, PRICE);
      await contract.connect(patient).delistData(1);
      const r = await contract.medicalRecords(1);
      expect(r.isActive).to.be.false;
    });

    it("yalnızca sahip kaldırabilir", async function () {
      const { contract, patient, other } = await deploy();
      await contract.connect(patient).listData(METADATA, PRICE);
      await expect(
        contract.connect(other).delistData(1)
      ).to.be.revertedWith("Sadece hasta kaldirabilis");
    });
  });
});
