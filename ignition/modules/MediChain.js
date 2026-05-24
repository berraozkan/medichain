import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("MediChainModule", (m) => {
  const mediChain = m.contract("MediChain");
  return { mediChain };
});