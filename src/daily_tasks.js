/**
 * 任务处理模块
 * 每日签到
 * 构造tx
 * 领取箱子
 * 打开箱子
 */


const axios = require('axios');
const { Connection, Transaction, Keypair, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction } = require('@solana/web3.js');
const logger = require('./setup_log');

const randomDelay = async (minSeconds, maxSeconds) => {
    const delayTime = Math.random() * (maxSeconds - minSeconds) + minSeconds;
    return new Promise((resolve) => setTimeout(resolve, delayTime * 1000));
};

// 连接sonic dev rpc
const DEVNET_URL = 'https://devnet.sonic.game/';
// const sonic_dev_connection = new Connection(DEVNET_URL, 'confirmed');

// 发送raw transaction交易
async function sendTrancations(transaction, keypair, retry_count = 0) {
    // 重试函数
    const retry = async (failed_reason) => {
        if (retry_count < 5) {
            logger.warn(`交易发送失败 : ${failed_reason}, 正在重试...(${retry_count + 1}/5)`);
            await randomDelay(5, 6);
            return await sendTrancations(transaction, keypair, retry_count + 1);
        } else {
            logger.error(`交易发送失败，已达到最大重试次数`);
        }
    };

    try {
        const sonic_dev_connection_new = new Connection(DEVNET_URL, 'confirmed');

        const serializedTransaction = transaction.serialize();
        const signature = await sonic_dev_connection_new.sendRawTransaction(serializedTransaction);
        const latestBlockHash = await sonic_dev_connection_new.getLatestBlockhash();

        await sonic_dev_connection_new.confirmTransaction({
            blockhash: latestBlockHash.blockhash,
            lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
            signature: signature});

        return signature;
    } catch (error) {
        await retry(error.message);
    }
}

// 日常签到函数
async function check_in(keypair, authorize_token, retry_count = 0) {
    await randomDelay(1, 3);
    const address = keypair.publicKey.toString();
    logger.info(`地址 ${address} 开始签到`);
    // 重试函数
    const retry = async (failed_reason) => {
        if (retry_count < 5) {
            logger.warn(`地址 ${address} 签到失败 : ${failed_reason}, 正在重试...(${retry_count + 1}/5)`);
            await randomDelay(2, 4);
            return await check_in(keypair, authorize_token, retry_count + 1);
        } else {
            logger.error(`地址 ${address} 签到失败，已达到最大重试次数`);
        }
    };

    try {
        // 获取签到hash
        let get_hash_config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: 'https://odyssey-api-beta.sonic.game/user/check-in/transaction',
            headers: { 
                'accept': '*/*', 
                'accept-language': 'zh-CN,zh;q=0.9', 
                'authorization': authorize_token,
                'origin': 'https://odyssey.sonic.game', 
                'priority': 'u=1, i', 
                'referer': 'https://odyssey.sonic.game/', 
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36', 
            }
        };

        // 获取签到hash
        const get_hash_result = await axios.request(get_hash_config);
        
        // 对获取的hash进行解码，keypair发送解码数据获取signature
        const transactionBuffer = Buffer.from(get_hash_result.data.data.hash, 'base64');
        const transaction = Transaction.from(transactionBuffer);
        transaction.partialSign(keypair);
        const signature = await sendTrancations(transaction, keypair)

        // 发送signature来进行签到
        let check_in_data = JSON.stringify({
            "hash": signature
        });

        // 根据获取的signature进行签到
        let check_in_config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://odyssey-api-beta.sonic.game/user/check-in',
            headers: { 
                'accept': '*/*', 
                'accept-language': 'zh-CN,zh;q=0.9', 
                'authorization': authorize_token, 
                'content-type': 'application/json', 
                'origin': 'https://odyssey.sonic.game', 
                'priority': 'u=1, i', 
                'referer': 'https://odyssey.sonic.game/', 
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
            },
            data : check_in_data
        };
        const checki_in_result = await axios.request(check_in_config);
        if (checki_in_result.data.status == 'success') {
            logger.success(`地址 ${address} 签到成功`)
        }
    } catch (error) {
        if (error.response.data.message == 'current account already checked in') {
            logger.warn(`地址 ${address} 已签到`);
        } else {
            await retry(error.message);
        }
    }
}

