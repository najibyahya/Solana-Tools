const { Keypair } = require('@solana/web3.js');
const FileHandler = require('../utils/fileHandler');
const delay = require('../utils/delay');

class WalletCreator {
  constructor(rl) {
    this.rl = rl;
  }

  toBase58(buffer) {
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let carry;
    const digits = [0];

    for (let i = 0; i < buffer.length; i++) {
      carry = buffer[i];
      for (let j = 0; j < digits.length; j++) {
        carry += digits[j] << 8;
        digits[j] = carry % 58;
        carry = (carry / 58) | 0;
      }
      while (carry) {
        digits.push(carry % 58);
        carry = (carry / 58) | 0;
      }
    }

    let result = '';
    for (let k = 0; k < buffer.length && buffer[k] === 0; k++) {
      result += '1';
    }
    for (let k = digits.length - 1; k >= 0; k--) {
      result += alphabet[digits[k]];
    }

    return result;
  }

  generateWallet() {
    const keypair = Keypair.generate();
    const privateKey = this.toBase58(keypair.secretKey);
    const publicKey = keypair.publicKey.toString();

    return { privateKey, publicKey };
  }

  async create() {
    console.log(`\n[ \x1b[33mCREATE WALLET SOLANA\x1b[0m - \x1b[34mt.me/boterdrop\x1b[0m ]`);

    const numWallets = await this.askQuestion("\nMasukkan jumlah wallet yang ingin dibuat: ");

    let existingWallets = '';
    const existingContent = FileHandler.readFile('wallet-baru.txt');
    if (existingContent) {
      existingWallets = existingContent.trim() + '\n';
    }

    let newWalletsContent = existingWallets;

    for (let i = 0; i < numWallets; i++) {
      const { privateKey, publicKey } = this.generateWallet();

      newWalletsContent += `${publicKey}:${privateKey}\n`;

      console.log(`\n\x1b[93mWallet ${i + 1}\x1b[0m`);
      console.log(`\x1b[94mAddress     : \x1b[92m${publicKey}\x1b[0m`);
      console.log(`\x1b[94mPrivate Key : \x1b[92m${privateKey}\x1b[0m`);
    }

    FileHandler.writeFile('wallet-baru.txt', newWalletsContent.trim());

    console.log("\n\x1b[93mWallet tersimpan di wallet-baru.txt dengan format <address>:<privatekey>\x1b[0m\n");
    console.log("\x1b[32mDONE!, Kembali ke Menu Tools\x1b[0m");
    await delay(3000);
  }

  askQuestion(query) {
    return new Promise((resolve) => {
      this.rl.question(query, (answer) => {
        resolve(answer);
      });
    });
  }
}

module.exports = WalletCreator;
