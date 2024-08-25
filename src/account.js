const fs = require('fs');
const { Keypair } = require('@solana/web3.js');
const bip39 = require('bip39');
const bs58 = require('bs58');
const { derivePath } = require('ed25519-hd-key');
const logger = require('./setup_log')

const privateKeysNUM = 100;
const seedPhrasesOrKeys = JSON.parse(fs.readFileSync('./config/mnemonics.json', 'utf-8'));

async function getKeypairFromSeed(seedPhrase, keypairNum) {
    const privateKeys = [];
    const seed = await bip39.mnemonicToSeed(seedPhrase);
    const deriveKeypair = (seed, index) => {
        const path = `m/44'/501'/${index}'/0'`;
        const derivedSeed = derivePath(path, seed.toString('hex')).key;
        return Keypair.fromSeed(derivedSeed);
    };
    for (let i = 0; i < keypairNum; i++) {
        const keypair = deriveKeypair(seed, i);
        const secretKeyBase58 = bs58.encode(keypair.secretKey);
        privateKeys.push(secretKeyBase58);
    }
    return privateKeys;
  }

(async () => {
    try {
        const privateKeys = await getKeypairFromSeed(seedPhrasesOrKeys[0], privateKeysNUM);
        fs.writeFileSync('./config/privateKeys.json', JSON.stringify(privateKeys, null, 2));
    } catch (error) { 
        logger.error(`写入私钥出现错误 ${error.message}`);
    }
  })();