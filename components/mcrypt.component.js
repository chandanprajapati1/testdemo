const crypto = require("crypto");
const { getVoucherencdec } = require("../config/custom.config");

/**
 * Encrypt 3DES using Node.js's crypto module * 
 * @param data A utf8 string
 * @param key Key would be hashed by md5 and shorten to maximum of 192 bits,
 * @returns {*} A base64 string
 */
function encrypt(data, reEncrypt = false) {
    let iv, key
    if (reEncrypt) {
        iv = getVoucherencdec.reEnciv;
        key = getVoucherencdec.reEncKey;
    } else {
        iv = getVoucherencdec.iv;
        key = getVoucherencdec.key;
    }

    key = Buffer.concat([crypto.createHash('md5').update(key, 'utf8').digest(), crypto.createHash('md5').update(key, 'utf8').digest().slice(0, 8)]);

    let cipher = crypto.createCipheriv('des-ede3-cbc', key, iv);
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    return encrypted;
}

/**
 * Decrypt 3DES using Node.js's crypto module 
 * @param data a base64 string
 * @param key Key would be hashed by md5 and shorten to max 192 bits,
 * @returns {*} a utf8 string
 */
async function decrypt(data) {
    let key = getVoucherencdec.key;
    let iv = getVoucherencdec.iv;
    key = Buffer.concat([crypto.createHash('md5').update(key, 'utf8').digest(), crypto.createHash('md5').update(key, 'utf8').digest().slice(0, 8)]);
    iv = Buffer.from(iv, 'utf8');
    
    const decipher = crypto.createDecipheriv('des-ede3-cbc', key, iv);
    decipher.setAutoPadding(false);
    
    let decrypted = decipher.update(data, 'base64', 'binary');
    decrypted += decipher.final('binary');
    
    const lastByte = decrypted.charCodeAt(decrypted.length - 1);
    const paddingSize = lastByte <= 8 ? lastByte : 0;
    
    return decrypted.slice(0, -paddingSize);
    
}

module.exports = { encrypt, decrypt };