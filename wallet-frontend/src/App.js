import React, { useEffect, useState, useRef } from 'react';
import { Web3Auth } from "@web3auth/modal";
import Web3 from "web3";
import QRCode from "react-qr-code";
import { v4 as uuidv4 } from 'uuid';
import ReclaimSDK from '@reclaimprotocol/reclaim-client-sdk';
import mintNFT from './mintNFT';
import checkNFTBalance from './nftBalanceChecker';
// import './App.css'

import './input.css'
function App() {
  const [sessionId, setSessionId] = useState('');
  const [sessionLink, setSessionLink] = useState('');
  const [sessionState, setSessionState] = useState('IDLE');
  const [proofs, setProofs] = useState();
  const [userAddress, setUserAddress] = useState('');
  const [web3Instance, setWeb3Instance] = useState(null);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amountToSend, setAmountToSend] = useState('');
  const [mintingCompleted, setMintingCompleted] = useState(false);


  const reclaimSDK = new ReclaimSDK('e44484c3-5fe3-4a94-8472-3660bedb0709');
  const web3authRef = useRef(null);

  useEffect(() => {
    web3authRef.current = new Web3Auth({
      clientId: "BEO7mGvju2MMgAVtImbSbO7oXhlKuYteNNlxs_Wn0tIjVX9iFAMizUtnCaS3VKO_bb0PC4e3Jt1YKUYjq9D7msw",
      web3AuthNetwork: "sapphire_devnet",
      chainConfig: {
        chainNamespace: "eip155",
        chainId: "0x13881",
        rpcTarget: "https://rpc.ankr.com/polygon_mumbai",
        displayName: "polygon testnet",
        blockExplorer: "https://goerli.etherscan.io",
        ticker: "MATIC",
        tickerName: "MATIC",
      },
    });
    web3authRef.current.initModal();
  }, []);

  const handleWeb3AuthLogin = async () => {
    try {
      const web3authProvider = await web3authRef.current.connect();
      const web3 = new Web3(web3authProvider);
      const userAccounts = await web3.eth.getAccounts();
      setUserAddress(userAccounts[0]);
      setWeb3Instance(web3);
      console.log("web3",web3)
      console.log("Connected successfully!");
    } catch (error) {
      console.error("Error connecting:", error);
    }
  };

  const handleSendTransaction = async () => {
    if (!web3Instance || !recipientAddress || !amountToSend) return;
  
    try {
      const nftBalance = await checkNFTBalance(web3Instance, recipientAddress);
      if (nftBalance > 0) {
        console.log(`Recipient has ${nftBalance} NFTs. Proceeding with the transaction.`);
  
        const fromAddress = userAddress;
        const amountInWei = web3Instance.utils.toWei(amountToSend, 'ether');
        const contractAddress = '0x03b8a09dAe9D2F930ba9AB5f3d74f9A95fE353Be';
  
        // Check if the recipient address owns an NFT at the contract address
        const hasNFT = await checkNFTBalance(web3Instance, recipientAddress);
  
        if (!hasNFT) {
          alert('Recipient is not KYCed (has no NFTs at the specified contract address).');
          return;
        }
  
        const transaction = {
          from: fromAddress,
          to: recipientAddress,
          value: amountInWei,
          maxPriorityFeePerGas: '5000000000', // Max priority fee per gas
          maxFeePerGas: '6000000000000', // Max fee per gas
        };
  
        const balance = await web3Instance.eth.getBalance(userAddress);
        console.log('Account Balance:', balance);
  
        const txReceipt = await web3Instance.eth.sendTransaction(transaction);
        console.log('Transaction receipt:', txReceipt);
      } else {
        alert('Recipient is not KYCed (has no NFTs).');
      }
    } catch (error) {
      console.error('Error sending transaction:', error);
    }
  };
  

  async function generateSession() {
    const userId = uuidv4();
    setSessionState('GENERATING_VERIFICATION_LINK');
    const session = await reclaimSDK.generateSession({
      userId,
      onProofSubmissionSuccess: () => {
        setSessionState('COMPLETED');
      },
      onError: (error) => {
        setSessionState('FAILED');
        console.log(error);
      }
    });
    setSessionId(session?.sessionId);
    setSessionLink(session?.link);
    setSessionState('GENERATED_VERIFICATION_LINK');
  }

  const getSubmittedProofs = async (sessionId) => {
    const proofs = await reclaimSDK.getProofs(sessionId);
    if (proofs?.proofs) {
      setProofs(proofs?.proofs);
    }
  };


  const handleMintNFT = async () => {
    if (sessionState !== 'COMPLETED' || mintingCompleted) {
      return;
    }

    try {
      mintNFT(web3Instance, userAddress).then(receipt => {
        console.log("Minted NFT with transaction hash:", receipt.transactionHash);
      }).catch(error => {
        console.error("Error while minting NFT:", error);
      });
      setMintingCompleted(true);
    } catch (error) {
      console.error("Error while minting NFT:", error);
    }
  };
  useEffect(() => {
    if (sessionState === 'COMPLETED' && !mintingCompleted) {
      handleMintNFT();
    }
  }, [sessionState, mintingCompleted])




  const truncatedAddress = userAddress ? `${userAddress.substring(0, 6)}...${userAddress.slice(-4)}` : '';

  const renderReclaim = () => {
    switch (sessionState) {
      case 'IDLE':
        return (
          <button onClick={generateSession} className="h-12 bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 rounded-md font-bold text-white w-full">
            KYC verification
          </button>
        );
      case 'GENERATING_VERIFICATION_LINK':
        return (
          <button disabled className="text-white bg-gradient-to-r from-blue-400 to-blue-600 rounded-lg text-sm px-5 py-2.5 text-center w-full">
            Generating verification link...
          </button>
        );
      case 'GENERATED_VERIFICATION_LINK':
        return (
          <div className='flex flex-col items-center space-y-4'>
            <div className='bg-white p-4 rounded-lg shadow-md'>
              <QRCode value={sessionLink} />
            </div>
            Scan the QR above or
            <a href={sessionLink} className='text-blue-700 underline'>Click on this URL </a>
          </div>
        );
      case 'COMPLETED':
        return (
          <div className='flex flex-col items-center space-y-4'>
            <p className='text-center text-blue-800 font-medium'>Proofs received!</p>
            {proofs?.map((proof, i) => (
              <div className='flex flex-col items-center space-y-2' key={i}>
                <p className='text-center text-blue-600'>You provided proof of ownership for Aadhaar</p>
                <p className='text-center text-blue-500'>Your proof id: {proof?.identifier}</p>
                <button className='bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 font-medium rounded-lg text-sm px-5 py-2 text-white w-full' onClick={() => setSessionState('IDLE')}>Generate again!</button>
              </div>
            ))}
          </div>
        );
      case 'FAILED':
        return (
          <div className='flex flex-col items-center space-y-4'>
            <p className='text-center text-red-600'>Something went wrong. Please try again.</p>
            <button onClick={() => setSessionState('IDLE')} className="h-12 bg-gradient-to-r from-red-400 to-red-600 hover:from-red-500 hover:to-red-700 rounded-md font-bold text-white w-full">
              Try again
            </button>
          </div>
        );
      default:
        return null;
    }
  };


  
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-400 via-blue-500 to-blue-700 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-gradient-to-br from-blue-200 via-white to-blue-100 p-6 rounded-xl shadow-md relative text-gray-800">
        {userAddress && 
          <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-1 rounded-full">
            {truncatedAddress}
          </div>
        }
        <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-800">
          Your Universal Web3 Wallet
        </h1>
        {web3Instance ? (
          <>
            {sessionState === 'COMPLETED' ? (
              <><div className="rounded-md shadow-sm -space-y-px">
                <input
                  type="text"
                  placeholder="Recipient Address"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-blue-500 placeholder-gray-600 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm" />
                <input
                  type="text"
                  placeholder="Amount to Send (ETH)"
                  value={amountToSend}
                  onChange={(e) => setAmountToSend(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-blue-500 placeholder-gray-600 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm" />
              </div><div>
                  <button onClick={handleSendTransaction} className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    Send
                  </button>
                </div></>
            ) : (
              <div className="text-center text-red-500">
                Please complete the KYC process to start using the wallet
              </div>
            )}
            <div>{renderReclaim()}</div>
          </>
        ) : (
          <div>
            <button onClick={handleWeb3AuthLogin} className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              Login with Web3Auth
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;