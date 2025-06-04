const { Connection, PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const axios = require('axios');
const FileHandler = require('../utils/fileHandler');
const delay = require('../utils/delay');

class TokenChecker {
  constructor(rl) {
    this.rl = rl;
    this.CONNECTION_URL = 'https://api.mainnet-beta.solana.com';
    this.MAX_RETRIES = 3;
    this.RETRY_DELAY = 10000;
    this.TOKEN_LIST_URL = 'https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json';
    this.tokenDatabase = {};
    this.connection = new Connection(this.CONNECTION_URL);
  }

  getTokenInfo(mintAddress) {
    if (this.tokenDatabase[mintAddress]) {
      return this.tokenDatabase[mintAddress];
    }
    return { name: 'Unknown Token', symbol: 'UNKNOWN' };
  }

  async handleRateLimit(fn) {
    let retries = 0;
    
    while (retries < this.MAX_RETRIES) {
      try {
        return await fn();
      } catch (error) {
        if (error.message.includes('429')) {
          console.log(`\x1b[33mTerjadi error 429. Menunggu ${this.RETRY_DELAY/1000} detik... (Attempt ${retries+1}/${this.MAX_RETRIES})\x1b[0m`);
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
          retries++;
        } else {
          throw error;
        }
      }
    }
    throw new Error('Maximum retries exceeded');
  }

  async getTokenAccounts(walletAddress) {
    return this.handleRateLimit(async () => {
      try {
        const publicKey = new PublicKey(walletAddress);
        const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
          publicKey,
          { programId: TOKEN_PROGRAM_ID }
        );
        
        return tokenAccounts.value.map(({ account, pubkey }) => {
          const { mint, tokenAmount } = account.data.parsed.info;
          const tokenInfo = this.getTokenInfo(mint);
          
          return {
            tokenAddress: pubkey.toString(),
            mintAddress: mint,
            amount: tokenAmount.uiAmount,
            decimals: tokenAmount.decimals,
            name: tokenInfo.name,
            symbol: tokenInfo.symbol
          };
        });
      } catch (error) {
        throw new Error(`Error mendapatkan token accounts: ${error.message}`);
      }
    });
  }

  async getSolBalance(walletAddress) {
    return this.handleRateLimit(async () => {
      try {
        const publicKey = new PublicKey(walletAddress);
        const balance = await this.connection.getBalance(publicKey);
        return balance / 1000000000;
      } catch (error) {
        throw new Error(`Error mendapatkan SOL balance: ${error.message}`);
      }
    });
  }

  async initTokenDatabase() {
    return this.handleRateLimit(async () => {
      try {
        const response = await axios.get(this.TOKEN_LIST_URL);
        const tokens = response.data.tokens;
        
        tokens.forEach(token => {
          this.tokenDatabase[token.address] = {
            name: token.name,
            symbol: token.symbol,
            logoURI: token.logoURI
          };
        });
        
        console.log(`\x1b[32mDatabase token berhasil dimuat: ${tokens.length} token\x1b[0m\n`);
      } catch (error) {
        console.error(`\x1b[31mError memuat database token: ${error.message}\x1b[0m`);
        console.log('\x1b[33mMelanjutkan tanpa database token\x1b[0m');
      }
    });
  }

  async check() {
    console.log(`\n[ \x1b[33mCHECKER TOKEN\x1b[0m - \x1b[34mt.me/boterdrop\x1b[0m ]\n`);
    console.log(`\x1b[34mTerhubung ke ${this.CONNECTION_URL}\x1b[0m`);
    await this.initTokenDatabase();

    return new Promise((resolve) => {
      this.rl.question('Masukkan data txt wallet solana atau single wallet address: ', async (input) => {
        let wallets = [];
        
        if (input.endsWith('.txt')) {
          const walletsData = FileHandler.readWallets(input);
          wallets = walletsData.map(w => ({ address: w.address, privateKey: w.privateKey }));
          console.log(`\n\x1b[32mDitemukan ${wallets.length} wallet di file.\x1b[0m\n`);
        } else {
          console.log(`\x1b[33mMenggunakan single wallet address\x1b[0m\n`);
          wallets = [{ address: input, privateKey: null }];
        }
        
        if (wallets.length === 0) {
          console.log(`\x1b[31mTidak ada wallet yang valid untuk diperiksa.\x1b[0m`);
          resolve();
          return;
        }
        
        for (let i = 0; i < wallets.length; i++) {
          await delay(1000);
          const { address } = wallets[i];
          
          console.log(`\x1b[33mWallet ${address}\x1b[0m [\x1b[32m${i+1}\x1b[0m/\x1b[34m${wallets.length}\x1b[0m]`);
          
          try {
            const solBalance = await this.getSolBalance(address);
            console.log(`\x1b[32mSOL Balance : ${solBalance} SOL\x1b[0m`);
            
            const tokens = await this.getTokenAccounts(address);
            
            if (tokens.length) {
              tokens
                .filter(token => token.amount !== 0)
                .forEach((token, idx) => {
                  console.log(`\x1b[34mToken #${idx+1}:\x1b[0m`);
                  console.log(`  Nama         : \x1b[32m${token.name} (${token.symbol})\x1b[0m`);
                  console.log(`  Mint Address : \x1b[32m${token.mintAddress}\x1b[0m`);
                  console.log(`  Amount       : \x1b[32m${token.amount}\x1b[0m`);
                  console.log(`  Decimals     : \x1b[32m${token.decimals}\x1b[0m`);
                });
            } else {
              console.log(`\x1b[33mTidak ada token SPL yang ditemukan.\x1b[0m`);
            }
          } catch (error) {
            console.log(`\x1b[31mError memeriksa wallet ${address}: ${error.message}\x1b[0m`);
          }
          
          console.log('');
        }
        
        resolve();
      });
    });
  }
}

module.exports = TokenChecker;
