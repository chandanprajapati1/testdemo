const logs = require("../logs");
const { sendResponse, generateRandomNumber, isNumeric, str_replace, isEmpty } = require("../helpers/helper");
const element = require("../helpers/index");
const vouchagram = require("../helpers/voucharHelper");
const smsComponent = require("../components/smsGateway.component");
const vouchagramComponent = require("../components/vouchagram.component");
const MCrypt = require("../components/mcrypt.component");
var moment = require('moment');
const queryBuilder = require("../helpers/queryBuilderHelper");

const { customConfig, constantData, containerRedemptionType, apiSources } = require("../config/custom.config");

const EPAY_URL = customConfig.EPAY_URL;

const generateOTP = async (req, res) => {
    try {
        const request_key = req.headers['request-key'] ? req.headers['request-key'] : "";

        const { userid, password } = req.headers;
        let reqBodyData = req.body;

        let buyerRequest = {
            "userid": userid,
            "password": password,
            "type": ''
        };

        const user = await queryBuilder.getBuyerDetails(buyerRequest);

        if (!isEmpty(user)) {

            if (request_key !== '' && ((request_key === customConfig.CONTAINER_KEY.KEY && containerRedemptionType.includes(user.container_redemption_type)) || (request_key === customConfig.CONSUMER_KEY.KEY && user.consumer_merchant === 'Y'))) {
                user.is_ip_validation = 'No';
            }

            let client_ip = await element.getClientIP(req);
            let is_parameter_encryption = user.is_parameter_encryption.toLowerCase();

            if (user.is_ip_validation.toLowerCase() == 'yes') {
                client_ip = (client_ip) ? client_ip : "";
                let validateIpRequest = { 'buyer_id': user.id, 'ip_address': client_ip };
                let ip_matched = await queryBuilder.validateClientIp(req, validateIpRequest);

                if (!ip_matched) {
                    return res.send(await sendResponse(7, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'generateOtp [ ' + client_ip + ' ]'));
                }
            }

            if (is_parameter_encryption == "y") {
                reqBodyData = await element.parameterDecryption(reqBodyData.data, user.hash_secret_key, user.secret_iv);

                if (!reqBodyData) {
                    return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'getWalletBalance parameterDecryption [ ' + client_ip + ' ]'));
                }
            }

            reqBodyData = element.obj_key_case_change(reqBodyData, 'CASE_LOWER');

            let logKey = 'MOBILE [' + reqBodyData.mobile + client_ip + '] ' + ': generateOtp ';

            logs.wrapper_log('info', logKey + JSON.stringify(reqBodyData));

            if (!reqBodyData.mobile) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (!element.isValidMobileNum(reqBodyData.mobile)) {
                return res.send(await sendResponse(5, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }
            if (!reqBodyData.mid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (reqBodyData.mid && reqBodyData.mid != user.merchant_guid) {
                return res.send(await sendResponse(25, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }
            if (!reqBodyData.tid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            const encmobile = element.piEncryption(reqBodyData.mobile);

            let customerDetails = await queryBuilder.checkUserAgainstMerchantId({ 'merchant_id': user.merchant_id, 'mobile': encmobile });

            if (customerDetails == null && user.external_wallet_topup == "1") {
                let createUserRequest = { 'merchant_id': user.merchant_id, 'tid': reqBodyData.tid, 'mobile': encmobile, 'user_type': 1, 'created_by': 1, 'updated_by': 1, 'status': 'A' }

                customerDetails = await queryBuilder.createUserAgainstMerchant(createUserRequest);
                if (!customerDetails || customerDetails.insertId == 0) {
                    return res.send(await sendResponse(8, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                }
                customerDetails.status = 'A';

            } else if (customerDetails == null && user.external_wallet_topup == "0") {
                return res.send(await sendResponse(25, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (customerDetails.status != 'A') {
                return res.send(await sendResponse(42, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            let otpUserData = await queryBuilder.getOtpUserData({ 'mid': reqBodyData.mid, 'mobile': encmobile });

            let curDateTime = moment().format('YYYY-MM-DD HH:mm:ss');

            let block_date = (moment(otpUserData?.blocked_date).isValid()) ? moment(otpUserData?.blocked_date).format('YYYY-MM-DD HH:mm:ss') : null;

            if (otpUserData?.blocked_date !== null && block_date > curDateTime) {

                if (otpUserData.invalid_otp_attempts == 3) {
                    var otpAttempts = { 'Code': '21', 'Message': 'Your account has been temporarily blocked for ' + (constantData.INVALID_ATTEMPT_INITIAL_TIME_DELAY_SECONDS / 60) + ' minutes.' };
                } else if (otpUserData.invalid_otp_attempts % 3 == 0) {
                    var otpAttempts = { 'Code': '21', 'Message': 'Your account has been temporarily blocked for ' + (constantData.INVALID_ATTEMPT_FINAL_TIME_DELAY_SECONDS / 60) + ' minutes.' };
                } else {
                    var otpAttempts = { 'Code': '21', 'Message': 'Your account has been temporarily blocked for ' + (constantData.INVALID_ATTEMPT_INITIAL_TIME_DELAY_SECONDS / 60) + ' minutes.' };
                }
                return res.send(await sendResponse(null, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, otpAttempts));
            } else {

                let otp = generateRandomNumber();
                let valid_time = moment().add(900, 'seconds').format('YYYY-MM-DD HH:mm:ss');
                let otpRequest = { 'status': 'Expired', 'mobile': encmobile };
                await queryBuilder.updateOtpCodeData(otpRequest);

                let otpUserRecord = {}
                if (otpUserData) {
                    otpUserRecord = {
                        id: otpUserData.id,
                        mobile: encmobile,
                        created: curDateTime
                    };

                } else {
                    otpUserRecord = {
                        merchant_id: user.merchant_id,
                        tid: reqBodyData.tid,
                        mobile: encmobile,
                        status: 'A',
                        created: curDateTime
                    };
                }

                // Create or update a user
                const otpUserNew = await queryBuilder.upsertOtpUser(otpUserRecord);

                if (otpUserNew) {

                    const otpUserId = otpUserNew.insertId;
                    let getOTPRequest = { 'otp_user_id': otpUserId };
                    let alreadyExistOtps = await queryBuilder.getLastOtp(getOTPRequest);

                    let newOtpData = {
                        otp_user_id: otpUserId,
                        code: otp,
                        valid_till: valid_time,
                        status: 'Not Used',
                        created: curDateTime
                    };
                    const otpDataNew = await queryBuilder.createRecord('otp_codes', newOtpData);

                    if (otpDataNew) {
                        let mode = 1;
                        if (alreadyExistOtps) {
                            let lastOTPCreated = moment().add(15, 'minutes').format('YYYY-MM-DD HH:mm:ss');
                            if (curDateTime < lastOTPCreated) {
                                mode = 6;
                            }
                        }

                        const smsResponse = await smsComponent.sendOTPSMS(reqBodyData.mobile, otp.toString(), mode);

                        if (smsResponse.statusCode == 200) {
                            return res.send(await sendResponse(0, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                        } else {
                            return res.send(await sendResponse(14, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                        }
                    } else {
                        return res.send(await sendResponse(14, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                    }
                } else {
                    return res.send(await sendResponse(14, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                }
            }
        } else {
            return res.send(await sendResponse(25));
        }
    } catch (error) {
        logs.wrapper_log('error', error.message);
        console.log(error);
        return res.send(await sendResponse(14));
    }
}

const getWalletBalance = async (req, res) => {
    try {
        const request_key = req.headers['request-key'] ? req.headers['request-key'] : "";

        const { userid, password } = req.headers;
        let reqBodyData = req.body;

        let buyerRequest = {
            "userid": userid,
            "password": password,
            "type": ''
        };

        const user = await queryBuilder.getBuyerDetails(buyerRequest);

        if (user) {

            if (request_key !== '' && ((request_key === customConfig.CONTAINER_KEY.KEY && containerRedemptionType.includes(user.container_redemption_type)) || (request_key === customConfig.CONSUMER_KEY.KEY && user.consumer_merchant === 'Y'))) {
                user.is_ip_validation = 'No';
            }

            let client_ip = await element.getClientIP(req);
            let is_parameter_encryption = user.is_parameter_encryption.toLowerCase();

            if (user.is_ip_validation.toLowerCase() == 'yes') {
                client_ip = (client_ip) ? client_ip : "";
                let validateIpRequest = { 'buyer_id': user.id, 'ip_address': client_ip };
                let ip_matched = await queryBuilder.validateClientIp(req, validateIpRequest);

                if (!ip_matched) {
                    return res.send(await sendResponse(7, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'getWalletBalance IP Validation [ ' + client_ip + ' ]'));
                }
            }

            if (is_parameter_encryption == "y") {
                reqBodyData = await element.parameterDecryption(reqBodyData.data, user.hash_secret_key, user.secret_iv);

                if (!reqBodyData) {
                    return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'getWalletBalance parameterDecryption [ ' + client_ip + ' ]'));
                }
            }

            reqBodyData = element.obj_key_case_change(reqBodyData, 'CASE_LOWER');
            let logKey = 'MOBILE [' + reqBodyData.mobile + client_ip + '] ' + ': getWalletBalance ';

            logs.wrapper_log('info', logKey + JSON.stringify(reqBodyData));

            if (!reqBodyData.mobile) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (!element.isValidMobileNum(reqBodyData.mobile)) {
                return res.send(await sendResponse(5, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }
            if (!reqBodyData.mid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (reqBodyData.mid && reqBodyData.mid != user.merchant_guid) {
                return res.send(await sendResponse(25, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }
            if (!reqBodyData.tid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            const encmobile = element.piEncryption(reqBodyData.mobile);

            let vchrCount = user.vchr_count;
            let voucherCategoryFlag = user.voucher_category_flag;
            let VoucherCategory = '';

            if (voucherCategoryFlag == 'Y' && reqBodyData.category) {
                VoucherCategory = reqBodyData.category;
            }

            let customerDetails = await queryBuilder.checkUserAgainstMerchantId({ 'merchant_id': user.merchant_id, 'mobile': encmobile });

            if (customerDetails == null) {
                let createUserRequest = { 'merchant_id': user.merchant_id, 'tid': reqBodyData.tid, 'mobile': encmobile, 'user_type': 1, 'created_by': 1, 'updated_by': 1, 'status': 'A' }

                customerDetails = await queryBuilder.createUserAgainstMerchant(createUserRequest);

                var customerDetailsResult = {};

                if (customerDetails) {
                    var returnData = { balance: "0.00" };
                    if (vchrCount == 'Y') {
                        returnData.voucher_count = "0";
                    }
                    if (voucherCategoryFlag == 'Y') {
                        returnData.hold_balance = "0.00";
                    }

                    customerDetailsResult = await sendResponse(0, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, returnData);
                } else {
                    customerDetailsResult = await sendResponse(8, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey);
                }

                return res.send(customerDetailsResult);
            }

            if (customerDetails.status != 'A') {
                return res.send(await sendResponse(42, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            let walletMainBalance = 0;
            let walletBalance = {};
            let walletBalanceRequest;
            if (voucherCategoryFlag == 'Y') {
                walletBalanceRequest = { 'user_id': customerDetails.id, 'merchant_id': customerDetails.merchant_id, 'category': VoucherCategory };
                walletBalance = await queryBuilder.getWalletBalanceQuery(walletBalanceRequest, VoucherCategory);
            } else {
                walletBalanceRequest = { 'user_id': customerDetails.id, 'merchant_id': customerDetails.merchant_id };
                walletBalance = await queryBuilder.getWalletBalanceQuery(walletBalanceRequest);
            }

            if (walletBalance) {
                let unusedVoucherCount = 0;
                if (walletBalance?.status == 1) {
                    walletMainBalance = walletBalance.main_balance;
                    if (vchrCount == 'Y') {
                        let getUnRedeemedVoucherListRequest = { 'user_id': customerDetails.id, 'merchant_id': customerDetails.merchant_id, 'type': 'success' }
                        unusedVoucherCount = await queryBuilder.getUnRedeemedVoucherList(getUnRedeemedVoucherListRequest);
                        unusedVoucherCount = Object.keys(unusedVoucherCount).length;
                    }
                }
                let returnData = { balance: walletMainBalance.toString() };

                if (vchrCount == 'Y') {
                    returnData.voucher_count = unusedVoucherCount.toString();
                }
                if (voucherCategoryFlag == 'Y') {
                    returnData.hold_balance = walletBalance?.hold_balance.toString();
                }

                return res.send(await sendResponse(0, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, returnData));
            } else {
                return res.send(await sendResponse(8, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }
        } else {
            return res.send(await sendResponse(25));
        }
    } catch (error) {
        logs.wrapper_log('error', error.message);
        console.log(error);
        return res.send(await sendResponse(14));
    }
}

const getWalletTxnStatus = async (req, res) => {
    try {
        const request_key = req.headers['request-key'] ? req.headers['request-key'] : "";

        const { userid, password } = req.headers;
        let reqBodyData = req.body;

        let buyerRequest = {
            "userid": userid,
            "password": password,
            "type": ''
        };

        const user = await queryBuilder.getBuyerDetails(buyerRequest);

        if (!isEmpty(user)) {

            if (request_key !== '' && ((request_key === customConfig.CONTAINER_KEY.KEY && containerRedemptionType.includes(user.container_redemption_type)) || (request_key === customConfig.CONSUMER_KEY.KEY && user.consumer_merchant === 'Y'))) {
                user.is_ip_validation = 'No';
            }

            let client_ip = await element.getClientIP(req);
            let is_parameter_encryption = user.is_parameter_encryption.toLowerCase();

            if (user.is_ip_validation.toLowerCase() == 'yes') {
                client_ip = (client_ip) ? client_ip : "";
                let validateIpRequest = { 'buyer_id': user.id, 'ip_address': client_ip };
                let ip_matched = await queryBuilder.validateClientIp(req, validateIpRequest);

                if (!ip_matched) {
                    return res.send(await sendResponse(7, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'getWalletTxnStatus IP Validation [ ' + client_ip + ' ]'));
                }
            }

            if (is_parameter_encryption == "y") {
                reqBodyData = await element.parameterDecryption(reqBodyData.data, user.hash_secret_key, user.secret_iv);

                if (!reqBodyData) {
                    return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'getWalletTxnStatus parameterDecryption [ ' + client_ip + ' ]'));
                }
            }

            reqBodyData = element.obj_key_case_change(reqBodyData, 'CASE_LOWER');
            let logKey = 'Txnid [' + reqBodyData.porderid + client_ip + '] ' + ': getWalletTxnStatus ';

            logs.wrapper_log('info', logKey + JSON.stringify(reqBodyData));

            if (!reqBodyData.mid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (reqBodyData.mid && reqBodyData.mid != user.merchant_guid) {
                return res.send(await sendResponse(25, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }
            if (!reqBodyData.tid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.source || !apiSources.includes(reqBodyData.source)) {
                return res.send(await sendResponse(5, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.txnid && !reqBodyData.porderid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }
            let conditions = { merchant_guid: reqBodyData.mid };
            if (reqBodyData.txnid) {
                conditions.txn_guid = reqBodyData.txnid;
            }

            if (reqBodyData.porderid) {
                conditions.porder_id = reqBodyData.porderid;
            }

            let txnData = await queryBuilder.getWalletTxnData(conditions);

            let returnData = {};

            if (!isEmpty(txnData)) {
                returnData.txnstatus = txnData.status;
                returnData.txnid = txnData.txn_guid;
                returnData.txndate = (txnData.created) ? moment(txnData.created).unix() : null;
                returnData.porderid = (reqBodyData.porderid) ? reqBodyData.porderid : null;
                returnData.txntype = txnData.txn_type;

                return res.send(await sendResponse(0, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, returnData));
            } else {
                returnData.porderid = (reqBodyData.porderid) ? reqBodyData.porderid : null;
                return res.send(await sendResponse(13, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, returnData));
            }

        } else {
            return res.send(await sendResponse(25));
        }
    } catch (error) {
        logs.wrapper_log('error', error.message);
        console.log(error);
        return res.send(await sendResponse(14));
    }
}

const getCjTxnsStatus = async (req, res) => {
    try {
        const request_key = req.headers['request-key'] ? req.headers['request-key'] : "";

        const { userid, password } = req.headers;
        let reqBodyData = req.body;

        let buyerRequest = {
            "userid": userid,
            "password": password,
            "type": ''
        };

        const user = await queryBuilder.getBuyerDetails(buyerRequest);

        if (user) {

            if (request_key !== '' && ((request_key === customConfig.CONTAINER_KEY.KEY && containerRedemptionType.includes(user.container_redemption_type)) || ((request_key === customConfig.CONSUMER_KEY.KEY && user.consumer_merchant === 'Y')))) {
                user.is_ip_validation = 'No';
            }
            let client_ip = await element.getClientIP(req);
            let is_parameter_encryption = user.is_parameter_encryption.toLowerCase();

            if (user.is_ip_validation.toLowerCase() == 'yes') {
                client_ip = (client_ip) ? client_ip : "";
                let validateIpRequest = { 'buyer_id': user.id, 'ip_address': client_ip };
                let ip_matched = await queryBuilder.validateClientIp(req, validateIpRequest);

                if (!ip_matched) {
                    return res.send(await sendResponse(7, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'getCjTxnsStatus IP Validation [ ' + client_ip + ' ]'));
                }
            }

            if (is_parameter_encryption == "y") {
                reqBodyData = await element.parameterDecryption(reqBodyData.data, user.hash_secret_key, user.secret_iv);

                if (!reqBodyData) {
                    return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'getCjTxnsStatus parameterDecryption [ ' + client_ip + ' ]'));
                }
            }

            reqBodyData = element.obj_key_case_change(reqBodyData, 'CASE_LOWER');
            let logKey = 'MOBILE [' + client_ip + '] ' + ': getCjTxnsStatus ';

            logs.wrapper_log('info', logKey + JSON.stringify(reqBodyData));

            if (!reqBodyData.mid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (reqBodyData.mid && reqBodyData.mid != user.merchant_guid) {
                return res.send(await sendResponse(25, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }
            if (!reqBodyData.tid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.source || !apiSources.includes(reqBodyData.source)) {
                return res.send(await sendResponse(5, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.porderid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            let transactionId = reqBodyData.porderid;

            const pgMerchantData = await queryBuilder.getCjTxnStatus(transactionId);

            if (pgMerchantData) {

                const paymentDetails = await queryBuilder.getCjPaymentDetails(pgMerchantData.merchant_id, transactionId);

                let created = moment(pgMerchantData?.created).format('YYYY-MM-DD HH:mm:ss');

                // 2 Hour before time
                let currentTime = moment().subtract(2, 'hour').format('YYYY-MM-DD HH:mm:ss');

                if (pgMerchantData.status == 'TXN_INITIALISE' && !paymentDetails && created < currentTime) {
                    pgMerchantData.status == 'TXN_FAILED';
                }

                let mobile = element.piDecryption(pgMerchantData.mobile);

                var returnData = {
                    'status_code': '00',
                    'status': pgMerchantData.status,
                    'remark': pgMerchantData.walletRemark,
                    'mobile': mobile,
                    'mid': pgMerchantData.mid,
                    'tid': pgMerchantData.tid,
                    'txnAmount': pgMerchantData.bill_value.toString(),
                    'return_url': pgMerchantData.return_url,
                    'porderid': pgMerchantData.porderid,
                    'source': pgMerchantData.source,
                    'walletRedemptionTxnId': pgMerchantData.worderid,
                    'paymentDetails': paymentDetails
                };

                return res.send(await sendResponse(null, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, returnData));
            } else {
                return res.send(await sendResponse(13, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }
        } else {
            return res.send(await sendResponse(25));
        }
    } catch (error) {
        logs.wrapper_log('error', error.message);
        console.log(error);
        return res.send(await sendResponse(14));
    }
}

const updateBillingDetails = async (req, res) => {
    try {
        const request_key = req.headers['request-key'] ? req.headers['request-key'] : "";

        const { userid, password } = req.headers;
        let reqBodyData = req.body;

        let buyerRequest = {
            "userid": userid,
            "password": password,
            "type": ''
        };

        const user = await queryBuilder.getBuyerDetails(buyerRequest);

        if (!isEmpty(user)) {

            if (request_key !== '' && ((request_key === customConfig.CONTAINER_KEY.KEY && containerRedemptionType.includes(user.container_redemption_type)) || ((request_key === customConfig.CONSUMER_KEY.KEY && user.consumer_merchant === 'Y')))) {
                user.is_ip_validation = 'No';
            }

            let client_ip = await element.getClientIP(req);
            let is_parameter_encryption = user.is_parameter_encryption.toLowerCase();

            if (user.is_ip_validation.toLowerCase() == 'yes') {
                client_ip = (client_ip) ? client_ip : "";
                let validateIpRequest = { 'buyer_id': user.id, 'ip_address': client_ip };
                let ip_matched = await queryBuilder.validateClientIp(req, validateIpRequest);

                if (!ip_matched) {
                    return res.send(await sendResponse(7, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'updateBillingDetails IP Validation [ ' + client_ip + ' ]'));
                }
            }

            if (is_parameter_encryption == "y") {
                reqBodyData = await element.parameterDecryption(reqBodyData.data, user.hash_secret_key, user.secret_iv);

                if (!reqBodyData) {
                    return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'updateBillingDetails parameterDecryption [ ' + client_ip + ' ]'));
                }
            }

            reqBodyData = element.obj_key_case_change(reqBodyData, 'CASE_LOWER');
            let logKey = 'MOBILE [' + reqBodyData.mobile + client_ip + '] ' + ': updateBillingDetails ';

            logs.wrapper_log('info', logKey + JSON.stringify(reqBodyData));

            if (!reqBodyData.mobile) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (!element.isValidMobileNum(reqBodyData.mobile)) {
                return res.send(await sendResponse(5, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.mid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (reqBodyData.mid && reqBodyData.mid != user.merchant_guid) {
                return res.send(await sendResponse(25, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }
            if (!reqBodyData.tid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.source || !apiSources.includes(reqBodyData.source)) {
                return res.send(await sendResponse(5, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.drorderid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }
            if (!reqBodyData.drtxnid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }
            if (!reqBodyData.billno) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }
            if (!reqBodyData.billvalue) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            const encmobile = element.piEncryption(reqBodyData.mobile);

            let customerDetails = await queryBuilder.checkUserAgainstMerchantId({ 'merchant_id': user.merchant_id, 'mobile': encmobile });

            if (customerDetails == null) {
                return res.send(await sendResponse(25, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (customerDetails.status != 'A') {
                return res.send(await sendResponse(42, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            let updateBillingRequest = {
                'GIVEN_USER_ID': customerDetails.id,
                'GIVEN_TXN_GUID': reqBodyData.drtxnid,
                'GIVEN_MERCHANT_ID': customerDetails.merchant_id,
                'GIVEN_PORDER_ID': reqBodyData.drorderid,
                'GIVEN_BILL_NO': reqBodyData.billno,
                'GIVEN_BILL_VALUE': reqBodyData.billvalue
            };
            const updateTxnBillingData = await queryBuilder.updateWalletBillingInfo(updateBillingRequest);

            if (!isEmpty(updateTxnBillingData)) {

                if (updateTxnBillingData['msg'] == 'Success') {
                    var returnData = {
                        'mid': reqBodyData.mid,
                        'tid': reqBodyData.tid,
                        'mobile': reqBodyData.mobile,
                        'drorderid': reqBodyData.drorderid,
                        'drtxnid': reqBodyData.drtxnid,
                        'source': (reqBodyData.source) ? reqBodyData.source : null
                    };
                    return res.send(await sendResponse(0, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, returnData));
                } else {
                    return res.send(await sendResponse(13, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                }
            } else {
                return res.send(await sendResponse(8, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }
        } else {
            return res.send(await sendResponse(25));
        }
    } catch (error) {
        logs.wrapper_log('error', error.message);
        console.log(error);
        return res.send(await sendResponse(14));
    }
}

const voucherDetails = async (req, res) => {
    try {
        const request_key = req.headers['request-key'] ? req.headers['request-key'] : "";

        const { userid, password } = req.headers;
        let reqBodyData = req.body;

        let buyerRequest = {
            "userid": userid,
            "password": password,
            "type": 'otp'
        };

        const user = await queryBuilder.getBuyerDetails(buyerRequest);

        if (!isEmpty(user)) {

            if (request_key !== '' && ((request_key === customConfig.CONTAINER_KEY.KEY && containerRedemptionType.includes(user.container_redemption_type)) || ((request_key === customConfig.CONSUMER_KEY.KEY && user.consumer_merchant === 'Y')))) {
                user.is_ip_validation = 'No';
                user.is_otp_validation = 'N';
                user.api_name = JSON.stringify(["voucherDetails"]);
                user.api_source = JSON.stringify(apiSources);
            }
            if (user.cj_otp_scrn_flag === 'Y') {
                user.is_otp_validation = 'N';
            }

            let client_ip = await element.getClientIP(req);
            let is_parameter_encryption = user.is_parameter_encryption.toLowerCase();

            if (user.is_ip_validation.toLowerCase() == 'yes') {
                client_ip = (client_ip) ? client_ip : "";
                let validateIpRequest = { 'buyer_id': user.id, 'ip_address': client_ip };
                let ip_matched = await queryBuilder.validateClientIp(req, validateIpRequest);

                if (!ip_matched) {
                    return res.send(await sendResponse(7, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'voucherDetails IP Validation [ ' + client_ip + ' ]'));
                }
            }

            if (is_parameter_encryption == "y") {
                reqBodyData = await element.parameterDecryption(reqBodyData.data, user.hash_secret_key, user.secret_iv);

                if (!reqBodyData) {
                    return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'voucherDetails parameterDecryption [ ' + client_ip + ' ]'));
                }
            }

            reqBodyData = element.obj_key_case_change(reqBodyData, 'CASE_LOWER');
            let logKey = 'MOBILE [' + reqBodyData.mobile + client_ip + '] ' + ': voucherDetails ';

            logs.wrapper_log('info', logKey + JSON.stringify(reqBodyData));

            if (!reqBodyData.mobile) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (!element.isValidMobileNum(reqBodyData.mobile)) {
                return res.send(await sendResponse(5, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.mid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (reqBodyData.mid && reqBodyData.mid != user.merchant_guid) {
                return res.send(await sendResponse(25, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.source) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (!apiSources.includes(reqBodyData.source)) {
                return res.send(await sendResponse(5, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.vouchernumber) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.vouchertype) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (!['E', 'P'].includes((reqBodyData.vouchertype.trim()).toUpperCase())) {
                return res.send(await sendResponse(5, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if ((reqBodyData.vouchertype.trim()).toUpperCase() === 'E') {
                reqBodyData.vouchernumber = await MCrypt.decrypt(reqBodyData.vouchernumber);
            }

            if (user.is_otp_validation == 'N' && (!JSON.parse(user.api_name).includes('voucherDetails') || !JSON.parse(user.api_source).includes(reqBodyData.source))) {
                user.is_otp_validation = 'Y';
            }

            const encmobile = element.piEncryption(reqBodyData.mobile);

            let customerDetails = await queryBuilder.checkUserAgainstMerchantId({ 'merchant_id': user.merchant_id, 'mobile': encmobile });
            if (customerDetails == null) {
                return res.send(await sendResponse(25, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (customerDetails.status != 'A') {
                return res.send(await sendResponse(42, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (user.is_otp_validation == 'Y') {
                let validateOtpResult = await element.validateOTP(reqBodyData.otp, reqBodyData.mid, encmobile, user.merchant_id);
                if (validateOtpResult) {
                    if (typeof validateOtpResult == 'object') {
                        return res.send(await sendResponse(null, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, validateOtpResult));
                    } else {
                        return res.send(await sendResponse(validateOtpResult, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                    }
                }
            }

            let voucherDetails = await vouchagram.getVoucherDetailsInternal(reqBodyData.vouchernumber, encmobile, user.client_guid_merchant);

            if (voucherDetails && voucherDetails.statusCode == '0') {
                delete voucherDetails.statusCode;
                return res.send(await sendResponse(0, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, voucherDetails));
            } else {
                return res.send(await sendResponse(voucherDetails.statusCode, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }
        } else {
            return res.send(await sendResponse(3));
        }
    } catch (error) {
        logs.wrapper_log('error', error.message);
        console.log(error);
        return res.send(await sendResponse(14));
    }
}

const removeVoucher = async (req, res) => {
    try {
        const request_key = req.headers['request-key'] ? req.headers['request-key'] : "";

        const { userid, password } = req.headers;
        let reqBodyData = req.body;

        let buyerRequest = {
            "userid": userid,
            "password": password,
            "type": ''
        };

        const user = await queryBuilder.getBuyerDetails(buyerRequest);

        if (user) {

            if (request_key !== '' && ((request_key === customConfig.CONTAINER_KEY.KEY && containerRedemptionType.includes(user.container_redemption_type)) || (request_key === customConfig.CONSUMER_KEY.KEY && user.consumer_merchant === 'Y'))) {
                user.is_ip_validation = 'No';
            }

            let client_ip = await element.getClientIP(req);
            let is_parameter_encryption = user.is_parameter_encryption.toLowerCase();

            if (user.is_ip_validation.toLowerCase() == 'yes') {
                client_ip = (client_ip) ? client_ip : "";
                let validateIpRequest = { 'buyer_id': user.id, 'ip_address': client_ip };
                let ip_matched = await queryBuilder.validateClientIp(req, validateIpRequest);

                if (!ip_matched) {
                    return res.send(await sendResponse(7, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'removeVoucher IP Validation [ ' + client_ip + ' ]'));
                }
            }

            if (is_parameter_encryption == "y") {
                reqBodyData = await element.parameterDecryption(reqBodyData.data, user.hash_secret_key, user.secret_iv);

                if (!reqBodyData) {
                    return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'removeVoucher parameterDecryption [ ' + client_ip + ' ]'));
                }
            }

            reqBodyData = element.obj_key_case_change(reqBodyData, 'CASE_LOWER');
            let logKey = 'MOBILE [' + reqBodyData.mobile + client_ip + '] ' + ': removeVoucher ';

            logs.wrapper_log('info', logKey + JSON.stringify(reqBodyData));

            if (!reqBodyData.mobile) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (!element.isValidMobileNum(reqBodyData.mobile)) {
                return res.send(await sendResponse(5, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.mid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (reqBodyData.mid && reqBodyData.mid != user.merchant_guid) {
                return res.send(await sendResponse(25, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.tid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.source) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (!apiSources.includes(reqBodyData.source)) {
                return res.send(await sendResponse(5, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.vouchernumber) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.vouchertype) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (!['E', 'P'].includes((reqBodyData.vouchertype.trim()).toUpperCase())) {
                return res.send(await sendResponse(5, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if ((reqBodyData.vouchertype.trim()).toUpperCase() === 'E') {
                reqBodyData.vouchernumber = await MCrypt.decrypt(reqBodyData.vouchernumber);
            }

            const encmobile = element.piEncryption(reqBodyData.mobile);

            let customerDetails = await queryBuilder.checkUserAgainstMerchantId({ 'merchant_id': user.merchant_id, 'mobile': encmobile });
            if (customerDetails == null) {
                return res.send(await sendResponse(25, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (customerDetails.status != 'A') {
                return res.send(await sendResponse(42, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            let timeToCheck = moment().subtract(1800, 'seconds').format('YYYY-MM-DD HH:mm:ss'); // date is half an hour before

            if (user.is_otp_validation == 'Y') {
                let validateOtpResult = await element.checkUserOtpVerified(reqBodyData.mid, encmobile, timeToCheck);
                if (!validateOtpResult) {
                    return res.send(await sendResponse("40", is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                }
            }

            let vchr_add_remove_flag = user.vchr_add_remove_flag;
            if (vchr_add_remove_flag == 'N') {
                return res.send(await sendResponse("42", is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }
            let txnFromVoucherRequest = {
                'status': 'Success',
                'merchant_id': user.merchant_id,
                'voucherNo': reqBodyData.vouchernumber
            };

            let voucherDetails = await queryBuilder.getWalletTxnFromVoucherNo(txnFromVoucherRequest);

            if (voucherDetails) {
                let addOrRemoveRequest = {
                    'GIVEN_MERCHANT_ID': user.merchant_id,
                    'GIVEN_VOUCHER_NUMBER': reqBodyData.vouchernumber,
                    'GIVEN_TYPE': 'remove',
                    'GIVEN_PORDER_ID': '',
                    'GIVEN_USER_ID': customerDetails.id
                };

                let addRemoveDone = await queryBuilder.addORRemoveVoucherFromWallet(addOrRemoveRequest);

                if (addRemoveDone && addRemoveDone.status == 'remove') {
                    let wallet_main_balance = 0;
                    let walletBalanceRequest = { 'user_id': customerDetails.id, 'merchant_id': user.merchant_id };
                    let wallet_balance = await queryBuilder.getWalletBalanceQuery(walletBalanceRequest);

                    if (wallet_balance) {
                        if (wallet_balance.status == 1) {
                            wallet_main_balance = wallet_balance.main_balance;
                        }
                    }

                    let balanceAfterAddRemove = await queryBuilder.getBalanceAfterAddRemoveVouchers({ 'VOUCHER_NUMBER': reqBodyData.vouchernumber });

                    let maskedVouchernumber = await element.ccMasking(reqBodyData.vouchernumber, 'X');
                    let addedRemovedAmount = (balanceAfterAddRemove?.addedRemovedAmount) ? balanceAfterAddRemove?.addedRemovedAmount : 0;
                    let voucherResults = { 'balance': wallet_main_balance, 'amount': addedRemovedAmount, 'vouchernumber': maskedVouchernumber }

                    return res.send(await sendResponse(0, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, voucherResults));
                } else {
                    return res.send(await sendResponse(17, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                }
            } else {
                return res.send(await sendResponse(32, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }
        } else {
            return res.send(await sendResponse(3));
        }
    } catch (error) {
        logs.wrapper_log('error', error.message);
        console.log(error);
        return res.send(await sendResponse(14));
    }
}

const loadWallet = async (req, res) => {
    try {
        const request_key = req.headers['request-key'] ? req.headers['request-key'] : "";

        const { userid, password } = req.headers;
        let reqBodyData = req.body;

        let buyerRequest = {
            "userid": userid,
            "password": password,
            "type": 'otp'
        };

        const user = await queryBuilder.getBuyerDetails(buyerRequest);

        if (user) {

            if (request_key !== '' && request_key === customConfig.CONTAINER_KEY.KEY && containerRedemptionType.includes(user.container_redemption_type)) {
                user.is_ip_validation = 'No';
                user.is_otp_validation = 'N';
                user.api_source = JSON.stringify(apiSources);
                if (user.cj_otp_scrn_flag === 'Y') {
                    user.api_name = JSON.stringify(['loadWallet', 'walletRedemption']);
                } else {
                    user.api_name = JSON.stringify(['walletRedemption']);
                }
            }
            if (request_key !== '' && request_key === customConfig.CONSUMER_KEY.KEY && user.consumer_merchant === 'Y') {
                user.is_ip_validation = 'No';
                user.is_otp_validation = 'N';
                user.api_name = JSON.stringify(['loadWallet']);
                user.api_source = JSON.stringify(apiSources);
            }

            let client_ip = await element.getClientIP(req);
            let is_parameter_encryption = user.is_parameter_encryption.toLowerCase();

            if (user.is_ip_validation.toLowerCase() == 'yes') {
                client_ip = (client_ip) ? client_ip : "";
                let validateIpRequest = { 'buyer_id': user.id, 'ip_address': client_ip };
                let ip_matched = await queryBuilder.validateClientIp(req, validateIpRequest);

                if (!ip_matched) {
                    return res.send(await sendResponse(7, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'loadWallet IP Validation [ ' + client_ip + ' ]'));
                }
            }

            if (is_parameter_encryption == "y") {
                reqBodyData = await element.parameterDecryption(reqBodyData.data, user.hash_secret_key, user.secret_iv);

                if (!reqBodyData) {
                    return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'loadWallet parameterDecryption [ ' + client_ip + ' ]'));
                }
            }

            reqBodyData = element.obj_key_case_change(reqBodyData, 'CASE_LOWER');
            let logKey = 'MOBILE [' + reqBodyData.mobile + client_ip + '] ' + ': loadWallet ';

            logs.wrapper_log('info', logKey + JSON.stringify(reqBodyData));

            if (!reqBodyData.mobile) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (!element.isValidMobileNum(reqBodyData.mobile)) {
                return res.send(await sendResponse(5, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.mid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (reqBodyData.mid && reqBodyData.mid != user.merchant_guid) {
                return res.send(await sendResponse(25, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.tid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.source) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (!apiSources.includes(reqBodyData.source)) {
                return res.send(await sendResponse(5, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            const encmobile = element.piEncryption(reqBodyData.mobile);

            let customerDetails = await queryBuilder.checkUserAgainstMerchantId({ 'merchant_id': user.merchant_id, 'mobile': encmobile });

            if (customerDetails == null && user.external_wallet_topup == "1") {
                let createUserRequest = { 'merchant_id': user.merchant_id, 'tid': reqBodyData.tid, 'mobile': encmobile, 'user_type': 1, 'created_by': 1, 'updated_by': 1, 'status': 'A' }

                customerDetails = await queryBuilder.createUserAgainstMerchant(createUserRequest);
                if (!customerDetails) {
                    return res.send(await sendResponse(8, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                }
                customerDetails.status = 'A';
                customerDetails.id = customerDetails.insertId;

            } else if (customerDetails == null && user.external_wallet_topup == "0") {
                return res.send(await sendResponse(25, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (customerDetails.status != 'A') {
                return res.send(await sendResponse(42, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (user.is_otp_validation == 'N' && (!JSON.parse(user.api_name).includes('loadWallet') || !JSON.parse(user.api_source).includes(reqBodyData.source))) {
                user.is_otp_validation = 'Y';
            }

            if (user.is_otp_validation == 'Y') {
                let validateOtpResult = await element.validateOTP(reqBodyData.otp, reqBodyData.mid, encmobile);
                if (validateOtpResult) {
                    if (typeof validateOtpResult == 'object') {
                        return res.send(await sendResponse(null, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, validateOtpResult));
                    } else {
                        return res.send(await sendResponse(validateOtpResult, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                    }
                }
            }

            let vchr_add_remove_flag = user.vchr_add_remove_flag;
            let send_valid_voucher_in_list_api_flag = user.send_valid_voucher_in_list_api_flag;
            let is_masked = user.is_masked_or_plain_voucher_in_list_api_flag;

            let loadWalletResponseData = {
                'mobile': reqBodyData.mobile,
                'mid': reqBodyData.mid,
                'tid': reqBodyData.tid
            };
            let custom_vchr_details = {};
            if (vchr_add_remove_flag == 'Y' && send_valid_voucher_in_list_api_flag == 'N') {
                custom_vchr_details = await element.getAppliedAndHoldVouchersList(customerDetails.id, user.merchant_id, is_masked);
            } else {
                custom_vchr_details = await vouchagram.getDCMSWithAppliedAndHoldVouchersList(customerDetails.id, user.merchant_id, reqBodyData.mobile, is_masked, vchr_add_remove_flag, user.client_guid_merchant);
            }

            if (custom_vchr_details.length > 0) {
                loadWalletResponseData.voucherdata = custom_vchr_details;
                return res.send(await sendResponse(0, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, loadWalletResponseData));
            } else {
                loadWalletResponseData.voucherdata = [];
                return res.send(await sendResponse(32, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, loadWalletResponseData));
            }
        } else {
            return res.send(await sendResponse(25));
        }
    } catch (error) {
        logs.wrapper_log('error', error.message);
        console.log(error);
        return res.send(await sendResponse(14));
    }
}

const rechargeWallet = async (req, res) => {
    try {
        const request_key = req.headers['request-key'] ? req.headers['request-key'] : "";

        const { userid, password } = req.headers;
        let reqBodyData = req.body;
        const apiStartTime = moment().unix();
        let buyerRequest = {
            "userid": userid,
            "password": password,
            "type": 'slug'
        };

        const user = await queryBuilder.getBuyerDetails(buyerRequest);

        if (user) {
            let slug = '';
            if (user.slug != "") {
                slug = user.slug;
            }
            if (request_key !== '' && request_key === customConfig.CONTAINER_KEY.KEY && containerRedemptionType.includes(user.container_redemption_type)) {
                user.is_ip_validation = 'No';
                user.time_out_in_sec = 0;
            }
            if (request_key !== '' && request_key === customConfig.CONSUMER_KEY.KEY && user.consumer_merchant === 'Y') {
                user.is_ip_validation = 'No';
                user.is_otp_validation = 'N';
                user.time_out_in_sec = 0;
            }

            if (user.cj_otp_scrn_flag === 'Y') {
                user.is_otp_validation = 'N';
            }
            let is_recharge_api_otp_based = 'N';
            if (user.is_recharge_api_otp_based == 'Y') {
                is_recharge_api_otp_based = 'Y';
            }

            let client_ip = await element.getClientIP(req);
            let is_parameter_encryption = user.is_parameter_encryption.toLowerCase();

            if (user.is_ip_validation.toLowerCase() == 'yes') {
                client_ip = (client_ip) ? client_ip : "";
                let validateIpRequest = { 'buyer_id': user.id, 'ip_address': client_ip };
                let ip_matched = await queryBuilder.validateClientIp(req, validateIpRequest);

                if (!ip_matched) {
                    return res.send(await sendResponse(7, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'rechargeWallet IP Validation [ ' + client_ip + ' ]'));
                }
            }

            if (is_parameter_encryption == "y") {
                reqBodyData = await element.parameterDecryption(reqBodyData.data, user.hash_secret_key, user.secret_iv);

                if (!reqBodyData) {
                    return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'rechargeWallet parameterDecryption [ ' + client_ip + ' ]'));
                }
            }

            reqBodyData = element.obj_key_case_change(reqBodyData, 'CASE_LOWER');
            let logKey = 'MOBILE [' + reqBodyData.mobile + client_ip + '] ' + ': rechargeWallet ';

            logs.wrapper_log('info', logKey + JSON.stringify(reqBodyData));

            if (!reqBodyData.mobile) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (!element.isValidMobileNum(reqBodyData.mobile)) {
                return res.send(await sendResponse(5, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.mid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (reqBodyData.mid && reqBodyData.mid != user.merchant_guid) {
                return res.send(await sendResponse(25, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.tid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.source) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (!apiSources.includes(reqBodyData.source)) {
                return res.send(await sendResponse(5, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.porderid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.vouchernumber) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.vouchertype) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (!['E', 'P', 'U', 'UE'].includes((reqBodyData.vouchertype.trim()).toUpperCase())) {
                return res.send(await sendResponse(5, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            reqBodyData.vouchertype = (reqBodyData.vouchertype.trim()).toUpperCase();

            if (reqBodyData.vouchertype === 'E' || reqBodyData.vouchertype === 'UE') {
                reqBodyData.vouchernumber = await MCrypt.decrypt(reqBodyData.vouchernumber);
            }

            const encmobile = element.piEncryption(reqBodyData.mobile);

            let customerDetails = await queryBuilder.checkUserAgainstMerchantId({ 'merchant_id': user.merchant_id, 'mobile': encmobile });

            if (customerDetails == null && user.external_wallet_topup == "1") {
                let createUserRequest = { 'merchant_id': user.merchant_id, 'tid': reqBodyData.tid, 'mobile': encmobile, 'user_type': 1, 'created_by': 1, 'updated_by': 1, 'status': 'A' }

                customerDetails = await queryBuilder.createUserAgainstMerchant(createUserRequest);
                if (!customerDetails) {
                    return res.send(await sendResponse(8, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                }
                customerDetails.status = 'A';
                customerDetails.id = customerDetails.insertId;
                customerDetails.merchant_id = user.merchant_id;
                customerDetails.custom_voucher_attempts = 0;
                customerDetails.custom_voucher_blocked_date = null;

            } else if (customerDetails == null && user.external_wallet_topup == "0") {
                return res.send(await sendResponse(25, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (customerDetails.status != 'A') {
                return res.send(await sendResponse(42, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            let per_user_recharge_flag = user.per_user_recharge_flag;
            let per_user_invalid_gv_flag = user.per_user_invalid_gv_flag;
            if (per_user_invalid_gv_flag == 'Y' && reqBodyData.vouchertype == 'P') {
                let per_user_invalid_gv_limit = user.per_user_invalid_gv_limit;
                let per_user_invalid_gv_min = user.per_user_invalid_gv_min;
                let custom_voucher_attempts = customerDetails.custom_voucher_attempts;
                let custom_voucher_blocked_date = customerDetails.custom_voucher_blocked_date;

                let timeDiffInSec = per_user_invalid_gv_min * 60;

                if (custom_voucher_blocked_date && custom_voucher_attempts >= per_user_invalid_gv_limit) {
                    let differenceInSec = moment().unix() - moment(custom_voucher_blocked_date).unix();

                    if (differenceInSec <= timeDiffInSec) {
                        let dynamicMsg = { '{dynamic_min}': per_user_invalid_gv_min };
                        return res.send(await sendResponse(54, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, null, dynamicMsg));
                    }
                }
            }

            if (is_recharge_api_otp_based == 'Y' && reqBodyData.vouchertype != 'U' && reqBodyData.vouchertype != 'UE') {
                let validateOtpResult = await element.validateOTP(reqBodyData.otp, reqBodyData.mid, encmobile);
                if (validateOtpResult) {
                    if (typeof validateOtpResult == 'object') {
                        return res.send(await sendResponse(null, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, validateOtpResult));
                    } else {
                        return res.send(await sendResponse(validateOtpResult, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                    }
                }
            }

            if (user.is_otp_validation == 'Y') {
                let timeToCheck = moment().subtract(1800, 'seconds').format('YYYY-MM-DD HH:mm:ss'); // date is half an hour before
                let checkUserOtpVerified = await element.checkUserOtpVerified(reqBodyData.mid, encmobile, timeToCheck);
                if (!checkUserOtpVerified) {
                    return res.send(await sendResponse("40", is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                }
            }

            let vchr_add_remove_flag = (user.vchr_add_remove_flag) ? user.vchr_add_remove_flag : '';
            let max_voucher_use_limit = (user.max_voucher_use_limit) ? user.max_voucher_use_limit : 0;

            if (vchr_add_remove_flag == 'N' && (reqBodyData.vouchertype == 'U' || reqBodyData.vouchertype == 'UE')) {
                return res.send(await sendResponse("42", is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (vchr_add_remove_flag == 'Y' && max_voucher_use_limit > 0) {
                let getUnRedeemedVoucherListRequest = { 'user_id': customerDetails.id, 'merchant_id': customerDetails.merchant_id, 'type': 'success' }
                let used_voucher_count = await queryBuilder.getUnRedeemedVoucherList(getUnRedeemedVoucherListRequest);

                used_voucher_count = Object.keys(used_voucher_count).length;

                if (used_voucher_count >= max_voucher_use_limit) {
                    return res.send(await sendResponse("41", is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                }
            }
            if (vchr_add_remove_flag == 'Y' && (reqBodyData.vouchertype === 'U' || reqBodyData.vouchertype === 'UE')) {
                let txnFromVoucherRequest = {
                    'status': 'Hold',
                    'merchant_id': user.merchant_id,
                    'voucherNo': reqBodyData.vouchernumber
                };

                let voucherDetails = await queryBuilder.getWalletTxnFromVoucherNo(txnFromVoucherRequest);

                if (!isEmpty(voucherDetails)) {
                    let addOrRemoveRequest = {
                        'GIVEN_MERCHANT_ID': user.merchant_id,
                        'GIVEN_VOUCHER_NUMBER': reqBodyData.vouchernumber,
                        'GIVEN_TYPE': 'add',
                        'GIVEN_PORDER_ID': reqBodyData.porderid,
                        'GIVEN_USER_ID': customerDetails.id
                    };

                    let addRemoveDone = await queryBuilder.addORRemoveVoucherFromWallet(addOrRemoveRequest);

                    if (!isEmpty(addRemoveDone) && addRemoveDone.status == 'add') {
                        let wallet_main_balance = 0;
                        let walletBalanceRequest = { 'user_id': customerDetails.id, 'merchant_id': user.merchant_id };
                        let wallet_balance = await queryBuilder.getWalletBalanceQuery(walletBalanceRequest);

                        if (wallet_balance) {
                            if (wallet_balance.status == 1) {
                                wallet_main_balance = wallet_balance.main_balance;
                            }
                        }

                        let balanceAfterAddRemove = await queryBuilder.getBalanceAfterAddRemoveVouchers({ 'VOUCHER_NUMBER': reqBodyData.vouchernumber });
                        let addedRemovedAmount = (balanceAfterAddRemove?.addedRemovedAmount) ? balanceAfterAddRemove?.addedRemovedAmount : 0;
                        let voucherResults = {
                            'mobile': reqBodyData.mobile,
                            'mid': reqBodyData.mid,
                            'tid': reqBodyData.tid,
                            'porderid': reqBodyData.porderid,
                            'vouchertype': reqBodyData.vouchertype,
                            'txnid': voucherDetails.txn_guid,
                            'balance': wallet_main_balance,
                            'amount': addedRemovedAmount,
                            'txndate': moment().unix()
                        };

                        return res.send(await sendResponse(0, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, voucherResults));
                    } else {
                        return res.send(await sendResponse(17, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                    }
                } else {
                    return res.send(await sendResponse(32, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                }
            }

            let returnVoucherDetailData = await vouchagramComponent.voucherDetailSearchWithMerchant(reqBodyData.vouchernumber, user.client_guid_merchant);

            logs.wrapper_log('info', ' ' + reqBodyData.mobile + '[rechargeWallet] voucherDetailSearchWithMerchant RESPONSE ' + JSON.stringify(returnVoucherDetailData));
            let VoucherId, vStatus, VoucherGuid, voucherAmountDCMS, validTillDate, VoucherCategory;
            if ((returnVoucherDetailData?.ResultType) && returnVoucherDetailData?.ResultType.toLowerCase() == 'success') {
                let voucher_expiry = returnVoucherDetailData.response_data?.VoucherDetail[0]['EXPIRY DATE'].toString();
                validTillDate = (voucher_expiry) ? moment(new Date(voucher_expiry)).format('YYYY-MM-DD HH:mm:ss') : '';
                VoucherId = returnVoucherDetailData.response_data?.VoucherDetail[0].VOUCHERID;
                VoucherGuid = returnVoucherDetailData.response_data?.VoucherDetail[0].VOUCHERGUID;
                VoucherCategory = returnVoucherDetailData.response_data?.VoucherDetail[0].CATEGORY;;
                voucherAmountDCMS = (returnVoucherDetailData.response_data?.VoucherDetail[0].FACEVALUE) ? returnVoucherDetailData.response_data?.VoucherDetail[0].FACEVALUE : 0;

                switch (returnVoucherDetailData.response_data.VoucherDetail[0].STATUS.toLowerCase()) {
                    case 'valid':
                        vStatus = "valid";
                        break;
                    case 'consumed':
                        vStatus = "consumed";
                        break;
                    case 'expired':
                        vStatus = "expired";
                        break;
                    default:
                        vStatus = "invalid";
                        break;
                }
            } else {
                if (per_user_invalid_gv_flag == 'Y' && reqBodyData.vouchertype == 'P') {
                    element.updateInvalidRechargeAttempts(customerDetails.id, custom_voucher_attempts, 'add');
                }
                return res.send(await sendResponse("30", is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }
            let responseRechargeVoucher;
            if (vStatus == "expired") {
                return res.send(await sendResponse("28", is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (vStatus == "invalid") {
                if (per_user_invalid_gv_flag == 'Y' && reqBodyData.vouchertype == 'P') {
                    element.updateInvalidRechargeAttempts(customerDetails.id, custom_voucher_attempts, 'add');
                }
                return res.send(await sendResponse("30", is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (vStatus == "consumed") {
                responseRechargeVoucher = await element.rechargeAlreadyConsumedVoucher(VoucherId, reqBodyData.vouchernumber, customerDetails.id, customerDetails.merchant_id, reqBodyData, user, VoucherGuid, vouchagramComponent);
            } else if (vStatus == "valid") {

                if (per_user_recharge_flag == 'Y') {
                    let per_user_recharge_limit = user.per_user_recharge_limit;
                    let per_user_recharge_days_limit = user.per_user_recharge_days_limit;

                    const availableLimit = await element.getRechargeAvailableLimit(customerDetails.id, customerDetails.merchant_id, per_user_recharge_limit, per_user_recharge_days_limit);
                    if (availableLimit < voucherAmountDCMS) {
                        return res.send(await sendResponse("55", is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                    }
                }
                responseRechargeVoucher = await element.rechargeValidVouchers(reqBodyData.vouchernumber, VoucherId, validTillDate, customerDetails.id, customerDetails.merchant_id, vchr_add_remove_flag, VoucherGuid, VoucherCategory, user, reqBodyData, vouchagramComponent);
            }

            if ((reqBodyData.vouchertype === 'U' || reqBodyData.vouchertype === 'UE')) {
                user.time_out_in_sec = 0;
            }

            let finalResponseTime = moment().unix() - apiStartTime;
            logs.wrapper_log('info', ' ' + reqBodyData.mobile + '[rechargeWallet] RESPONSE ' + JSON.stringify(responseRechargeVoucher));

            if ((user.time_out_in_sec > 0 && finalResponseTime < user.time_out_in_sec) || user.time_out_in_sec == 0) {
                if (responseRechargeVoucher.Code == '00') {
                    let mobile = reqBodyData.mobile;
                    let validity = moment(validTillDate).format('MMM DD, YYYY');
                    const message = "Credit Alert!\n\nINR " + responseRechargeVoucher.amount + " added to your " + user.brand_name + "-PAY Account " + mobile + " \n\nUpdated Balance: INR " + responseRechargeVoucher.balance + "\nValidity: " + validity + "\n\nTo MANAGE your account or any HELP visit " + EPAY_URL + slug + "\n" + user.brand_name + "-PAY Powered by GyFTR";
                    smsComponent.sendSMS(mobile, message, encmobile, 'walletRecharge');

                    responseRechargeVoucher.Code = 0;
                }

                if (per_user_invalid_gv_flag == 'Y' && reqBodyData.vouchertype == 'P') {
                    element.updateInvalidRechargeAttempts(customerDetails.id, 0, 'remove');
                }

                return res.send(await sendResponse(responseRechargeVoucher.Code, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, responseRechargeVoucher));

            } else {
                if (responseRechargeVoucher.Code == '00') {
                    let porderid = reqBodyData.porderid;
                    await element.dLinkVouchar(reqBodyData.vouchernumber, VoucherId, customerDetails.id, customerDetails.merchant_id, responseRechargeVoucher.txnid, porderid, user, vouchagramComponent);
                }
                return res.send(await sendResponse("10", is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }
        } else {
            return res.send(await sendResponse(25));
        }
    } catch (error) {
        logs.wrapper_log('error', error.message);
        console.log(error);
        return res.send(await sendResponse(14));
    }
}

const walletRedemption = async (req, res) => {
    try {
        const request_key = req.headers['request-key'] ? req.headers['request-key'] : "";

        const { userid, password } = req.headers;
        let reqBodyData = req.body;
        const apiStartTime = moment().unix();
        let debitSMS = false;

        let buyerRequest = {
            "userid": userid,
            "password": password,
            "type": 'slugandotp'
        };

        const user = await queryBuilder.getBuyerDetails(buyerRequest);

        if (user) {
            let slug = '';
            if (user.slug != "") {
                slug = user.slug;
            }
            if (request_key !== '' && ((request_key === customConfig.CONTAINER_KEY.KEY && containerRedemptionType.includes(user.container_redemption_type)) || (request_key === customConfig.CONSUMER_KEY.KEY && user.consumer_merchant === 'Y'))) {
                user.is_ip_validation = 'No';
                user.is_otp_validation = 'N';
                user.api_source = JSON.stringify(apiSources);
                user.api_name = JSON.stringify(['walletRedemption']);
                user.time_out_in_sec = 0;
            }

            let client_ip = await element.getClientIP(req);
            let is_parameter_encryption = user.is_parameter_encryption.toLowerCase();

            if (user.is_ip_validation.toLowerCase() == 'yes') {
                client_ip = (client_ip) ? client_ip : "";
                let validateIpRequest = { 'buyer_id': user.id, 'ip_address': client_ip };
                let ip_matched = await queryBuilder.validateClientIp(req, validateIpRequest);

                if (!ip_matched) {
                    return res.send(await sendResponse(7, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'walletRedemption IP Validation [ ' + client_ip + ' ]'));
                }
            }

            if (is_parameter_encryption == "y") {
                reqBodyData = await element.parameterDecryption(reqBodyData.data, user.hash_secret_key, user.secret_iv);

                if (!reqBodyData) {
                    return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'walletRedemption parameterDecryption [ ' + client_ip + ' ]'));
                }
            }

            reqBodyData = element.obj_key_case_change(reqBodyData, 'CASE_LOWER');
            let logKey = 'MOBILE [' + reqBodyData.mobile + client_ip + '] ' + ': walletRedemption ';

            logs.wrapper_log('info', logKey + JSON.stringify(reqBodyData));

            if (!reqBodyData.mobile) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (!element.isValidMobileNum(reqBodyData.mobile)) {
                return res.send(await sendResponse(5, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.mid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (reqBodyData.mid && reqBodyData.mid != user.merchant_guid) {
                return res.send(await sendResponse(25, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.tid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.source) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (!apiSources.includes(reqBodyData.source)) {
                return res.send(await sendResponse(5, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.porderid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.amount) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (!isNumeric(reqBodyData.amount)) {
                return res.send(await sendResponse(25, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (user.is_otp_validation == 'N' && (!JSON.parse(user.api_name).includes('walletRedemption') || !JSON.parse(user.api_source).includes(reqBodyData.source))) {
                user.is_otp_validation = 'Y';
            }

            let voucherCategory = '';
            let vchr_add_remove_flag = user.vchr_add_remove_flag;
            let voucher_category_flag = user.voucher_category_flag;
            if (vchr_add_remove_flag == 'Y' && voucher_category_flag == 'Y') {
                if (!reqBodyData.category) {
                    return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                }

                voucherCategory = str_replace(',', '|', reqBodyData.category);
                logs.wrapper_log('info', logKey + ': Categeory ' + voucherCategory);
            }

            const encmobile = element.piEncryption(reqBodyData.mobile);

            let customerDetails = await queryBuilder.checkUserAgainstMerchantId({ 'merchant_id': user.merchant_id, 'mobile': encmobile });

            if (customerDetails == null) {
                return res.send(await sendResponse(25, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (customerDetails.status != 'A') {
                return res.send(await sendResponse(42, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (user.is_otp_validation == 'Y') {
                let validateOtpResult = await element.validateOTP(reqBodyData.otp, reqBodyData.mid, encmobile);
                if (!isEmpty(validateOtpResult)) {
                    if (typeof validateOtpResult == 'object') {
                        return res.send(await sendResponse(null, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, validateOtpResult));
                    } else {
                        return res.send(await sendResponse(validateOtpResult, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                    }
                }
            }

            // Get a substring of the shuffled mobile number
            let shuffledMobile = reqBodyData.mobile.split('').sort(function () { return 0.5 - Math.random() }).join('');
            let randomStringPart = shuffledMobile.substring(5, 10);

            // Generate txn_guid
            let txnGuid = 'MRO' + ('000' + Math.floor(Math.random() * 1000)).slice(-3) + randomStringPart + user.merchant_id + '-D';

            let wallet_main_balance = 0;
            let walletBalanceRequest = { 'user_id': customerDetails.id, 'merchant_id': user.merchant_id };
            let wallet_balance = await queryBuilder.getWalletBalanceQuery(walletBalanceRequest);

            if (wallet_balance) {
                if (wallet_balance.status == 1) {
                    wallet_main_balance = wallet_balance.main_balance;
                }
            }
            let validMaxDate, currency, wallet_remains, responseData;
            if (wallet_main_balance >= reqBodyData.amount) {
                let wallet_data;
                let walletRedemptionRequest = {
                    'given_user_id': customerDetails.id,
                    'given_merchant_id': customerDetails.merchant_id,
                    'given_tid': reqBodyData.tid,
                    'given_amount': reqBodyData.amount,
                    'given_porder_id': reqBodyData.porderid,
                    'given_source': reqBodyData.source,
                    'given_txn_guid': txnGuid,
                    'given_bill_no': reqBodyData.billno,
                    'given_bill_value': reqBodyData.billvalue
                }
                if (vchr_add_remove_flag == 'Y' && voucher_category_flag == 'Y' && !isEmpty(voucherCategory)) {
                    walletRedemptionRequest.voucher_category = voucherCategory;
                    wallet_data = await queryBuilder.walletRedemption(walletRedemptionRequest, voucherCategory);
                } else {
                    wallet_data = await queryBuilder.walletRedemption(walletRedemptionRequest);
                }

                responseData = {
                    'mobile': reqBodyData.mobile,
                    'mid': reqBodyData.mid,
                    'tid': reqBodyData.tid,
                    'porderid': reqBodyData.porderid,
                    'amount': reqBodyData.amount,
                    'billno': reqBodyData.billno,
                    'billvalue': reqBodyData.billvalue
                };

                if (!isEmpty(wallet_data) && wallet_data.error == undefined) {

                    responseData.txnid = wallet_data.order_guid;
                    responseData.txndate = moment(wallet_data.created_date).unix();

                    validMaxDate = wallet_data.validMaxDate;
                    wallet_remains = wallet_main_balance - responseData.amount;
                    wallet_remains = (wallet_remains > 0) ? wallet_remains : "NA";
                    currency = (wallet_remains > 0) ? "INR" : "";
                    if (user.customer_communication == 'Y') {
                        debitSMS = true;
                    }
                } else if (wallet_data.error == 'duplicate') {
                    return res.send(await sendResponse(11, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, responseData));
                } else if (wallet_data.error == 'insufficientbal') {
                    return res.send(await sendResponse(37, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                } else {
                    return res.send(await sendResponse(8, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, responseData));
                }
            } else {
                return res.send(await sendResponse(37, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            let finalResponseTime = moment().unix() - apiStartTime;

            if ((user.time_out_in_sec > 0 && finalResponseTime < user.time_out_in_sec) || user.time_out_in_sec == 0) {
                if (debitSMS) {
                    let mobile = reqBodyData.mobile;
                    let validity = moment(validMaxDate).format('MMM DD, YYYY');
                    const message = "Debit Alert!\n\nThank you for using " + user.brand_name + "-PAY. INR " + responseData.amount + " has been debited.\n\nUpdated Balance: " + currency + " " + wallet_remains + "\n\nValidity: " + validity + "\nTo MANAGE your account or any HELP/DISPUTE visit " + EPAY_URL + slug + " or call 1800-1033-314\n" + user.brand_name + "-PAY Powered by GyFTR";

                    smsComponent.sendSMS(mobile, message, encmobile, 'walletRedemption');
                }
                return res.send(await sendResponse(0, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, responseData));

            } else {
                if (responseData.txnid !== undefined) {
                    let porderid = reqBodyData.porderid;
                    let desc = "Time Out VOID";

                    let voidRequest = {
                        'GIVEN_USER_ID': customerDetails.id,
                        'GIVEN_MERCHANT_ID': customerDetails.merchant_id,
                        'GIVEN_TXN_GUID': txnGuid,
                        'GIVEN_PORDER_ID': porderid,
                        'GIVEN_DESC': desc,
                        'GIVEN_TIMEOUT': 1
                    };

                    await queryBuilder.walletDebitTransactionVoid(voidRequest);
                }
                return res.send(await sendResponse("10", is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }
        } else {
            return res.send(await sendResponse(3));
        }
    } catch (error) {
        logs.wrapper_log('error', error.message);
        console.log(error);
        return res.send(await sendResponse(14));
    }
}

const walletReversal = async (req, res) => {
    try {
        const request_key = req.headers['request-key'] ? req.headers['request-key'] : "";

        const { userid, password } = req.headers;
        let reqBodyData = req.body;

        let buyerRequest = {
            "userid": userid,
            "password": password,
            "type": 'slug'
        };

        const user = await queryBuilder.getBuyerDetails(buyerRequest);

        if (!isEmpty(user)) {
            let slug = '';
            if (user.slug != "") {
                slug = user.slug;
            }
            if (request_key !== '' && ((request_key === customConfig.CONTAINER_KEY.KEY && containerRedemptionType.includes(user.container_redemption_type)) || (request_key === customConfig.CONSUMER_KEY.KEY && user.consumer_merchant === 'Y'))) {
                user.is_ip_validation = 'No';
            }

            let client_ip = await element.getClientIP(req);
            let is_parameter_encryption = user.is_parameter_encryption.toLowerCase();

            if (user.is_ip_validation.toLowerCase() == 'yes') {
                client_ip = (client_ip) ? client_ip : "";
                let validateIpRequest = { 'buyer_id': user.id, 'ip_address': client_ip };
                let ip_matched = await queryBuilder.validateClientIp(req, validateIpRequest);

                if (!ip_matched) {
                    return res.send(await sendResponse(7, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'walletReversal IP Validation [ ' + client_ip + ' ]'));
                }
            }

            if (is_parameter_encryption == "y") {
                reqBodyData = await element.parameterDecryption(reqBodyData.data, user.hash_secret_key, user.secret_iv);

                if (!reqBodyData) {
                    return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'walletReversal parameterDecryption [ ' + client_ip + ' ]'));
                }
            }

            reqBodyData = element.obj_key_case_change(reqBodyData, 'CASE_LOWER');
            let logKey = 'MOBILE [' + reqBodyData.mobile + client_ip + '] ' + ': walletReversal ';

            logs.wrapper_log('info', logKey + JSON.stringify(reqBodyData));

            if (!reqBodyData.mid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (reqBodyData.mid && reqBodyData.mid != user.merchant_guid) {
                return res.send(await sendResponse(25, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.tid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.source) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (!apiSources.includes(reqBodyData.source)) {
                return res.send(await sendResponse(5, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.porderid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.worderid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            let conditions = { merchant_guid: reqBodyData.mid };
            if (reqBodyData.txnid) {
                conditions.txn_guid = reqBodyData.txnid;
            }

            if (reqBodyData.worderid) {
                conditions.porder_id = reqBodyData.worderid;
            }

            let txnData = await queryBuilder.getWalletTxnData(conditions);

            if (!isEmpty(txnData)) {
                let txn_guid = txnData.txn_guid;
                let walletTxnMaxValidRequest = {
                    'txn_guid': txn_guid,
                    'merchant_id': user.merchant_id
                };

                let txnDataMaxValidDate = await queryBuilder.getWalletTxnMaxValidTill(walletTxnMaxValidRequest);

                reqBodyData.mobile = element.piDecryption(txnDataMaxValidDate.mobile);

                let maxValidTill = txnDataMaxValidDate.ValidTill;

                let reverseTxnRequest = {
                    'GIVEN_USER_ID': txnData.user_id,
                    'GIVEN_TXN_ID': txn_guid,
                    'GIVEN_MERCHANT_ID': txnData.merchant_id,
                    'GIVEN_RORDER_ID': reqBodyData.porderid,
                    'GIVEN_SOURCE': reqBodyData.source,
                    'GIVEN_VALID_TILL': maxValidTill
                };

                let wallet_data = await queryBuilder.reverseWalletDebitTransactionV4(reverseTxnRequest);

                if (!isEmpty(wallet_data) && wallet_data.status != undefined) {
                    let responseData = {
                        'mid': reqBodyData.mid,
                        'tid': reqBodyData.tid,
                        'porderid': reqBodyData.porderid,
                        'worderid': reqBodyData.worderid
                    };
                    if (wallet_data.message == "transaction was already reversed!") {
                        responseData.rtxnid = wallet_data.txn_id;
                        responseData.txndate = moment().unix();
                        return res.send(await sendResponse(12, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, responseData));
                    } else if (wallet_data.status == 1) {
                        let wallet_main_balance = 0;
                        let walletBalanceRequest = { 'user_id': txnData.user_id, 'merchant_id': txnData.merchant_id };
                        let wallet_balance = await queryBuilder.getWalletBalanceQuery(walletBalanceRequest);

                        if (wallet_balance) {
                            if (wallet_balance.status == 1) {
                                wallet_main_balance = wallet_balance.main_balance;
                            }
                        }
                        responseData.txnstatus = txnData.txn_status;
                        responseData.rtxnid = wallet_data.txn_id;
                        responseData.txndate = moment().unix();

                        if (user.customer_communication == 'Y') {
                            let validity = moment(maxValidTill).format('MMM DD, YYYY');

                            const message = "Important Service Alert!\n\nDear Customer, due to a technical error your " + user.brand_name + "-PAY Account was debited with INR " + txnData.amount + ",the same has been reversed.\n\nAvailable Balance: INR " + wallet_main_balance + "\nValidity: " + validity + "\n\nWe regret for any inconvenience caused. No action is required from your side.\nTo MANAGE your account or any HELP visit " + EPAY_URL + slug + "\n" + user.brand_name + "-PAY Powered by GyFTR";

                            smsComponent.sendSMS(reqBodyData.mobile, message, txnDataMaxValidDate.mobile, 'walletReversal');

                        }
                        return res.send(await sendResponse(0, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, responseData));
                    } else {
                        return res.send(await sendResponse(13, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, responseData));
                    }
                } else {
                    return res.send(await sendResponse(8, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                }
            } else {
                return res.send(await sendResponse(13, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }
        } else {
            return res.send(await sendResponse(3));
        }
    } catch (error) {
        logs.wrapper_log('error', error.message);
        console.log(error);
        return res.send(await sendResponse(14));
    }
}

const refunds = async (req, res) => {
    try {
        const request_key = req.headers['request-key'] ? req.headers['request-key'] : "";

        const { userid, password } = req.headers;
        let reqBodyData = req.body;

        let buyerRequest = {
            "userid": userid,
            "password": password,
            "type": 'slug'
        };

        const user = await queryBuilder.getBuyerDetails(buyerRequest);

        if (user) {
            let slug = '';
            if (user.slug != "") {
                slug = user.slug;
            }
            if (request_key !== '' && ((request_key === customConfig.CONTAINER_KEY.KEY && containerRedemptionType.includes(user.container_redemption_type)) || (request_key === customConfig.CONSUMER_KEY.KEY && user.consumer_merchant === 'Y'))) {
                user.is_ip_validation = 'No';
            }

            let client_ip = await element.getClientIP(req);
            let is_parameter_encryption = user.is_parameter_encryption.toLowerCase();

            if (user.is_ip_validation.toLowerCase() == 'yes') {
                client_ip = (client_ip) ? client_ip : "";
                let validateIpRequest = { 'buyer_id': user.id, 'ip_address': client_ip };
                let ip_matched = await queryBuilder.validateClientIp(req, validateIpRequest);

                if (!ip_matched) {
                    return res.send(await sendResponse(7, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'rechargeWallet IP Validation [ ' + client_ip + ' ]'));
                }
            }

            if (is_parameter_encryption == "y") {
                reqBodyData = await element.parameterDecryption(reqBodyData.data, user.hash_secret_key, user.secret_iv);

                if (!reqBodyData) {
                    return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, 'rechargeWallet parameterDecryption [ ' + client_ip + ' ]'));
                }
            }

            reqBodyData = element.obj_key_case_change(reqBodyData, 'CASE_LOWER');
            let logKey = 'MOBILE [' + reqBodyData.mobile + client_ip + '] ' + ': rechargeWallet ';

            logs.wrapper_log('info', logKey + JSON.stringify(reqBodyData));

            if (!reqBodyData.mid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (reqBodyData.mid && reqBodyData.mid != user.merchant_guid) {
                return res.send(await sendResponse(25, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.tid) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.source) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (!apiSources.includes(reqBodyData.source)) {
                return res.send(await sendResponse(5, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.actiontype) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            let actiontype = (reqBodyData.actiontype.trim()).toUpperCase();

            if (!['CREDITNOTE', 'VOID', 'REFUND'].includes(actiontype)) {
                return res.send(await sendResponse(5, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.porderid && ['CREDITNOTE', 'REFUND'].includes(actiontype)) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.drorderid && ['VOID', 'REFUND'].includes(actiontype)) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.drtxnid && ['REFUND'].includes(actiontype)) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.desc && ['CREDITNOTE'].includes(actiontype)) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.mobile && ['CREDITNOTE'].includes(actiontype)) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (!element.isValidMobileNum(reqBodyData.mobile) && ['CREDITNOTE'].includes(actiontype)) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }

            if (!reqBodyData.amount) {
                return res.send(await sendResponse(1, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            } else if (user.partial_refund_thrashhold > 0 && actiontype == 'CREDITNOTE' && reqBodyData.amount > user.partial_refund_thrashhold) {
                let dynamicMsg = { '{dynamic_amount}': user.partial_refund_thrashhold };

                return res.send(await sendResponse(49, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, null, dynamicMsg));
            }

            const encmobile = (reqBodyData.mobile) ? element.piEncryption(reqBodyData.mobile) : '';
            let customerDetails;
            if (actiontype == 'CREDITNOTE') {
                customerDetails = await queryBuilder.checkUserAgainstMerchantId({ 'merchant_id': user.merchant_id, 'mobile': encmobile });

                if (customerDetails == null) {
                    return res.send(await sendResponse(25, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                }

                if (customerDetails && customerDetails.status != 'A') {
                    return res.send(await sendResponse(42, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                }

                customerDetails.user_id = customerDetails.id;

            } else {
                let conditions = { merchant_guid: reqBodyData.mid };
                if (reqBodyData.drtxnid) {
                    conditions.txn_guid = reqBodyData.drtxnid;
                }

                if (reqBodyData.drorderid) {
                    conditions.porder_id = reqBodyData.drorderid;
                }

                customerDetails = await queryBuilder.getWalletTxnData(conditions);
            }

            if (!isEmpty(customerDetails)) {
                let wallet_remains = "0.00";
                let maxValidTillDate, txnValidTillDate;
                if (actiontype != 'VOID') {
                    let walletBalanceRequest = { 'user_id': customerDetails.user_id, 'merchant_id': user.merchant_id };
                    let wallet_balance = await queryBuilder.getWalletBalanceQuery(walletBalanceRequest);

                    if (wallet_balance) {
                        if (wallet_balance.status == 1) {
                            wallet_remains = wallet_balance.main_balance;
                        }
                    }
                    let txnValidTillRequest = {
                        "user_id": customerDetails.user_id,
                        "merchant_id": user.merchant_id
                    };

                    txnValidTillDate = await queryBuilder.getUserMaxValidTill(txnValidTillRequest);

                    maxValidTillDate = txnValidTillDate.validTillDate;

                }
                let refundsApiResponse
                if (actiontype == 'VOID') {
                    reqBodyData.desc = (reqBodyData.desc) ? reqBodyData.desc : "VOID";
                    refundsApiResponse = await element.processVOIDByRefunds(customerDetails.user_id, user.merchant_id, reqBodyData);
                } else if (actiontype == 'CREDITNOTE') {
                    reqBodyData.desc = (reqBodyData.desc) ? reqBodyData.desc : "CN";
                    let mobile = reqBodyData.mobile;

                    let orderId = "CN-" + mobile.substring(0, 4) + moment().unix();
                    let validDays = user.partial_refund_validtill;
                    let valid_till = moment().add(validDays, 'days').format('YYYY-MM-DD');

                    refundsApiResponse = await element.processCreditNote(customerDetails.user_id, user.merchant_id, orderId, valid_till, reqBodyData);

                    if (refundsApiResponse.Code == '00' && user.customer_communication == 'Y') {
                        wallet_remains = wallet_remains + reqBodyData.amount;

                        let validity = moment(maxValidTillDate).format('MMM DD, YYYY');

                        const creditMessage = "Credit Alert!\n\nINR " + reqBodyData.amount + " added to your " + user.brand_name + "-PAY Account " + mobile + " \n\nUpdated Balance: INR " + wallet_remains + "\nValidity: " + validity + "\n\nTo MANAGE your account or any HELP visit " + EPAY_URL + slug + "\n" + user.brand_name + "-PAY Powered by GyFTR";
                        smsComponent.sendSMS(mobile, creditMessage, encmobile, 'refunds');
                    }
                } else {
                    reqBodyData.desc = (reqBodyData.desc) ? reqBodyData.desc : "Reversal";
                    let txn_guid = reqBodyData.drtxnid;
                    let txnBalanceRequest = {
                        'GIVEN_USER_ID': customerDetails.user_id,
                        'GIVEN_MERCHANT_ID': user.merchant_id,
                        'GIVEN_TXN_GUID': txn_guid
                    };
                    let txn_balance = await queryBuilder.getTxnBalance(txnBalanceRequest);

                    if (txn_balance.main_balance == 0) {
                        return res.send(await sendResponse(50, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
                    }

                    if ((txn_balance.main_balance > 0) && (reqBodyData.amount > txn_balance.main_balance)) {
                        let dynamicMsg = { '{dynamic_amount}': txn_balance.main_balance };

                        return res.send(await sendResponse(49, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, null, dynamicMsg));
                    }
                    refundsApiResponse = await element.processRefunds(customerDetails.user_id, user.merchant_id, reqBodyData);

                    if (refundsApiResponse.Code == '00' && user.customer_communication == 'Y') {
                        let mobile = await element.piDecryption(txnValidTillDate.mobile);

                        let validity = moment(maxValidTillDate).format('MMM DD, YYYY');

                        const message = "Important Service Alert!\n\nDear Customer, due to a technical error your " + user.brand_name + "-PAY Account was debited with INR " + reqBodyData.amount + ",the same has been reversed.\n\nAvailable Balance: INR " + wallet_remains + "\nValidity: " + validity + "\n\nWe regret for any inconvenience caused. No action is required from your side.\nTo MANAGE your account or any HELP visit " + EPAY_URL + slug + "\n" + user.brand_name + "-PAY Powered by GyFTR";

                        smsComponent.sendSMS(mobile, message, txnValidTillDate.mobile, 'refunds');
                    }
                }

                return res.send(await sendResponse(refundsApiResponse.Code, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey, refundsApiResponse));

            } else {
                return res.send(await sendResponse(13, is_parameter_encryption, user.hash_secret_key, user.secret_iv, logKey));
            }
        } else {
            return res.send(await sendResponse(25));
        }
    } catch (error) {
        logs.wrapper_log('error', error.message);
        console.log(error);
        return res.send(await sendResponse(14));
    }
}

module.exports = { generateOTP, getWalletBalance, getWalletTxnStatus, getCjTxnsStatus, updateBillingDetails, voucherDetails, removeVoucher, loadWallet, rechargeWallet, walletRedemption, walletReversal, refunds };