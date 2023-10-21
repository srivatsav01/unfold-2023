import abi from './utils/abi.json'; 

const checkNFTBalance = async (web3Instance, userAddress) => {
  try {
    const contractAddress = '0x03b8a09dAe9D2F930ba9AB5f3d74f9A95fE353Be';
    const contract = new web3Instance.eth.Contract(abi, contractAddress);
    
    const nftBalance = await contract.methods.balanceOf(userAddress).call();
    
    return nftBalance;
  } catch (error) {
    console.error('Error checking NFT balance:', error);
    throw error;
  }
};

export default checkNFTBalance;