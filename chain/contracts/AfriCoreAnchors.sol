// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
/// @notice Root publication only. No credentials, identities, tokens or customer funds.
contract AfriCoreAnchors is AccessControl, Pausable {
 bytes32 public constant PUBLISHER_ROLE=keccak256("PUBLISHER_ROLE");
 struct Batch {bytes32 root;uint256 blockNumber;}
 mapping(bytes32=>Batch) public batches;
 event BatchPublished(bytes32 indexed batch,bytes32 root,address indexed publisher);
 constructor(address admin){require(admin!=address(0),"zero admin");_grantRole(DEFAULT_ADMIN_ROLE,admin);_grantRole(PUBLISHER_ROLE,admin);}
 function publish(bytes32 batch,bytes32 root) external onlyRole(PUBLISHER_ROLE) whenNotPaused {require(batch!=bytes32(0)&&root!=bytes32(0),"zero commitment");require(batches[batch].root==bytes32(0),"duplicate batch");batches[batch]=Batch(root,block.number);emit BatchPublished(batch,root,msg.sender);}
 function verify(bytes32 batch,bytes32 leaf,bytes32[] calldata proof) external view returns(bool){return batches[batch].root!=bytes32(0)&&MerkleProof.verify(proof,batches[batch].root,leaf);}
 function pause() external onlyRole(DEFAULT_ADMIN_ROLE){_pause();}
 function unpause() external onlyRole(DEFAULT_ADMIN_ROLE){_unpause();}
}
