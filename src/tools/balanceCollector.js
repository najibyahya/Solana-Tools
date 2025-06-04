const { Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const bs58 = require('bs58').default;
const FileHandler = require('../utils/fileHandler');
const SolanaConnection = require('../../config/connection');
const { seru, plus, mins, info } = require('../utils/colors');
const delay = require('../utils/delay');

class BalanceCollector {
  constructor() {
    this.connection = SolanaConnection.getConnection();
    this.MIN_BALANCE_THRESHOLD = 0.00089088 * LAMPORTS_PER_SOL;
    this.FEE_FUNDING_AMOUNT = 0.001 * LAMPORTS_PER_SOL;
  }

  async collect() {
    const mainWalletData = FileHandler.readFile('privkey-main-wallet.txt');
    if (!mainWalletData) {
      console.log('File privkey-main-wallet.txt tidak ditemukan');
      return;
    }

    const mainWalletParts = mainWalletData.trim().split(':');
    const mainWalletPrivateKey = bs58.decode(mainWalletParts[1]);
    const mainWallet = Keypair.fromSecretKey(mainWalletPrivateKey);
    const mainWalletAddress = mainWallet.publicKey.toString();
    
    const tuyulWallets = FileHandler.readWallets('privkey-tuyul.txt');
    if (!tuyulWallets.length) {
      console.log('File privkey-tuyul.txt tidak ditemukan atau kosong');
      return;
    }

    const tuyulAccountsData = {};
    for (const wallet of tuyulWallets) {
      try {
        const privateKeyBytes = bs58.decode(wallet.privateKey.trim());
        const walletKeypair = Keypair.fromSecretKey(privateKeyBytes);
        
        if (walletKeypair.publicKey.toString() !== wallet.address) {
          console.error(`${mins} Address mismatch for wallet: ${wallet.address}`);
          continue;
        }
        
        tuyulAccountsData[wallet.address] = {
          privateKey: wallet.privateKey.trim()
        };
      } catch (error) {
        console.error(`${mins} Error membuat wallet dari private key: ${error.message}`);
      }
    }
    
    const totalWallets = Object.keys(tuyulAccountsData).length;
    const initialMainBalance = await this.connection.getBalance(mainWallet.publicKey);
    const initialMainBalanceSOL = initialMainBalance / LAMPORTS_PER_SOL;
    
    console.log(`\n[ \x1b[33mSEND ALL BALANCE SOL TO MAIN WALLET\x1b[0m - \x1b[34mt.me/boterdrop\x1b[0m ]\n`);
    console.log(`Pastikan Private key Main Wallet (privkey-main-wallet.txt) \ndan Private key Tuyul (privkey-tuyul.txt sudah terisi)`);

    console.log(`\n${seru} \x1b[33mINFO\x1b[0m :`);
    console.log(`    Total Wallet   : \x1b[33m${totalWallets}\x1b[0m`);
    console.log(`    Main Wallet    : \x1b[33m${mainWalletAddress}\x1b[0m`);
    console.log(`    Total Balance  : \x1b[33m${initialMainBalanceSOL.toFixed(8)} SOL\x1b[0m`);
    console.log(`\n=====================================================================`);
    await delay(3000);

    let totalSOLCollected = 0;
    let processedWalletsCount = 0;
    let minThresholdWalletsCount = 0;
    let failedWalletsCount = 0;
    let skippedWalletsCount = 0;
    let walletProcess = 0;

    for (const [walletAddress, walletData] of Object.entries(tuyulAccountsData)) {
      walletProcess++;
      try {
        const privateKeyBytes = bs58.decode(walletData.privateKey);
        const tuyulWallet = Keypair.fromSecretKey(privateKeyBytes);
        
        if (tuyulWallet.publicKey.toString() !== walletAddress) {
          console.error(`${mins} Error: Public key mismatch for ${walletAddress}`);
          continue;
        }
        
        const balance = await this.connection.getBalance(tuyulWallet.publicKey);
        const balanceInSOL = balance / LAMPORTS_PER_SOL;
        
        if (balance <= 0) {
          console.log(`\n${seru} Wallet \x1b[33m${walletAddress}\x1b[0m [\x1b[32m${walletProcess}\x1b[0m/\x1b[34m${totalWallets}\x1b[0m]`);
          console.log(`${mins} Balance : \x1b[33mNo balance\x1b[0m, Skip`);
          skippedWalletsCount++;
          await delay(2000);
          continue;
        }
        
        console.log(`\n${seru} Wallet \x1b[33m${walletAddress}\x1b[0m [\x1b[32m${walletProcess}\x1b[0m/\x1b[34m${totalWallets}\x1b[0m]`);
        console.log(`${plus} Balance : \x1b[33m${balanceInSOL.toFixed(8)} SOL\x1b[0m`);

        // Handle minimum balance threshold wallets
        if (Math.abs(balance - this.MIN_BALANCE_THRESHOLD) < 1) {
          await this.handleMinBalanceWallet(mainWallet, tuyulWallet, balance);
          minThresholdWalletsCount++;
          processedWalletsCount++;
        } else {
          await this.handleRegularWallet(mainWallet, tuyulWallet, balance);
          processedWalletsCount++;
        }
        
        totalSOLCollected += balance / LAMPORTS_PER_SOL;
        
      } catch (error) {
        console.error(`${mins} Error processing ${walletAddress}: ${error.message}`);
        failedWalletsCount++;
      }
    }
      
    const finalMainBalance = await this.connection.getBalance(mainWallet.publicKey);
    const finalMainBalanceSOL = finalMainBalance / LAMPORTS_PER_SOL;
    const difference = finalMainBalance - initialMainBalance;
    const differenceSOL = difference / LAMPORTS_PER_SOL;
    
    console.log(`\n=====================================================================`);
    console.log(`\n${seru} \x1b[34mRINGKASAN\x1b[0m :`);
    console.log(`    Total Wallets             : \x1b[33m${totalWallets}\x1b[0m`);
    console.log(`    Processed                 : \x1b[32m${processedWalletsCount}\x1b[0m`);
    console.log(`    Failed                    : \x1b[31m${failedWalletsCount}\x1b[0m`);
    console.log(`    Skipped                   : \x1b[33m${skippedWalletsCount}\x1b[0m`);
    console.log(`    First Main Wallet Balance : \x1b[33m${initialMainBalanceSOL.toFixed(8)} SOL\x1b[0m`);
    console.log(`    Total SOL Received        : \x1b[33m${differenceSOL.toFixed(8)} SOL\x1b[0m`);
    console.log(`    Final Main Wallet Balance : \x1b[33m${finalMainBalanceSOL.toFixed(8)} SOL\x1b[0m`);
    console.log(``);

    console.log("\x1b[32mDONE!, Kembali ke Menu Tools\x1b[0m");
    await delay(3000);
  }

  async handleMinBalanceWallet(mainWallet, tuyulWallet, balance) {
    // Fund the wallet first
    const recentBlockhash = await this.connection.getRecentBlockhash('confirmed');
    const fundingTx = new Transaction({
      feePayer: mainWallet.publicKey,
      recentBlockhash: recentBlockhash.blockhash
    }).add(
      SystemProgram.transfer({
        fromPubkey: mainWallet.publicKey,
        toPubkey: tuyulWallet.publicKey,
        lamports: this.FEE_FUNDING_AMOUNT,
      })
    );
    
    fundingTx.sign(mainWallet);
    
    try {
      const fundingSignature = await this.connection.sendRawTransaction(fundingTx.serialize());
      await delay(1300);
      
      console.log(`${plus} Funded with \x1b[33m0.001 SOL\x1b[0m from \x1b[33mMain Wallet\x1b[0m`);
      console.log(`${plus} TX Hash : \x1b[32m${fundingSignature}\x1b[0m`);
      
      // Now transfer all balance
      const newBalance = await this.connection.getBalance(tuyulWallet.publicKey);
      await this.transferAllBalance(tuyulWallet, mainWallet.publicKey, newBalance);
      
    } catch (fundingError) {
      console.error(`${mins} Error funding wallet: ${fundingError.message}`);
    }
  }

  async handleRegularWallet(mainWallet, tuyulWallet, balance) {
    try {
      await this.transferAllBalance(tuyulWallet, mainWallet.publicKey, balance);
    } catch (error) {
      if (error.message && error.message.includes("insufficient funds for rent")) {
        console.log(`${info} Wallet needs funding for rent. Sending 0.001 SOL from main wallet...`);
        await this.handleMinBalanceWallet(mainWallet, tuyulWallet, balance);
      } else {
        throw error;
      }
    }
  }

  async transferAllBalance(fromWallet, toPublicKey, balance) {
    const recentBlockhash = await this.connection.getRecentBlockhash('confirmed');
    
    const transaction = new Transaction({
      feePayer: fromWallet.publicKey,
      recentBlockhash: recentBlockhash.blockhash
    }).add(
      SystemProgram.transfer({
        fromPubkey: fromWallet.publicKey,
        toPubkey: toPublicKey,
        lamports: balance,
      })
    );
    
    const feeCalculator = await this.connection.getFeeForMessage(transaction.compileMessage());
    const fee = feeCalculator.value || 5000;
    const transferAmount = balance - fee;
    
    if (transferAmount > 0) {
      transaction.instructions[0] = SystemProgram.transfer({
        fromPubkey: fromWallet.publicKey,
        toPubkey: toPublicKey,
        lamports: transferAmount,
      });
      
      transaction.sign(fromWallet);
      
      const signature = await this.connection.sendRawTransaction(transaction.serialize());
      
      console.log(`${plus} Transferred \x1b[33m${(transferAmount / LAMPORTS_PER_SOL).toFixed(8)} SOL\x1b[0m to \x1b[33mMain Wallet\x1b[0m`);
      console.log(`${plus} TX Hash : \x1b[32m${signature}\x1b[0m`);
      
      return transferAmount;
    }
    
    return 0;
  }
}

module.exports = BalanceCollector;
