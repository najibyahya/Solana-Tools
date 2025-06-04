const readline = require('readline');
const WalletCreator = require('../tools/walletCreator');
const MnemonicConverter = require('../tools/mnemonicConverter');
const SolSender = require('../tools/solSender');
const BalanceCollector = require('../tools/balanceCollector');
const TokenChecker = require('../tools/tokenChecker');
const TokenTransfer = require('../tools/tokenTransfer');
const delay = require('../utils/delay');

class MainMenu {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  displayMenu() {
    console.log(`
  [\x1b[34m1\x1b[0m] Create Wallet
  [\x1b[34m2\x1b[0m] Convert Mnemonic/Seed Pharse [12/24] to Private Key
  [\x1b[34m3\x1b[0m] Send SOL form Main Wallet to Tuyul
  [\x1b[34m4\x1b[0m] Send All Balance from Tuyul to Main Wallet
  [\x1b[34m5\x1b[0m] Checker Token
  [\x1b[34m6\x1b[0m] Send Token
  [\x1b[31mq\x1b[0m] Quit
  `);
  }

  async start() {
    this.displayMenu();
    
    this.rl.question('Vote \x1b[34m»\x1b[0m ', async (option) => {
      try {
        switch (option) {
          case '1':
            const walletCreator = new WalletCreator(this.rl);
            await walletCreator.create();
            await this.start();
            break;
          case '2':
            const mnemonicConverter = new MnemonicConverter();
            await mnemonicConverter.convert();
            console.log("\x1b[32mDONE!, Kembali ke Menu Tools\x1b[0m");
            await delay(3000);
            await this.start();
            break;
          case '3':
            const solSender = new SolSender(this.rl);
            await solSender.send();
            await this.start();
            break;
          case '4':
            const balanceCollector = new BalanceCollector();
            await balanceCollector.collect();
            await this.start();
            break;
          case '5':
            const tokenChecker = new TokenChecker(this.rl);
            await tokenChecker.check();
            console.log("\x1b[32mDONE!, Kembali ke Menu Tools\x1b[0m");
            await delay(3000);
            await this.start();
            break;
          case '6':
            const tokenTransfer = new TokenTransfer(this.rl);
            await tokenTransfer.start();
            console.log("\x1b[32mDONE!, Kembali ke Menu Tools\x1b[0m");
            await delay(3000);
            await this.start();
            break;
          case 'q':
            console.log('\nQUIT\n');
            this.rl.close();
            return;
          default:
            console.log('Invalid option. Please try again.');
            await this.start();
        }
      } catch (error) {
        console.error('Error occurred:', error);
        await this.start();
      }
    });
  }

  close() {
    this.rl.close();
  }
}

module.exports = MainMenu;
