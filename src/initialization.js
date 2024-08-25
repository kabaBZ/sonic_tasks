/**
 * 初始化操作
 * 获取登陆token
 * 获取用户数据
 */

const axios = require('axios');
const logger = require('./setup_log');

const HEADERS = { 
    'accept': '*/*', 
    'accept-language': 'zh-CN,zh;q=0.9', 
    'origin': 'https://odyssey.sonic.game', 
    'priority': 'u=1, i', 
    'referer': 'https://odyssey.sonic.game/', 
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36', 
};

// 获取签名消息
async function get_authorize_message(keypair){
  try {
      const publickey = keypair.publicKey.toString();
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://odyssey-api-beta.sonic.game/auth/sonic/challenge?wallet=${publickey}`,
        headers: HEADERS
      };

      const result = await axios.request(config);
      return result.data.data;
  } catch (error) {
      logger.error(`获取签名消息出现错误: ${error.message}`)
  }
}

// 获取授权token
async function get_authorize_token(publickey, encodedPublicKey, signature) {
    try {
      let data = {
        "address": `${publickey}`,
        "address_encoded": `${encodedPublicKey}`,
        "signature": `${signature}`
      };
      
      let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://odyssey-api-beta.sonic.game/auth/sonic/authorize',
        headers: HEADERS,
        data : data
      };

      const result = await axios.request(config);
      return result.data.data.token;
  } catch (error) {
    logger.error(`获取授权token出现错误: ${error.message}`);
  }
};

// 获取用户数据
async function get_user_info(authorize_token) {
  try {
    let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: 'https://odyssey-api-beta.sonic.game/user/rewards/info',
        headers: { ...HEADERS, Authorization: authorize_token },
    };

    const result = await axios.request(config);
    return result.data.data;
  } catch (error) {
    logger.error(`获取用户数据出现错误: ${error.message}`);
  }
}

module.exports = { get_authorize_message, get_authorize_token, get_user_info };