// 向随机地址发送sol来生成tx
async function sendSOLRandom(keypair, authorize_token, tx_num = 100) {
    const address = keypair.publicKey.toString();
    logger.info(`地址 ${address} 开始转账构建tx`);

    const lamportsToSend = 0.001 * LAMPORTS_PER_SOL;

    fromKeypair = keypair;
    try {
        const total_transactions = await getTotalTranscations(authorize_token, address);
        if (total_transactions >= 100) {
            logger.success(`地址 ${address} 今日的tx数量已达100条, 无需转账构造tx`);
            return;
        }
        tx_num = 100 - total_transactions + 10;

        for (i = 0; i < tx_num; i ++) {
            await randomDelay(1, 3);
            try {
                const sonic_dev_connection_new = new Connection(DEVNET_URL, 'confirmed');

                const randomToKeypair = Keypair.generate();

                const transferTransaction = new Transaction().add(
                    SystemProgram.transfer({
                        fromPubkey: fromKeypair.publicKey,
                        toPubkey: randomToKeypair.publicKey,
                        lamports: lamportsToSend,
                    }));

                const signature = await sendAndConfirmTransaction(sonic_dev_connection_new, transferTransaction, [fromKeypair]);
                logger.success(`转账TX(${i + 1}/${tx_num}次) confirmed with signature: ${signature}`);
            } catch (error) {
                logger.error(`转账TX(${i + 1}/${tx_num}次) 失败 ${error}`);
            }
        }
        logger.success(`地址 ${address} 转账构造tx完成`);
    } catch (error) {
        logger.error(`发送转账构建tx出现错误: ${error.message}`);
    }
}


// 领取箱子函数
async function claimBox(authorize_token, stageNum, address) {
    try {
        await randomDelay(1, 3);
        let claim_boxes_data = {"stage": stageNum};
        let claim_boxes_config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://odyssey-api-beta.sonic.game/user/transactions/rewards/claim',
            headers: { 
                'accept': '*/*', 
                'accept-language': 'zh-CN,zh;q=0.9', 
                'authorization': authorize_token, 
                'content-type': 'application/json', 
                'origin': 'https://odyssey.sonic.game', 
                'priority': 'u=1, i', 
                'referer': 'https://odyssey.sonic.game/', 
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
            },
            data : claim_boxes_data
        };
        const claim_boxes_result = await axios.request(claim_boxes_config);
        logger.success(`地址 ${address}的 stage${stageNum} 箱子领取成功 ${claim_boxes_result.status}}`);

    } catch (error) {
        if (error.response) {
            if (error.response.data.message == 'interact rewards already claimed') {
                logger.warn(`地址 ${address}的 stage${stageNum} 箱子已领取: ${error.response.data.message}`);
            } else {
                logger.error(`地址 ${address}的 stage${stageNum} 箱子领取请求返回错误: ${error.response.data.message}`);
            }
        } else {
            logger.error(`地址 ${address} 领取 stage${stageNum} 箱子时出现错误: ${error.message}`);
        }
    }
}

async function getTotalTranscations(authorize_token, address) {
    try {
        await randomDelay(1, 3);
        let transaction_amount_config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: 'https://odyssey-api-beta.sonic.game/user/transactions/state/daily',
            headers: { 
                'accept': '*/*', 
                'accept-language': 'zh-CN,zh;q=0.9', 
                'authorization': authorize_token,
                // 'if-none-match': 'W/"105-GxTqTK5YQ4HchymTSDKeRRdjN2c"', 
                'origin': 'https://odyssey.sonic.game', 
                'priority': 'u=1, i', 
                'referer': 'https://odyssey.sonic.game/', 
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
            }
        };

        const transaction_amount_result = await axios.request(transaction_amount_config);
        const total_transactions = transaction_amount_result.data.data.total_transactions;
        // logger.info(`地址 ${address} 今日的tx数量为: ${total_transactions}条`);
        return total_transactions;
    }catch (error) {
        logger.error(`地址 ${address} 获取今日总tx数量出现错误`)
    }
}

