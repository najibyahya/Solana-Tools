const fs = require('fs');

class FileHandler {
  static readFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File ${filePath} tidak ditemukan`);
      }
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      console.error(`Error membaca file ${filePath}:`, error.message);
      return null;
    }
  }

  static writeFile(filePath, content) {
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    } catch (error) {
      console.error(`Error menulis file ${filePath}:`, error.message);
      return false;
    }
  }

  static appendFile(filePath, content) {
    try {
      fs.appendFileSync(filePath, content, 'utf8');
      return true;
    } catch (error) {
      console.error(`Error menambah file ${filePath}:`, error.message);
      return false;
    }
  }

  static readWallets(filePath) {
    const content = this.readFile(filePath);
    if (!content) return [];

    return content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const [address, privateKey] = line.split(':');
        return { address, privateKey };
      });
  }

  static readMnemonics(filePath) {
    const content = this.readFile(filePath);
    if (!content) return [];

    return content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }
}

module.exports = FileHandler;
