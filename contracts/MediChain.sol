// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MediChain {

    struct MedicalData {
        string ipfsHash;
        uint256 price;
        address payable owner;
        bool isActive;
    }

    uint256 public dataCount;

    mapping(uint256 => MedicalData) public medicalRecords;
    mapping(address => mapping(uint256 => bool)) public hasAccess;
    mapping(address => uint256) public totalEarnings;

    event DataListed(uint256 indexed id, address indexed owner, uint256 price);
    event DataPurchased(uint256 indexed id, address indexed buyer);
    event DataRevoked(uint256 indexed id, address indexed researcher);
    event PriceUpdated(uint256 indexed id, uint256 newPrice);

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

    function purchaseData(uint256 _id) external payable {
        MedicalData storage data = medicalRecords[_id];
        require(data.isActive, "Bu veri satista degil");
        require(msg.value >= data.price, "Yetersiz odeme");
        require(!hasAccess[msg.sender][_id], "Zaten erisim var");

        // Effects before interactions (CEI pattern)
        hasAccess[msg.sender][_id] = true;
        totalEarnings[data.owner] += data.price;

        // Transfer exact price to owner
        (bool success, ) = data.owner.call{value: data.price}("");
        require(success, "Odeme basarisiz");

        // Refund excess payment to buyer
        uint256 excess = msg.value - data.price;
        if (excess > 0) {
            (bool refund, ) = payable(msg.sender).call{value: excess}("");
            require(refund, "Iade basarisiz");
        }

        emit DataPurchased(_id, msg.sender);
    }

    function revokeAccess(uint256 _id, address _researcher) external {
        require(medicalRecords[_id].owner == msg.sender, "Sadece hasta iptal edebilir");
        hasAccess[_researcher][_id] = false;
        emit DataRevoked(_id, _researcher);
    }

    function delistData(uint256 _id) external {
        require(medicalRecords[_id].owner == msg.sender, "Sadece hasta kaldirabilis");
        medicalRecords[_id].isActive = false;
    }

    function updatePrice(uint256 _id, uint256 _newPrice) external {
        require(medicalRecords[_id].owner == msg.sender, "Sadece sahip fiyat guncelleyebilir");
        require(medicalRecords[_id].isActive, "Pasif kayit");
        medicalRecords[_id].price = _newPrice;
        emit PriceUpdated(_id, _newPrice);
    }

    function getDataHash(uint256 _id) external view returns (string memory) {
        require(
            hasAccess[msg.sender][_id] || medicalRecords[_id].owner == msg.sender,
            "Erisim izniniz yok"
        );
        return medicalRecords[_id].ipfsHash;
    }
}
