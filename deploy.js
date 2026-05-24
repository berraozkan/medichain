import hre from "hardhat";

async function main() {
  console.log("Sözleşme yayına alınıyor...");

  // Sözleşme adının 'MediChain' olduğundan emin ol (MediChain.sol içindeki isim)
  const MediChain = await hre.ethers.getContractFactory("MediChain");
  const mediChain = await MediChain.deploy();

  await mediChain.waitForDeployment();

  const address = await mediChain.getAddress();
  console.log("-----------------------------------------------");
  console.log("Sözleşme başarıyla yüklendi!");
  console.log("ADRES:", address);
  console.log("-----------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});