// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MediChain {

    struct MedicalData {
        string ipfsHash;       // IPFS'teki şifreli verinin adresi
        uint256 price;         // Wei cinsinden fiyat
        address payable owner; // Hastanın cüzdan adresi
        bool isActive;         // Satışta mı?
    }

    // Her veriye benzersiz ID atanır
    uint256 public dataCount;

    // ID → Veri eşlemesi
    mapping(uint256 => MedicalData) public medicalRecords;

    // Araştırmacının hangi verilere erişimi var?
    mapping(address => mapping(uint256 => bool)) public hasAccess;

    // Olaylar (frontend bunları dinler)
    event DataListed(uint256 indexed id, address indexed owner, uint256 price);
    event DataPurchased(uint256 indexed id, address indexed buyer);
    event DataRevoked(uint256 indexed id);

    // Hasta verisini listeye ekler
    function listData(string memory _ipfsHash, uint256 _price) external {
        dataCount++;
        medicalRecords[dataCount] = MedicalData({
            ipfsHash: _ipfsHash,
            price: _price,
            owner: payable(msg.sender),
            isActive: true
        });
        emit DataListed(dataCount, msg.sender, _price);
    }

    // Araştırmacı veri satın alır
    function purchaseData(uint256 _id) external payable {
        MedicalData storage data = medicalRecords[_id];
        require(data.isActive, "Bu veri satista degil");
        require(msg.value >= data.price, "Yetersiz odeme");
        require(!hasAccess[msg.sender][_id], "Zaten erisim var");

        hasAccess[msg.sender][_id] = true;
        data.owner.transfer(msg.value); // ETH direkt hastaya gider

        emit DataPurchased(_id, msg.sender);
    }

    // Hasta erişim iznini iptal eder
    function revokeAccess(uint256 _id, address _researcher) external {
        require(medicalRecords[_id].owner == msg.sender, "Sadece hasta iptal edebilir");
        hasAccess[_researcher][_id] = false;
        emit DataRevoked(_id);
    }

    // Veriyi satıştan kaldır
    function delistData(uint256 _id) external {
        require(medicalRecords[_id].owner == msg.sender, "Sadece hasta kaldirabilis");
        medicalRecords[_id].isActive = false;
    }

    // Araştırmacı IPFS hash'ini okur (erişimi varsa)
    function getDataHash(uint256 _id) external view returns (string memory) {
        require(hasAccess[msg.sender][_id], "Erisim izniniz yok");
        return medicalRecords[_id].ipfsHash;
    }
}