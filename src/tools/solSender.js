const { Keypair, Transaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const bs58 = require('bs58').default;
const FileHandler = require('../utils/fileHandler');
const SolanaConnection = require('../../config/connection');
const { seru, plus, mins, info } = require('../utils/colors');
const delay = require('../utils/delay');

class SolSender {
  constructor(rl) {
    this.rl = rl;
    this.connection = SolanaConnection.getConnection();
  }

  createKeypairFromPrivateKey(privateKeyString) {
    try {
      const privateKey = bs58.decode(privateKeyString);
      return Keypair.fromSecretKey(privateKey);
    } catch (error) {
      console.error(`${mins} Error creating keypair:`, error);
      throw error;
    }
  }

  async ensureAccountExists(publicKey) {
    try {
      const accountInfo = await this.connection.getAccountInfo(publicKey);
      return accountInfo !== null;
    } catch (error) {
      console.error(`${mins} Error checking account:`, error);
      return false;
    }
  }

  async getMinimumRentForAccount() {
    try {
      return await this.connection.getMinimumBalanceForRentExemption(0);
    } catch (error) {
      console.error(`${mins} Error getting minimum rent:`, error);
      return 890880;
    }
  }

  async sendSol(fromKeypair, toPublicKey, amount) {
    try {
      const accountExists = await this.ensureAccountExists(toPublicKey);
      let amountToSend = amount;

      if (!accountExists) {
        const minimumRent = await this.getMinimumRentForAccount();
        console.log(`${info} Recipient account does not exist. Adding minimum rent : \x1b[33m${minimumRent / LAMPORTS_PER_SOL} SOL\x1b[0m`);
        amountToSend += minimumRent;
      }

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromKeypair.publicKey,
          toPubkey: toPublicKey,
          lamports: amountToSend,
        })
      );
      
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [fromKeypair],
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          commitment: 'confirmed'
        }
      );
      
      console.log(`${plus} Transferred \x1b[33m${amountToSend / LAMPORTS_PER_SOL} SOL\x1b[0m from \x1b[33mMain Wallet\x1b[0m to \x1b[33m${toPublicKey.toString().slice(0, 5)}...${toPublicKey.toString().slice(-5)}\x1b[0m`);
      console.log(`${plus} TX Hash : \x1b[32m${signature}\x1b[0m`);
      return signature;
    } catch (error) {
      console.error(`${mins} Error sending SOL to \x1b[33m${toPublicKey.toString()}\x1b[0m :`, error);
      throw error;
    }
  }

  async processWallet(mainWalletKeypair, walletData, walletPublicKey, amountToSend) {
    try {
      const walletKeypair = this.createKeypairFromPrivateKey(walletData.privateKey);
      
      await delay(2000);
      
      await this.sendSol(mainWalletKeypair, walletKeypair.publicKey, amountToSend);
      
      await delay(1300);

      const walletBalance = await this.connection.getBalance(walletKeypair.publicKey);
      console.log(`${plus} Balance : \x1b[33m${walletBalance / LAMPORTS_PER_SOL} SOL\x1b[0m`);
      
      return { success: true };
    } catch (error) {
      console.error(`${mins} Error processing wallet \x1b[33m${walletPublicKey}\x1b[0m :`, error);
      return { success: false };
    }
  }

  async processWalletsSequentially(mainWalletKeypair, wallets, amountToSend) {
    const walletPublicKeys = Object.keys(wallets);
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < walletPublicKeys.length; i++) {
      const walletPublicKey = walletPublicKeys[i];
      const walletAddress = wallets[walletPublicKey].address;
      
      console.log(`\n${seru} Wallet \x1b[33m${walletAddress}\x1b[0m [\x1b[32m${i+1}\x1b[0m/\x1b[34m${walletPublicKeys.length}\x1b[0m]`);
      
      try {
        const result = await this.processWallet(
          mainWalletKeypair, 
          wallets[walletPublicKey], 
          walletPublicKey,
          amountToSend
        );
        
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error(`${mins} Error in wallet processing loop for ${walletAddress}:`, error);
        failCount++;
      }
    }
    
    return { successCount, failCount };
  }

  async getUserInput() {
    return new Promise((resolve) => {
      this.rl.question('\nInputkan SOL yang ingin disend per walletnya : ', (answer) => {
        const amount = parseFloat(answer);
        if (isNaN(amount) || amount <= 0) {
          console.log(`${mins} Invalid input. Please enter a positive number.`);
          resolve(this.getUserInput());
        } else {
          resolve(amount * LAMPORTS_PER_SOL);
        }
      });
    });
  }

  loadWallets() {
    try {
      const wallets = FileHandler.readWallets('privkey-tuyul.txt');
      const walletsObj = {};
      
      for (const wallet of wallets) {
        try {
          const keypair = this.createKeypairFromPrivateKey(wallet.privateKey);
          const publicKey = keypair.publicKey.toString();
          
          walletsObj[publicKey] = { 
            privateKey: wallet.privateKey,
            address: wallet.address
          };
        } catch (error) {
          console.error(`${mins} Invalid wallet line: ${wallet.address}...`);
        }
      }
      
      return walletsObj;
    } catch (error) {
      console.error(`${mins} Error loading wallet data:`, error);
      process.exit(1);
    }
  }

  async send() {
    console.log(`\n[ \x1b[33mSEND SOL TO TUYUL\x1b[0m - \x1b[34mt.me/boterdrop\x1b[0m ]\n`);
    console.log(`Pastikan Private key Main Wallet (privkey-main-wallet.txt) \ndan Private key Tuyul (privkey-tuyul.txt sudah terisi)`);

    const mainWalletData = FileHandler.readFile('privkey-main-wallet.txt');
    if (!mainWalletData) {
      console.log('File privkey-main-wallet.txt tidak ditemukan');
      return;
    }

    const privateKeyFromFile = mainWalletData.trim().split(':')[1];
    const wallets = this.loadWallets();
    const walletCount = Object.keys(wallets).length;
    
    if (walletCount === 0) {
      console.error(`${mins} No wallets found in private key file`);
      return;
    }
    
    const amountToSend = await this.getUserInput();
    
    console.log(`\n${seru} \x1b[33mINFO\x1b[0m :`);
    console.log(`    Total Wallet      : \x1b[33m${walletCount}\x1b[0m`);
    console.log(`    Amount to send    : \x1b[33m${amountToSend / LAMPORTS_PER_SOL} SOL\x1b[0m`);
    
    const mainWalletKeypair = this.createKeypairFromPrivateKey(privateKeyFromFile);
    console.log(`    Main wallet       : \x1b[33m${mainWalletKeypair.publicKey.toString()}\x1b[0m`);
    
    const mainWalletInitialBalance = await this.connection.getBalance(mainWalletKeypair.publicKey);
    console.log(`    Balance           : \x1b[33m${mainWalletInitialBalance / LAMPORTS_PER_SOL} SOL\x1b[0m`);
    
    await delay(1300);
    
    const minimumRent = await this.getMinimumRentForAccount();
    console.log(`    Minimum Rent      : \x1b[33m${minimumRent / LAMPORTS_PER_SOL} SOL\x1b[0m`);

    console.log(`\n=====================================================================`);

    const result = await this.processWalletsSequentially(mainWalletKeypair, wallets, amountToSend);
    
    const mainWalletFinalBalance = await this.connection.getBalance(mainWalletKeypair.publicKey);
    
    console.log(`\n${seru} \x1b[34mRINGKASAN\x1b[0m :`);
    console.log(`    Total Wallet        : \x1b[33m${walletCount}\x1b[0m`);
    console.log(`    Processed           : \x1b[32m${result.successCount}\x1b[0m`);
    console.log(`    Failed              : \x1b[31m${result.failCount}\x1b[0m`);
    console.log(`    Now Wallet Balance  : \x1b[33m${mainWalletFinalBalance / LAMPORTS_PER_SOL} SOL\x1b[0m`);
    console.log(`    Berkurang           : \x1b[33m${(mainWalletFinalBalance - mainWalletInitialBalance) / LAMPORTS_PER_SOL} SOL\x1b[0m`);
    console.log("");
    
    console.log("\x1b[32mDONE!, Kembali ke Menu Tools\x1b[0m");
    await delay(3000);
  }
}

module.exports = SolSender;
