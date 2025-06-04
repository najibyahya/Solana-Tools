const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58').default;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const createKeypairFromPrivateKey = (privateKeyString) => {
    try {
        const privateKey = bs58.decode(privateKeyString);
        return Keypair.fromSecretKey(privateKey);
    } catch (error) {
        console.error('Error creating keypair:', error);
        throw error;
    }
};

const toBase58 = (buffer) => {
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
};

const askQuestion = (rl, query) => {
    return new Promise((resolve) => {
        rl.question(query, (answer) => {
            resolve(answer);
        });
    });
};

module.exports = {
    delay,
    createKeypairFromPrivateKey,
    toBase58,
    askQuestion
};