// 根据每日tx数量来调用领取箱子函数
async function claimBoxes(authorize_token, address) {
    logger.info(`地址 ${address} 开始领取箱子`);
    try {
        await randomDelay(1, 3);
        // 获取今日tx数量
        const total_transactions = await getTotalTranscations(authorize_token, address);

        // 领取箱子
        let stageNum;
        if (total_transactions < 10) { 
            throw new Error(`地址 ${address} tx数量小于10, 无可领取的箱子`);
            // return;
        } else if (total_transactions >= 10 && total_transactions < 50) {
            stageNum = 1;
        } else if (total_transactions >= 50 && total_transactions < 100) {
            stageNum = 2;
        } else if (total_transactions >= 100) {
            stageNum = 3;
        }
        for (i = 1; i < stageNum + 1; i++) {
            await claimBox(authorize_token, i, address);
        }
        logger.success(`地址 ${address} 领取箱子完成`);
    } catch (error) {
        if (error.response) {
            logger.error(`地址${address} 领取箱子请求返回错误: ${JSON.stringify(error, null, 2)}`);
        } else {
            logger.error(`地址${address}领取箱子出现错误: ${error.message}`)
        }
    }

}

// 开启单个箱子函数
async function openBox(authorize_token, keypair) {
    try {
        // await randomDelay(1, 3);
        let build_tx_config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: 'https://odyssey-api-beta.sonic.game/user/rewards/mystery-box/build-tx',
            headers: { 
                'accept': '*/*', 
                'accept-language': 'zh-CN,zh;q=0.9', 
                'authorization': authorize_token,
                'origin': 'https://odyssey.sonic.game', 
                'priority': 'u=1, i', 
                'referer': 'https://odyssey.sonic.game/', 
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
            }
        };

        const build_tx_result = await axios.request(build_tx_config);
        const build_tx_hash = build_tx_result.data.data.hash;

        const build_txBuffer = Buffer.from(build_tx_hash, 'base64');
        const build_tx = Transaction.from(build_txBuffer);
        build_tx.partialSign(keypair);

        // 根据signature来打开箱子
        const signature = await sendTrancations(build_tx, keypair);
        randomDelay(2, 4);
        let openBoxes_data = JSON.stringify({
            "hash": signature
        });
        let openBoxes_config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://odyssey-api-beta.sonic.game/user/rewards/mystery-box/open',
            headers: { 
                'accept': '*/*', 
                'accept-language': 'zh-CN,zh;q=0.9', 
                'authorization': authorize_token, 
                'content-type': 'application/json', 
                'origin': 'https://odyssey.sonic.game', 
                'priority': 'u=1, i', 
                'referer': 'https://odyssey.sonic.game/', 
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
            },
            data : openBoxes_data
        };
        const openBoxes_result = await axios.request(openBoxes_config);
        if (openBoxes_result.data.message == 'success') {
            logger.success(`开启箱子成功`);
        }
    } catch (error) {
        if (error.response) {
            logger.error(`开启箱子请求返回错误: ${error.response.data.message}`);
        } else {
            logger.error(`开启箱子出现错误: ${error.message}`);
        }
    }
}

async function openBoxes(authorize_token, keypair, user_available_boxes, retry_count = 0) {
    const address = keypair.publicKey.toString();

    // 重试函数
    const retry = async (failed_reason) => {
        if (retry_count < 5) {
            logger.warn(`地址 ${address} 开启箱子失败 : ${failed_reason}, 正在重试...(${retry_count + 1}/5)`);
            await await randomDelay(5, 8);
            return await openBoxes(authorize_token, keypair, user_available_boxes, retry_count + 1);
        } else {
            logger.error(`地址 ${address} 开启箱子失败，已达到最大重试次数`);
        }
    };

    try {
        await randomDelay(1, 3);
        logger.info(`地址 ${address} 有 ${user_available_boxes} 箱子可开启`);
        if (user_available_boxes == 0 ) {
            logger.error(`地址 ${address} 可开启箱子数量为0, 退出开启操作`);
        }

        for (boxNum = 1; boxNum <= user_available_boxes; boxNum++) {
            logger.info(`地址 ${address} 开启第(${boxNum}/${user_available_boxes})箱子`);
            await openBox(authorize_token, keypair);
            await randomDelay(5, 7);
        }
        logger.success(`地址 ${address} 的开启箱子操作完成`);
    } catch (error) {
        retry(error);
    }
}
module.exports = { check_in, sendSOLRandom, claimBoxes, openBoxes };