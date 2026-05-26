// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MediChain is ReentrancyGuard {

    struct MedicalData {
        string previewHash;   // Public IPFS hash: { category, description } — no encryption key
        uint256 price;
        address payable owner;
        bool isActive;
    }

    uint256 public dataCount;

    mapping(uint256 => MedicalData) public medicalRecords;
    mapping(uint256 => string) private dataHashes;  // Private: contains encryption key
    mapping(address => mapping(uint256 => bool)) public hasAccess;
    mapping(address => uint256) public totalEarnings;

    event DataListed(uint256 indexed id, address indexed owner, uint256 price);
    event DataPurchased(uint256 indexed id, address indexed buyer);
    event DataRevoked(uint256 indexed id, address indexed researcher);
    event PriceUpdated(uint256 indexed id, uint256 newPrice);
    event OwnershipTransferred(uint256 indexed id, address indexed oldOwner, address indexed newOwner);

    // List a new record with a public preview hash and a private data hash
    function listData(
        string calldata _previewHash,
        string calldata _dataHash,
        uint256 _price
    ) external {
        require(bytes(_previewHash).length > 0, "Onizleme hash bos olamaz");
        require(bytes(_dataHash).length > 0,    "Veri hash bos olamaz");
        require(_price > 0,                     "Fiyat sifirdan buyuk olmali");

        dataCount++;
        medicalRecords[dataCount] = MedicalData({
            previewHash: _previewHash,
            price: _price,
            owner: payable(msg.sender),
            isActive: true
        });
        dataHashes[dataCount] = _dataHash;
        emit DataListed(dataCount, msg.sender, _price);
    }

    function purchaseData(uint256 _id) external payable nonReentrant {
        MedicalData storage data = medicalRecords[_id];
        require(data.owner != address(0), "Kayit mevcut degil");
        require(data.isActive,            "Bu veri satista degil");
        require(msg.value >= data.price,  "Yetersiz odeme");
        require(!hasAccess[msg.sender][_id], "Zaten erisim var");
        require(msg.sender != data.owner, "Kendi kaydini satin alamazsin");

        // Effects (CEI pattern — state changes before external calls)
        hasAccess[msg.sender][_id] = true;
        totalEarnings[data.owner] += data.price;

        // Interactions
        (bool success, ) = data.owner.call{value: data.price}("");
        require(success, "Odeme basarisiz");

        uint256 excess = msg.value - data.price;
        if (excess > 0) {
            (bool refund, ) = payable(msg.sender).call{value: excess}("");
            require(refund, "Iade basarisiz");
        }

        emit DataPurchased(_id, msg.sender);
    }

    function revokeAccess(uint256 _id, address _researcher) external {
        require(medicalRecords[_id].owner == msg.sender, "Sadece sahip iptal edebilir");
        require(_researcher != address(0), "Gecersiz adres");
        hasAccess[_researcher][_id] = false;
        emit DataRevoked(_id, _researcher);
    }

    function delistData(uint256 _id) external {
        require(medicalRecords[_id].owner == msg.sender, "Sadece sahip kaldirabilir");
        require(medicalRecords[_id].isActive, "Zaten pasif");
        medicalRecords[_id].isActive = false;
    }

    function relistData(uint256 _id) external {
        require(medicalRecords[_id].owner == msg.sender, "Sadece sahip aktif edebilir");
        require(!medicalRecords[_id].isActive, "Zaten aktif");
        medicalRecords[_id].isActive = true;
    }

    function updatePrice(uint256 _id, uint256 _newPrice) external {
        require(medicalRecords[_id].owner == msg.sender, "Sadece sahip fiyat guncelleyebilir");
        require(_newPrice > 0, "Fiyat sifirdan buyuk olmali");
        medicalRecords[_id].price = _newPrice;
        emit PriceUpdated(_id, _newPrice);
    }

    function transferRecordOwnership(uint256 _id, address _newOwner) external {
        require(medicalRecords[_id].owner == msg.sender, "Sadece sahip devredebilir");
        require(_newOwner != address(0), "Gecersiz adres");
        require(_newOwner != msg.sender, "Zaten sahipsiniz");
        address oldOwner = medicalRecords[_id].owner;
        medicalRecords[_id].owner = payable(_newOwner);
        emit OwnershipTransferred(_id, oldOwner, _newOwner);
    }

    // Returns the private data hash (with encryption key) — only for owner or buyer
    function getDataHash(uint256 _id) external view returns (string memory) {
        require(
            hasAccess[msg.sender][_id] || medicalRecords[_id].owner == msg.sender,
            "Erisim izniniz yok"
        );
        return dataHashes[_id];
    }
}
