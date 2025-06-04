const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58').default;
const bip39 = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const FileHandler = require('../utils/fileHandler');
const delay = require('../utils/delay');

class MnemonicConverter {
  constructor() {
    this.MNEMONIC_FILE = 'mnemonic.txt';
    this.OUTPUT_FILE = 'convertToPK.txt';
  }

  readExistingWallets(filePath) {
    try {
      const content = FileHandler.readFile(filePath);
      if (!content) return {};

      const wallets = {};
      content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .forEach(line => {
          const [address, privateKey] = line.split(':');
          if (address && privateKey) {
            wallets[address] = privateKey;
          }
        });
      return wallets;
    } catch (error) {
      console.error(`Error membaca file ${filePath}:`, error.message);
      return {};
    }
  }

  writeWalletsToFile(filePath, wallets) {
    const content = Object.entries(wallets)
      .map(([address, privateKey]) => `${address}:${privateKey}`)
      .join('\n');
    FileHandler.writeFile(filePath, content);
  }

  updateMnemonicFile(mnemonics) {
    FileHandler.writeFile(this.MNEMONIC_FILE, mnemonics.join('\n'));
  }

  countMnemonicWords(mnemonic) {
    return mnemonic.trim().split(/\s+/).length;
  }

  async mnemonicToKeypair(mnemonic) {
    try {
      if (!bip39.validateMnemonic(mnemonic)) {
        console.error(`Mnemonic tidak valid: ${mnemonic.substring(0, 20)}...`);
        return null;
      }

      const seed = await bip39.mnemonicToSeed(mnemonic);
      const derivedPath = "m/44'/501'/0'/0'";
      const derivedSeed = derivePath(derivedPath, seed.toString('hex')).key;
      const keypair = Keypair.fromSeed(Uint8Array.from(derivedSeed));
      return keypair;
    } catch (error) {
      console.error(`Error mengkonversi mnemonic: ${error.message}`);
      return null;
    }
  }

  async convert() {
    console.log(`\n[ \x1b[33mCONVERT MNEMONIC TO PRIVATE KEY\x1b[0m - \x1b[34mt.me/boterdrop\x1b[0m ]`);
    await delay(2000);

    let mnemonics = FileHandler.readMnemonics(this.MNEMONIC_FILE);
    if (!mnemonics.length) {
      console.log(`File ${this.MNEMONIC_FILE} tidak ditemukan atau kosong`);
      return;
    }

    console.log(`\n\x1b[33mDitemukan ${mnemonics.length} mnemonic di file\x1b[0m`);

    const existingWallets = this.readExistingWallets(this.OUTPUT_FILE);
    console.log(`\x1b[33mDitemukan ${Object.keys(existingWallets).length} wallet yang sudah ada di ${this.OUTPUT_FILE}\x1b[0m`);

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    let remainingMnemonics = [...mnemonics];

    for (let i = 0; i < mnemonics.length; i++) {
      const mnemonic = mnemonics[i];
      const wordCount = this.countMnemonicWords(mnemonic);
      
      console.log(`\n\x1b[33mMnemonic ${wordCount} kata, ${mnemonic.substring(0, 20)}...\x1b[0m [\x1b[32m${i+1}\x1b[0m/\x1b[34m${mnemonics.length}\x1b[0m]`);
      
      const keypair = await this.mnemonicToKeypair(mnemonic);
      if (!keypair) {
        failCount++;
        continue;
      }
      
      const publicKey = keypair.publicKey.toString();
      const privateKeyBase58 = bs58.encode(keypair.secretKey);
      
      if (existingWallets[publicKey]) {
        console.log(`\x1b[34mAddress ${publicKey} sudah ada di file output, dilewati\x1b[0m`);
        skipCount++;
        
        const indexToRemove = remainingMnemonics.indexOf(mnemonic);
        if (indexToRemove !== -1) {
          remainingMnemonics.splice(indexToRemove, 1);
          this.updateMnemonicFile(remainingMnemonics);
        }
        continue;
      }
      
      existingWallets[publicKey] = privateKeyBase58;
      console.log(`\x1b[33mAddress\x1b[0m     : \x1b[32m${publicKey}\x1b[0m`);
      console.log(`\x1b[33mPrivate Key\x1b[0m : \x1b[32m${privateKeyBase58.substring(0, 41)}...\x1b[0m`);
      successCount++;
      
      this.writeWalletsToFile(this.OUTPUT_FILE, existingWallets);
      
      const indexToRemove = remainingMnemonics.indexOf(mnemonic);
      if (indexToRemove !== -1) {
        remainingMnemonics.splice(indexToRemove, 1);
        this.updateMnemonicFile(remainingMnemonics);
      }
    }

    console.log('\nSave at convertToPK.txt');
    console.log(`\nRINGKASAN :`);
    console.log(`- Berhasil dikonversi                   : \x1b[32m${successCount}\x1b[0m`);
    console.log(`- Dilewati (sudah ada)                  : \x1b[34m${skipCount}\x1b[0m`);
    console.log(`- Gagal dikonversi                      : \x1b[31m${failCount}\x1b[0m`);
    console.log(`- Total wallet di ${this.OUTPUT_FILE}       : \x1b[33m${Object.keys(existingWallets).length}\x1b[0m`);
    console.log(`- Mnemonic yang tersisa di ${this.MNEMONIC_FILE} : \x1b[33m${remainingMnemonics.length}\x1b[0m\n`);
  }
}

module.exports = MnemonicConverter;
