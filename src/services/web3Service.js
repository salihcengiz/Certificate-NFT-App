import { ethers } from 'ethers';
import detectEthereumProvider from '@metamask/detect-provider';
import { uploadToPinata } from './pinataService';

const NFT_CONTRACT_ADDRESS = "0xeB6731aE55120A03E90aB1C008a4e421c10C6464";

const EDU_CHAIN_CONFIG = {
  chainId: '0xa045c', // 656476 (0xa045c)
  chainName: 'EDU Chain Testnet',
  nativeCurrency: {
    name: 'EDU',
    symbol: 'EDU',
    decimals: 18
  },
  rpcUrls: ['https://rpc.edu.eluv.io'],
  blockExplorerUrls: ['https://testnet.eduscan.io']
};

const switchToEduChain = async () => {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: EDU_CHAIN_CONFIG.chainId }],
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [EDU_CHAIN_CONFIG],
        });
      } catch (addError) {
        throw new Error('Could not add EDU Chain network: ' + addError.message);
      }
    } else {
      throw new Error('Could not switch network: ' + switchError.message);
    }
  }
};

export const connectWallet = async () => {
  try {
    const provider = await detectEthereumProvider();
    
    if (provider) {
      await provider.request({ method: 'eth_requestAccounts' });
      await switchToEduChain();
      
      const ethersProvider = new ethers.BrowserProvider(window.ethereum);
      const signer = await ethersProvider.getSigner();
      const address = await signer.getAddress();

      const network = await ethersProvider.getNetwork();
      if (network.chainId !== 656476n) {
        throw new Error('Please switch to EDU Chain Testnet network!');
      }

      return { success: true, address };
    } else {
      throw new Error("MetaMask is not installed!");
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const mintNoteAsNFT = async (noteData, imageBase64) => {
  try {
    const provider = await detectEthereumProvider();
    
    if (!provider) {
      throw new Error("MetaMask yüklü değil!");
    }

    const ethersProvider = new ethers.BrowserProvider(window.ethereum, {
      name: 'EDU Chain Testnet',
      chainId: 656476
    });
    
    const network = await ethersProvider.getNetwork();
    if (network.chainId !== 656476n) {
      await switchToEduChain();
    }

    // Görseli Pinata'ya yükle
    const tokenURI = await uploadToPinata(imageBase64);
    console.log('Pinata URI:', tokenURI);

    const signer = await ethersProvider.getSigner();

    // NFT kontratı ile etkileşim
    const contract = new ethers.Contract(
      NFT_CONTRACT_ADDRESS,
      ["function mintNote(address recipient, string memory tokenURI) public returns (uint256)"],
      signer
    );

    // Pinata URI'sini kullanarak NFT mint et
    const tx = await contract.mintNote(await signer.getAddress(), tokenURI);
    await tx.wait(); // Transaction'ın tamamlanmasını bekle

    return { 
      success: true, 
      transaction: tx,
      tokenURI: tokenURI,
      explorerUrl: `${EDU_CHAIN_CONFIG.blockExplorerUrls[0]}/tx/${tx.hash}`
    };
  } catch (error) {
    console.error('Mint hatası:', error);
    return { success: false, error: error.message };
  }
}; 