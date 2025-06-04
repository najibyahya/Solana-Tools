const { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount, createTransferCheckedInstruction, getMint, getAccount } = require('@solana/spl-token');
const bs58 = require('bs58').default;
const FileHandler = require('../utils/fileHandler');
const { seru, plus, mins, info } = require('../utils/colors');
const delay = require('../utils/delay');

class TokenTransfer {
  constructor(rl) {
    this.rl = rl;
    this.networks = {
      mainnet: 'https://api.mainnet-beta.solana.com',
      devnet: 'https://api.devnet.solana.com'
    };

    this.connection = new Connection(this.networks.mainnet, 'confirmed');
    this.mainWalletPath = 'privkey-main-wallet.txt';
    this.tuyulWalletsPath = 'privkey-tuyul.txt';
    this.SOL_FEE_AMOUNT = 0.001;
  }

  readMainWallet() {
    try {
      const data = FileHandler.readFile(this.mainWalletPath);
      if (!data) return null;
      
      const [address, privateKey] = data.trim().split(':');
      
      return {
        address,
        privateKey,
        keypair: Keypair.fromSecretKey(bs58.decode(privateKey))
      };
    } catch (error) {
      console.error('Gagal membaca main wallet:', error.message);
      return null;
    }
  }

  readTuyulWallets() {
    try {
      const wallets = FileHandler.readWallets(this.tuyulWalletsPath);
      return wallets.map(wallet => ({
        address: wallet.address,
        privateKey: wallet.privateKey,
        keypair: Keypair.fromSecretKey(bs58.decode(wallet.privateKey))
      }));
    } catch (error) {
      console.error('Gagal membaca tuyul wallets:', error.message);
      return [];
    }
  }

  async getSolBalance(publicKey) {
    try {
      const balance = await this.connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Gagal mendapatkan SOL balance:', error);
      return 0;
    }
  }

