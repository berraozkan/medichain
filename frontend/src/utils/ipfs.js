export const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs";

export const ipfsUrl = (hash) => `${IPFS_GATEWAY}/${hash}`;
