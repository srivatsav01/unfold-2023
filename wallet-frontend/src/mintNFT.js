import abi from './utils/abi.json'; 
require('dotenv').config();


const mintNFT = async (web3Instance, userAddress) => {
  try {
    const contractAddress = '0x03b8a09dAe9D2F930ba9AB5f3d74f9A95fE353Be';
    console.log(web3Instance)
    const contract = new web3Instance.eth.Contract(abi, contractAddress);
    console.log(contract)
    console.log(process.env.REACT_APP_PRIVATE_KEY)

    const privateKey = process.env.REACT_APP_PRIVATE_KEY.trim();; 
    console.log(privateKey)
    const account = web3Instance.eth.accounts.privateKeyToAccount(privateKey);
    web3Instance.eth.accounts.wallet.add(account);
    const gasPrice = await web3Instance.eth.getGasPrice();

    const data = contract.methods.safeMint(userAddress).encodeABI(); 

    const tx = {
      from: account.address,
      to: contractAddress,
      gasPrice,
      data,
    };

    const signedTx = await web3Instance.eth.accounts.signTransaction(tx, account.privateKey);
    const receipt = await web3Instance.eth.sendSignedTransaction(signedTx.rawTransaction);

    console.log('Minting successful:', receipt);
    return receipt;
  } catch (error) {
    console.error('Error minting token:', error);
    throw error;
  }
};

export default mintNFT;
