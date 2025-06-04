const { Connection } = require('@solana/web3.js');

class SolanaConnection {
  constructor() {
    this.RPC_ENDPOINT = "https://api.mainnet-beta.solana.com";
    this.COMMITMENT = 'confirmed';
    this.connection = new Connection(this.RPC_ENDPOINT, {
      commitment: this.COMMITMENT,
      confirmTransactionInitialTimeout: 60000,
      disableRetryOnRateLimit: false
    });
  }

  getConnection() {
    return this.connection;
  }
}

module.exports = new SolanaConnection();
