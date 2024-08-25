/*
    * 读取私钥，构造keypair进行操作
*/

const { LAMPORTS_PER_SOL, Keypair } = require('@solana/web3.js');
const  base58 = require('bs58')
const nacl = require('tweetnacl');
const fs = require('fs');

const { get_authorize_message, get_authorize_token, get_user_info } = require('./src/initialization')
const { check_in, sendSOLRandom, claimBoxes, openBoxes } = require('./src/daily_tasks');
const logger = require('./src/setup_log');
const { log } = require('winston');

// 获取公私钥对keypair
async function getKeypairFromPrivateKey(privateKey) {
    return Keypair.fromSecretKey(base58.decode(privateKey));
}

// 读取privateKeys.json文件并解析为数组
const privateKeys = JSON.parse(fs.readFileSync('./config/privateKeys.json', 'utf8'));


(async () => {
    const totalKeys = privateKeys.length; // 总私钥数量
    for (let i = 0; i < totalKeys; i++) {
        try {

            const privateKey = privateKeys[i];
            logger.debug(`正在处理第 ${i + 1} 个私钥/总共 ${totalKeys} 个私钥`);

            const my_keypair = await getKeypairFromPrivateKey(privateKey)

            // 获取授权消息
            const authorize_message = await get_authorize_message(my_keypair);

            // 构造获取authorize token的http请求所需的参数
            const publicKey = my_keypair.publicKey;
            const address = publicKey.toString();
            const encodedPublicKey = Buffer.from(my_keypair.publicKey.toBytes()).toString('base64');
            const sign = nacl.sign.detached(Buffer.from(authorize_message), my_keypair.secretKey);
            const signature = Buffer.from(sign).toString('base64');
            
            // 获取authorize token
            const authorize_token = await get_authorize_token(publicKey, encodedPublicKey, signature);

            // 获取账户详情: sol余额，ring数量和box数量
            const user_info_befor = await get_user_info(authorize_token);
            const user_sol_balance = user_info_befor.wallet_balance;
            const user_ring_balance = user_info_befor.ring;
            logger.debug(`地址 ${address} : sol余额为 ${user_sol_balance/LAMPORTS_PER_SOL}, 指环数量: ${user_ring_balance}`);

            // 进行签到
            await check_in(my_keypair, authorize_token);
            
            // 进行创建tx
            await sendSOLRandom(my_keypair, authorize_token);
            
            // 领取每日箱子
            await claimBoxes(authorize_token, address);

            const user_info_after = await get_user_info(authorize_token);
            const user_available_boxes_after = user_info_after.ring_monitor;
            logger.debug(`地址 ${address} 箱子数量: ${user_available_boxes_after}`);

            // // 打开箱子
            await openBoxes(authorize_token, my_keypair, user_available_boxes_after);
        } catch (error) {
            logger.error(`第 ${i + 1} 个私钥执行任务出现问题 ${error.message}`);
        }
    }

})();
