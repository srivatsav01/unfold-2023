import React, { useEffect, useState, useRef } from 'react';
import { Web3Auth } from "@web3auth/modal";
import Web3 from "web3";
import QRCode from "react-qr-code";
import { v4 as uuidv4 } from 'uuid';
import ReclaimSDK from '@reclaimprotocol/reclaim-client-sdk';
import mintNFT from './mintNFT';
import checkNFTBalance from './nftBalanceChecker';
import './App.css'

require('dotenv').config();

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


  const reclaimSDK = new ReclaimSDK(process.env.REACT_APP_RECLAIM_APIKEY);
  const web3authRef = useRef(null);

  useEffect(() => {
    web3authRef.current = new Web3Auth({
      clientId: process.env.REACT_APP_CLIENT_ID,
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
  
        const hasNFT = await checkNFTBalance(web3Instance, recipientAddress);
  
        if (!hasNFT) {
          alert('Recipient is not KYCed (has no NFTs at the specified contract address).');
          return;
        }
  
        const transaction = {
          from: fromAddress,
          to: recipientAddress,
          value: amountInWei,
          maxPriorityFeePerGas: '5000000000', 
          maxFeePerGas: '6000000000000', 
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

  const renderReclaim = () => {
    switch (sessionState) {
      case 'IDLE':
        return (
          <button onClick={generateSession} className="h-12 bg-blue-700 hover:bg-blue-800 rounded-md font-bold text-white w-1/3">
            Generate Aadhaar verification link
          </button>
        );
      case 'GENERATING_VERIFICATION_LINK':
        return (
          <button disabled className="text-white bg-blue-700 hover:bg-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center">
            Generating verification link...
          </button>
        );
      case 'GENERATED_VERIFICATION_LINK':
        return (
          <div className='flex flex-col items-center'>
            <div className='bg-white max-w-fit mt-1'>
              <QRCode className='p-2' value={sessionLink} />
            </div>
            Scan the QR above or
            <a href={sessionLink} className='text-blue-700 underline'>Click on this URL </a>
          </div>
        );
      case 'COMPLETED':
        return (
          <div className='flex flex-col items-center'>
            <p className='text-center'>Proofs received!</p>
            {proofs?.map((proof, i) => (
              <div className='flex flex-col items-center' key={i}>
                <p className='text-center text-indigo-500'>You provided proof of ownership for aadhaar</p>
                <p className='text-center text-indigo-500 '>Your proof id: {proof?.identifier}</p>
                <button className=' bg-blue-700 hover:bg-blue-800 font-medium rounded-lg text-sm px-5 py-2 text-center mt-2 text-white' onClick={() => setSessionState('IDLE')}>Generate again!</button>
              </div>
            ))}
          </div>
        );
      case 'FAILED':
        return (
          <div className='flex flex-col items-center'>
            <p className='text-center'>Something went wrong. Please try again.</p>
            <button onClick={() => setSessionState('IDLE')} className="h-12 bg-blue-500 rounded-md font-bold text-white w-1/3">
              Try again
            </button>
          </div>
        );
      default:
        return null;
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
  




  return (
    <div className="app-container">
      <h1>Your Universal Web3 Wallet</h1>
      {web3Instance ? (
        <>
          {sessionState === 'COMPLETED' ? (
            <div className="flex flex-col gap-2 w-full max-w-md">
              <input 
                type="text" 
                placeholder="Recipient Address" 
                value={recipientAddress} 
                onChange={(e) => setRecipientAddress(e.target.value)} 
                className="p-2 border rounded"
              />
              <input 
                type="text" 
                placeholder="Amount to Send (ETH)" 
                value={amountToSend} 
                onChange={(e) => setAmountToSend(e.target.value)} 
                className="p-2 border rounded"
              />
              <button onClick={handleSendTransaction} className="h-12 bg-blue-700 hover:bg-blue-800 rounded-md font-bold text-white w-full">
                Send
              </button>
            </div>
          ) : (
            <div className="text-center text-red-500">
              Please complete the KYC process before sending funds.
            </div>
          )}
          {userAddress && <div className="address-display">Address: {userAddress}</div>}
          {renderReclaim()}
        </>
      ) : (
        <button onClick={handleWeb3AuthLogin} className="h-12 bg-blue-700 hover:bg-blue-800 rounded-md font-bold text-white w-full max-w-md">
          Login with Web3Auth
        </button>
      )}
    </div>
  );
}

export default App;