  async transferSOL(senderKeypair, recipientAddress, amount) {
    try {
      const recipientPublicKey = new PublicKey(recipientAddress);
      const lamports = amount * LAMPORTS_PER_SOL;
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: senderKeypair.publicKey,
          toPubkey: recipientPublicKey,
          lamports: Math.floor(lamports)
        })
      );
      
      transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
      transaction.feePayer = senderKeypair.publicKey;
      
      const signature = await this.connection.sendTransaction(transaction, [senderKeypair]);
      
      return {
        success: true,
        signature: signature,
        amount: amount
      };
    } catch (error) {
      console.error('Gagal transfer SOL:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getTokenInfo(tokenAddress) {
    try {
      const mintPublicKey = new PublicKey(tokenAddress);
      const mintInfo = await getMint(this.connection, mintPublicKey);
      
      return {
        name: mintInfo.address.toBase58(),
        symbol: 'N/A',
        decimals: mintInfo.decimals,
        totalSupply: mintInfo.supply
      };
    } catch (error) {
      console.error('Gagal mendapatkan informasi token:', error);
      return null;
    }
  }

  async getTokenBalance(walletPublicKey, tokenAddress) {
    try {
      const mintPublicKey = new PublicKey(tokenAddress);
      
      try {
        const tokenAccountAddress = await this.findAssociatedTokenAddress(
          walletPublicKey,
          mintPublicKey
        );
        
        const accountInfo = await getAccount(this.connection, tokenAccountAddress);
        const mintInfo = await getMint(this.connection, mintPublicKey);
        
        const balance = Number(accountInfo.amount) / (10 ** mintInfo.decimals);
        return { balance, decimals: mintInfo.decimals };
      } catch (error) {
        if (error.message.includes('TokenAccountNotFound') || 
            error.message.includes('Account does not exist')) {
          const mintInfo = await getMint(this.connection, mintPublicKey);
          return { balance: 0, decimals: mintInfo.decimals };
        }
        throw error;
      }
    } catch (error) {
      console.error('Gagal mendapatkan saldo:', error);
      return { balance: 0, decimals: 0 };
    }
  }

  async findAssociatedTokenAddress(walletAddress, tokenMintAddress) {
    const walletPublicKey = new PublicKey(walletAddress);
    const tokenMintPublicKey = new PublicKey(tokenMintAddress);
    
    const [associatedTokenAddress] = await PublicKey.findProgramAddress(
      [
        walletPublicKey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        tokenMintPublicKey.toBuffer(),
      ],
      new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
    );
    
    return associatedTokenAddress;
  }

  async transferToken(senderKeypair, tokenAddress, recipientAddress, amount) {
    try {
      const mintPublicKey = new PublicKey(tokenAddress);
      const recipientPublicKey = new PublicKey(recipientAddress);

      const solBalance = await this.getSolBalance(senderKeypair.publicKey);
      if (solBalance < 0.0005) {
        throw new Error("Insufficient SOL for transaction fees");
      }

      const mintInfo = await getMint(this.connection, mintPublicKey);

      const senderTokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection, 
        senderKeypair, 
        mintPublicKey, 
        senderKeypair.publicKey
      );

      const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection, 
        senderKeypair, 
        mintPublicKey, 
        recipientPublicKey
      );

      const transferAmount = BigInt(Math.floor(amount * (10 ** mintInfo.decimals)));

      const transaction = new Transaction().add(
        createTransferCheckedInstruction(
          senderTokenAccount.address,
          mintPublicKey,
          recipientTokenAccount.address,
          senderKeypair.publicKey,
          transferAmount,
          mintInfo.decimals
        )
      );

      transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
      transaction.feePayer = senderKeypair.publicKey;

      const signature = await this.connection.sendTransaction(transaction, [senderKeypair]);

      return {
        success: true,
        signature: signature.toString(),
        txid: signature,
        explorerLink: `https://solscan.io/tx/${signature}`,
        amount: amount
      };
    } catch (error) {
      if (error.message && 
          (error.message.includes('Attempt to debit an account but found no record of a prior credit') || 
          (error.transactionMessage && error.transactionMessage.includes('Attempt to debit an account but found no record of a prior credit')))) {
        
        return {
          success: false,
          error: error.message,
          needSol: true
        };
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  prompt(question) {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }

  async start() {
    console.log(`\n[ \x1b[33mSOLANA TOKEN TRANSFER\x1b[0m - \x1b[34mt.me/boterdrop\x1b[0m ]\n`);
    console.log('1. Transfer dari Main Wallet ke Multi Wallet');
    console.log('2. Transfer dari Multi Wallet ke Main Wallet');
    console.log('3. Transfer dengan input private dan address Manual');

    const choice = await this.prompt('\nVote \x1b[34m»\x1b[0m ');

    switch (choice) {
      case '1':
        await this.handleMainToMulti();
        break;
      case '2':
        await this.handleMultiToMain();
        break;
      case '3':
        await this.startTransferProcess();
        break;
      default:
        console.log('Pilihan tidak valid!');
        break;
    }
  }

  async handleMainToMulti() {
    console.log('\n=== TRANSFER DARI MAIN KE MULTI WALLET ===');
    
    if (!FileHandler.readFile(this.mainWalletPath)) {
      console.log(`File ${this.mainWalletPath} tidak ditemukan!`);
      return;
    }

    if (!FileHandler.readFile(this.tuyulWalletsPath)) {
      console.log(`File ${this.tuyulWalletsPath} tidak ditemukan!`);
      return;
    }

    const tokenAddress = await this.prompt('Masukkan Alamat Contract Token: ');
    const transferMethod = await this.prompt('Pilih Metode Transfer (1. Jumlah Tertentu per Wallet, 2. Transfer Semua (bagi rata)): ');

    if (transferMethod === '1') {
      const amount = parseFloat(await this.prompt('Masukkan Jumlah Token per Wallet: '));
      await this.sendToMultiWallets(tokenAddress, amount, false);
    } else if (transferMethod === '2') {
      await this.sendToMultiWallets(tokenAddress, 0, true);
    } else {
      console.log('Pilihan tidak valid!');
    }
  }

  async handleMultiToMain() {
    console.log('\n=== TRANSFER DARI MULTI KE MAIN WALLET ===');
    
    if (!FileHandler.readFile(this.mainWalletPath)) {
      console.log(`File ${this.mainWalletPath} tidak ditemukan!`);
      return;
    }

    if (!FileHandler.readFile(this.tuyulWalletsPath)) {
      console.log(`File ${this.tuyulWalletsPath} tidak ditemukan!`);
      return;
    }

    const tokenAddress = await this.prompt('Masukkan Alamat Contract Token: ');
    const transferMethod = await this.prompt('Pilih Metode Transfer (1. Jumlah Tertentu per Wallet, 2. Transfer Semua): ');

    if (transferMethod === '1') {
      const amount = parseFloat(await this.prompt('Masukkan Jumlah Token per Wallet: '));
      await this.sendFromMultiWalletsToMain(tokenAddress, false, amount);
    } else if (transferMethod === '2') {
      await this.sendFromMultiWalletsToMain(tokenAddress, true);
    } else {
      console.log('Pilihan tidak valid!');
    }
  }

  async startTransferProcess() {
    console.log('\n=== TRANSFER MANUAL ===');

    const privateKey = await this.prompt('Masukkan Private Key Pengirim (base58): ');
    let senderKeypair;
    try {
      senderKeypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    } catch (error) {
      console.error('Private key tidak valid!');
      return;
    }

    const tokenAddress = await this.prompt('Masukkan Alamat Contract Token: ');
    const tokenInfo = await this.getTokenInfo(tokenAddress);
    if (!tokenInfo) {
      console.log('Gagal mendapatkan informasi token.');
      return;
    }

    console.log('\nInformasi Token:');
    console.log(`- Alamat: ${tokenInfo.name}`);
    console.log(`- Desimal: ${tokenInfo.decimals}`);

    const solBalance = await this.getSolBalance(senderKeypair.publicKey);
    console.log(`- Saldo SOL: ${solBalance} SOL`);

    const balanceInfo = await this.getTokenBalance(senderKeypair.publicKey, tokenAddress);
    if (!balanceInfo) {
      console.log('Gagal mendapatkan saldo.');
      return;
    }

    console.log(`- Saldo Token: ${balanceInfo.balance} token`);

    const recipientAddress = await this.prompt('\nMasukkan Alamat Penerima: ');
    const transferMethod = await this.prompt('Pilih Metode Transfer (1. Jumlah Tertentu, 2. Transfer Semua): ');

    let transferAmount;
    if (transferMethod === '1') {
      transferAmount = parseFloat(await this.prompt('Masukkan Jumlah Token yang Akan Ditransfer: '));
      if (transferAmount > balanceInfo.balance) {
        console.log('Saldo tidak mencukupi!');
        return;
      }
    } else if (transferMethod === '2') {
      transferAmount = balanceInfo.balance;
    } else {
      console.log('Pilihan tidak valid!');
      return;
    }

    console.log('\nKonfirmasi Transfer:');
    console.log(`- Token: ${tokenAddress}`);
    console.log(`- Penerima: ${recipientAddress}`);
    console.log(`- Jumlah: ${transferAmount} token`);

    const result = await this.transferToken(senderKeypair, tokenAddress, recipientAddress, transferAmount);

    if (result.success) {
      console.log('\n✅ Transfer Berhasil!');
      console.log(`Signature: ${result.signature}`);
      console.log(`Explorer Link: ${result.explorerLink}`);
      console.log(`Jumlah: ${result.amount} token`);
    } else {
      console.log('\n❌ Transfer Gagal!');
      console.log(`Error: ${result.error}`);
    }
  }

  async sendToMultiWallets(tokenAddress, amount, transferAll = false) {
    const mainWallet = this.readMainWallet();
    if (!mainWallet) {
      console.log('Gagal membaca main wallet!');
      return false;
    }

    const tuyulWallets = this.readTuyulWallets();
    if (tuyulWallets.length === 0) {
      console.log('Tidak ada tuyul wallet yang terdaftar!');
      return false;
    }

    const tokenInfo = await this.getTokenInfo(tokenAddress);
    if (!tokenInfo) {
      console.log('Gagal mendapatkan informasi token.');
      return false;
    }

    const balanceInfo = await this.getTokenBalance(
      new PublicKey(mainWallet.address), 
      tokenAddress
    );
    
    if (!balanceInfo) {
      console.log('Gagal mendapatkan saldo main wallet.');
      return false;
    }

    console.log('\nInformasi Token:');
    console.log(`- Alamat: ${tokenInfo.name}`);
    console.log(`- Desimal: ${tokenInfo.decimals}`);
    console.log(`- Saldo Main Wallet: ${balanceInfo.balance} token`);

    const solBalance = await this.getSolBalance(new PublicKey(mainWallet.address));
    console.log(`- Saldo SOL Main Wallet: ${solBalance} SOL`);

    let amountPerWallet;
    if (transferAll) {
      amountPerWallet = balanceInfo.balance / tuyulWallets.length;
    } else {
      amountPerWallet = amount;
      if (amount * tuyulWallets.length > balanceInfo.balance) {
        console.log('Saldo tidak mencukupi untuk mentransfer ke semua wallet!');
        return false;
      }
    }

    console.log(`\nAkan mentransfer ${amountPerWallet} token ke ${tuyulWallets.length} wallet tuyul`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < tuyulWallets.length; i++) {
      const wallet = tuyulWallets[i];
      console.log(`\nTransfer ke wallet #${i+1}: ${wallet.address}`);

      const tuyulSolBalance = await this.getSolBalance(new PublicKey(wallet.address));
      console.log(`- Saldo SOL: ${tuyulSolBalance} SOL`);

      if (tuyulSolBalance < 0.0005) {
        console.log(`- Mengirim ${this.SOL_FEE_AMOUNT} SOL untuk fee`);
        const solResult = await this.transferSOL(
          mainWallet.keypair,
          wallet.address,
          this.SOL_FEE_AMOUNT
        );
        
        if (solResult.success) {
          console.log('✅ Transfer SOL Berhasil!');
          console.log(`Signature: ${solResult.signature}`);
          await delay(2000);
        } else {
          console.log('❌ Transfer SOL Gagal!');
          console.log(`Error: ${solResult.error}`);
          failCount++;
          continue;
        }
      }

      const result = await this.transferToken(
        mainWallet.keypair,
        tokenAddress,
        wallet.address,
        amountPerWallet
      );

      if (result.success) {
        console.log('✅ Transfer Token Berhasil!');
        console.log(`Signature: ${result.signature}`);
        console.log(`Explorer Link: ${result.explorerLink}`);
        successCount++;
      } else {
        console.log('❌ Transfer Token Gagal!');
        console.log(`Error: ${result.error}`);
        failCount++;
      }
    }

    console.log(`\nRingkasan: ${successCount} transfer berhasil, ${failCount} gagal.`);
    return true;
  }

  async sendFromMultiWalletsToMain(tokenAddress, transferAll = false, amount = 0) {
    const mainWallet = this.readMainWallet();
    if (!mainWallet) {
      console.log('Gagal membaca main wallet!');
      return false;
    }

    const tuyulWallets = this.readTuyulWallets();
    if (tuyulWallets.length === 0) {
      console.log('Tidak ada tuyul wallet yang terdaftar!');
      return false;
    }

    const tokenInfo = await this.getTokenInfo(tokenAddress);
    if (!tokenInfo) {
      console.log('Gagal mendapatkan informasi token.');
      return false;
    }

    console.log('\nInformasi Token:');
    console.log(`- Alamat: ${tokenInfo.name}`);
    console.log(`- Desimal: ${tokenInfo.decimals}`);
    console.log(`- Tujuan: ${mainWallet.address} (Main Wallet)`);

    const mainSolBalance = await this.getSolBalance(new PublicKey(mainWallet.address));
    console.log(`- Saldo SOL Main Wallet: ${mainSolBalance} SOL`);

    let successCount = 0;
    let failCount = 0;
    let totalTransferred = 0;

    for (let i = 0; i < tuyulWallets.length; i++) {
      const wallet = tuyulWallets[i];
      console.log(`\nProses wallet #${i+1}: ${wallet.address}`);

      const walletSolBalance = await this.getSolBalance(new PublicKey(wallet.address));
      console.log(`- Saldo SOL: ${walletSolBalance} SOL`);

      const balanceInfo = await this.getTokenBalance(
        new PublicKey(wallet.address),
        tokenAddress
      );

      if (!balanceInfo || balanceInfo.balance <= 0) {
        console.log(`- Saldo Token: 0 token atau tidak dapat diperiksa`);
        console.log('- Skip karena tidak ada saldo');
        failCount++;
        continue;
      }

      console.log(`- Saldo Token: ${balanceInfo.balance} token`);

      let transferAmount;
      if (transferAll) {
        transferAmount = balanceInfo.balance;
      } else {
        transferAmount = amount;
        if (transferAmount > balanceInfo.balance) {
          console.log('- Saldo tidak mencukupi, skip wallet ini');
          failCount++;
          continue;
        }
      }

      if (walletSolBalance < 0.0005) {
        console.log(`- SOL tidak cukup untuk fee. Mengirim ${this.SOL_FEE_AMOUNT} SOL dari main wallet`);
        const solResult = await this.transferSOL(
          mainWallet.keypair,
          wallet.address,
          this.SOL_FEE_AMOUNT
        );
        
        if (solResult.success) {
          console.log('✅ Transfer SOL Berhasil!');
          console.log(`Signature: ${solResult.signature}`);
          await delay(2000);
        } else {
          console.log('❌ Transfer SOL Gagal!');
          console.log(`Error: ${solResult.error}`);
          failCount++;
          continue;
        }
      }

      const result = await this.transferToken(
        wallet.keypair,
        tokenAddress,
        mainWallet.address,
        transferAmount
      );

      if (result.success) {
        console.log('✅ Transfer Token Berhasil!');
        console.log(`Signature: ${result.signature}`);
        console.log(`Explorer Link: ${result.explorerLink}`);
        totalTransferred += transferAmount;
        successCount++;
      } else if (result.needSol) {
        console.log('❌ Transfer Gagal karena kurang SOL!');
        console.log(`Error: ${result.error}`);
        
        console.log(`- Mengirim ${this.SOL_FEE_AMOUNT} SOL untuk fee dan mencoba lagi`);
        const solResult = await this.transferSOL(
          mainWallet.keypair,
          wallet.address,
          this.SOL_FEE_AMOUNT
        );
        
        if (solResult.success) {
          console.log('✅ Transfer SOL Berhasil!');
          console.log(`Signature: ${solResult.signature}`);
          await delay(5000);
          
          console.log('- Mencoba transfer token lagi...');
          const retryResult = await this.transferToken(
            wallet.keypair,
            tokenAddress,
            mainWallet.address,
            transferAmount
          );
          
          if (retryResult.success) {
            console.log('✅ Transfer Token Berhasil pada percobaan kedua!');
            console.log(`Signature: ${retryResult.signature}`);
            console.log(`Explorer Link: ${retryResult.explorerLink}`);
            totalTransferred += transferAmount;
            successCount++;
          } else {
            console.log('❌ Transfer Token Gagal pada percobaan kedua!');
            console.log(`Error: ${retryResult.error}`);
            failCount++;
          }
        } else {
          console.log('❌ Transfer SOL Gagal!');
          console.log(`Error: ${solResult.error}`);
          failCount++;
        }
      } else {
        console.log('❌ Transfer Token Gagal!');
        console.log(`Error: ${result.error}`);
        failCount++;
      }
    }

    console.log(`\nRingkasan: ${successCount} transfer berhasil, ${failCount} gagal.`);
    console.log(`Total token yang ditransfer ke main wallet: ${totalTransferred}`);
    return true;
  }
}

module.exports = TokenTransfer;
