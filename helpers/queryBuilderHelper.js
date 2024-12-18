const DB = require("../models");
const dbConnection = new DB();

const getBuyerDetails = async (params) => {
    let column = Object.keys(params).map(key => `:${key}`).join(',');

    const [buyerDetails] = await queryBuilder("CALL verifyBuyerDetails(" + column + ")", params);
    return buyerDetails;
}

const checkUserAgainstMerchantId = async (params) => {
    return await queryBuilder("SELECT * FROM users where mobile = :mobile AND merchant_id = :merchant_id LIMIT 1", params);
}

const createUserAgainstMerchant = async (params) => {

    var SQL = "INSERT INTO users (merchant_id, tid, mobile, user_type, created_by, updated_by, status) VALUES (:merchant_id, :tid, :mobile, :user_type, :created_by, :updated_by, :status)";

    return await dbConnection.query(SQL, params);
}

const getOtpUserData = async (params) => {

    var SQL = "SELECT OtpUser.id,OtpUser.blocked_date AS `blocked_date`, OtpUser.invalid_otp_attempts AS `invalid_otp_attempts` FROM otp_users OtpUser INNER JOIN merchants mr ON mr.id = OtpUser.merchant_id AND mr.merchant_guid = :mid WHERE mobile = :mobile";

    return await queryBuilder(SQL, params);
}

const updateOtpCodeData = async (params) => {
    var SQL = "UPDATE otp_codes INNER JOIN otp_users ON otp_codes.otp_user_id = otp_users.id SET otp_codes.status = :status WHERE otp_users.mobile = :mobile ";

    return await dbConnection.query(SQL, params);
}

const upsertOtpUser = async (otpUserRecord) => {
    let column = Object.keys(otpUserRecord).join(',');
    let data = Object.values(otpUserRecord).join('","');

    var SQL = 'INSERT INTO otp_users(' + column + ') VALUES("' + data + '") ON DUPLICATE KEY UPDATE created = "' + otpUserRecord.created + '"';

    return await dbConnection.query(SQL);
}

const getLastOtp = async (params) => {

    var SQL = 'SELECT OtpCode.id AS `id`, OtpCode.code AS `code`, OtpCode.status AS `status`, OtpCode.valid_till AS `valid_till`, OtpCode.created AS `created` FROM otp_codes OtpCode WHERE otp_user_id = :otp_user_id ORDER BY id DESC LIMIT 1';

    return await queryBuilder(SQL, params);
}

const createRecord = async (tableName, otpUserRecord) => {
    let column = Object.keys(otpUserRecord).join(',');
    let data = Object.values(otpUserRecord).join('","');

    var SQL = 'INSERT INTO ' + tableName + '(' + column + ') VALUES("' + data + '")';

    return await dbConnection.query(SQL);
}

const validateClientIp = async (request, params) => {

    let buyers = await queryBuilder("SELECT * FROM buyer_ips where buyer_id = :buyer_id AND ip_address = :ip_address LIMIT 1", params);

    if (buyers) {
        return true;
    } else if (request.socket.localAddress == ip_address) {
        return true;
    } else {
        return false;
    }
}

const getWalletBalanceQuery = async (params, category = null) => {
    let SQL;
    if (category != null) {
        SQL = "CALL get_wallet_main_promo_balance_v2(:user_id, :merchant_id, :category)";
    } else {
        SQL = "CALL get_wallet_main_promo_balance_v1(:user_id, :merchant_id)";
    }

    const [walletBalance] = await queryBuilder(SQL, params);
    return walletBalance;
}

const getUnRedeemedVoucherList = async (params) => {
    let SQL = "CALL getUnRedeemedVoucherList(:user_id, :merchant_id, :type)";

    const [voucherList] = await queryBuilder(SQL, params);
    return voucherList;
}

const getWalletTxnData = async (condition) => {
    let where = Object.keys(condition).map(key => `${key} = :${key}`).join(' AND ');
    let SQL = "SELECT *,WalletTransactions.status as txn_status FROM wallet_txns WalletTransactions INNER JOIN merchants Merchants ON WalletTransactions.merchant_id = Merchants.id WHERE " + where + " ";

    return await queryBuilder(SQL, condition);
}

const getCjTxnStatus = async (transaction_Id) => {
    const [cjTxnStatus] = await queryBuilder("CALL CjTransactionStatus(?)", [transaction_Id]);
    return cjTxnStatus;
}

const getCjPaymentDetails = async (merchant_Id, transaction_Id) => {
    const cjPaymentDetails = await queryBuilder("CALL CjPaymentDetails(?,?)", [merchant_Id, transaction_Id]);
    return cjPaymentDetails;
}

const updateWalletBillingInfo = async (params) => {
    const [updateBillingInfo] = await queryBuilder("CALL update_wallet_debit_billing_info(:GIVEN_USER_ID,:GIVEN_TXN_GUID,:GIVEN_MERCHANT_ID,:GIVEN_PORDER_ID,:GIVEN_BILL_NO,:GIVEN_BILL_VALUE)", params);
    return updateBillingInfo;
}

const updateOtpUserData = async (params) => {
    var SQL = "UPDATE otp_users SET blocked_date = :blocked_date,invalid_otp_attempts = :invalid_otp_attempts WHERE id = :id";

    return await dbConnection.query(SQL, params);
}

const updateOtpCodeStatus = async (params) => {

    var SQL = "UPDATE otp_codes SET otp_codes.status = :status WHERE id = :id ";

    return await dbConnection.query(SQL, params);
}

const getOtpData = async (params) => {
    var SQL = "SELECT OtpUser.id AS otp_user_id, OtpUser.blocked_date AS blocked_date, OtpUser.invalid_otp_attempts AS invalid_otp_attempts, OtpUser.generate_otp_bloced_date AS generate_otp_bloced_date, OtpUser.generate_otp_attempts AS generate_otp_attempts, OtpCode.id AS id FROM otp_users OtpUser INNER JOIN otp_codes OtpCode ON OtpUser.id = OtpCode.otp_user_id  INNER JOIN merchants mr ON mr.id = OtpUser.merchant_id AND mr.merchant_guid = :mid WHERE OtpUser.mobile = :mobile AND OtpCode.code = :otp_code AND OtpCode.status = :status AND OtpCode.valid_till > :cur_date AND (OtpUser.blocked_date is NULL OR OtpUser.blocked_date < :cur_date)";

    return await queryBuilder(SQL, params);
}

const checkUserOtpVerifiedQuery = async (params) => {
    var SQL = "SELECT OtpUser.id AS otp_user_id, OtpUser.blocked_date AS blocked_date, OtpUser.invalid_otp_attempts AS invalid_otp_attempts, OtpUser.generate_otp_bloced_date AS generate_otp_bloced_date, OtpUser.generate_otp_attempts AS generate_otp_attempts, OtpCode.id AS id FROM otp_users OtpUser INNER JOIN otp_codes OtpCode ON OtpUser.id = OtpCode.otp_user_id  INNER JOIN merchants mr ON mr.id = OtpUser.merchant_id AND mr.merchant_guid = :mid WHERE OtpUser.mobile = :mobile AND OtpCode.status = :status AND OtpCode.created >= :cur_date ";

    return await queryBuilder(SQL, params);
}

const getWalletTxnFromVoucherNo = async (params) => {
    var SQL = "SELECT user_id,txn_guid,merchant_id,voucher_number,status FROM wallet_txns WHERE txn_type ='CR' AND txn_subtype = 'C' AND status = :status AND merchant_id = :merchant_id AND voucher_number = :voucherNo";

    return await queryBuilder(SQL, params);
}

const addORRemoveVoucherFromWallet = async (params) => {

    const [addRemoveDone] = await queryBuilder("CALL add_OR_remove_voucher_from_wallet_v2(:GIVEN_MERCHANT_ID,:GIVEN_VOUCHER_NUMBER,:GIVEN_TYPE,:GIVEN_PORDER_ID,:GIVEN_USER_ID)", params);
    return addRemoveDone;
}

const getBalanceAfterAddRemoveVouchers = async (params) => {
    const [balanceAfterAddRemoveDone] = await queryBuilder("CALL getBalanceAfter_Add_Remove_Vouchers(:VOUCHER_NUMBER)", params);
    return balanceAfterAddRemoveDone;
}

const getVoucherDetailsByMobileAndVoucherNumber = async (params) => {
    const [getVoucherDetails] = await queryBuilder("CALL getVoucherDetailsByMobileAndVoucherNumber(:MOBILE_NUMBER,:VOUCHER_NUMBER)", params);
    return getVoucherDetails;
}

const getAllAppliedHoldVoucherListQuery = async (params) => {
    const voucher_details = await queryBuilder("CALL getAllAppliedHoldVoucherList(:USER_ID,:MERCHANT_ID,:TYPE)", params);
    return voucher_details;
}

const updateUserCustomVoucherData = async (params) => {

    var SQL = "UPDATE users SET custom_voucher_attempts = :custom_voucher_attempts,custom_voucher_blocked_date = :blocked_date WHERE id = :user_id ";

    return await dbConnection.query(SQL, params);
}

const checkVoucherIdAlreadyConsumed = async (params) => {
    const [voucher_unique_order] = await queryBuilder("CALL get_unique_order_voucher_id(:given_voucher_id_dcms)", params);
    return voucher_unique_order;
}

const checkRechargeAvailableLimit = async (params) => {
    const [rechargeAvailableLimit] = await queryBuilder("CALL checkRechargeAvailableLimit(:MERCHANT_ID,:USER_ID,:FROM_DATE,:TO_DATE,:USER_RECHARGE_LIMIT)", params);
    return rechargeAvailableLimit;
}

const walletVchrCreditV2 = async (params) => {
    const [voucher_credit] = await queryBuilder("CALL wallet_vchr_credit_v2(:given_user_id,:given_merchant_id,:given_txn_guid,:given_porderid,:given_amount,:given_voucher_code,:given_points,:given_loyalty_prefix,:given_source,:given_tid,:given_auth_code,:given_voucher_id,:given_voucher_guid,:given_vchr_expiry_date)", params);
    return voucher_credit;
}

const walletVchrCreditV3 = async (params) => {
    const [voucher_credit] = await queryBuilder("CALL wallet_vchr_credit_v3(:given_user_id,:given_merchant_id,:given_txn_guid,:given_porderid,:given_amount,:given_voucher_code,:given_points,:given_loyalty_prefix,:given_source,:given_tid,:given_auth_code,:given_voucher_id,:given_voucher_guid,:given_vchr_expiry_date,:voucher_category)", params);
    return voucher_credit;
}

const getUniqueOrderIdQuery = async (params) => {
    const [orderId] = await queryBuilder("CALL get_unique_order_id_v2(:txn_guid,:voucher_id_dcms,:voucher_exp_date)", params);
    return orderId;
}

const walletDebitTransactionVoid = async (params) => {
    const [txnData] = await queryBuilder("CALL wallet_debit_transaction_to_void_v1(:GIVEN_USER_ID,:GIVEN_MERCHANT_ID,:GIVEN_TXN_GUID,:GIVEN_PORDER_ID,:GIVEN_DESC,:GIVEN_TIMEOUT)", params);
    return txnData;
}
const reverseWalletDebitTransactionV4 = async (params) => {
    const [txnData] = await queryBuilder("CALL reverse_wallet_debit_transaction_v4(:GIVEN_USER_ID,:GIVEN_TXN_ID,:GIVEN_MERCHANT_ID,:GIVEN_RORDER_ID,:GIVEN_SOURCE,:GIVEN_VALID_TILL)", params);
    return txnData;
}

const walletCreditByBrand = async (params) => {
    const [txnData] = await queryBuilder("CALL wallet_credit_brand_refund_v1(:given_user_id,:given_merchant_id,:given_txn_guid,:given_porderid,:given_amount,:given_source,:var_valid_from,:var_valid_till,:var_purpose,:given_bill_no,:given_tid)", params);
    return txnData;
}

const getTxnBalance = async (params) => {

    const [txnBalance] = await queryBuilder("CALL get_txn_balance(:GIVEN_USER_ID,:GIVEN_MERCHANT_ID,:GIVEN_TXN_GUID)", params);
    return txnBalance;
}

const reverseWalletDebitTransactionV5 = async (params) => {
    const [txnData] = await queryBuilder("CALL reverse_wallet_debit_transaction_v5(:GIVEN_USER_ID,:GIVEN_TXN_GUID,:GIVEN_MERCHANT_ID,:GIVEN_AMOUNT,:GIVEN_PORDER_ID,:GIVEN_DESC)", params);
    return txnData;
}

const walletRedemption = async (params, category = null) => {
    let SQL;
    if (category != null) {
        SQL = "CALL wallet_debit_order_category(:given_user_id,:given_merchant_id,:given_tid,:given_amount,:given_porder_id,:given_source,:given_txn_guid,:given_bill_no,:given_bill_value,:voucher_category)";
    } else {
        SQL = "CALL wallet_debit_order_v5(:given_user_id,:given_merchant_id,:given_tid,:given_amount,:given_porder_id,:given_source,:given_txn_guid,:given_bill_no,:given_bill_value)";
    }

    const [walletDebitTransactionResponse] = await queryBuilder(SQL, params);
    return walletDebitTransactionResponse;
}

const updateUniqueTxnIds = async (params) => {
    var SQL = "UPDATE unidue_txn_ids SET voucher_id_dcms = null WHERE voucher_id_dcms = :voucher_id_dcms ";
    return await dbConnection.query(SQL, params);
}

const updateWalletTxnsData = async (params, where) => {
    let column = Object.keys(params).map(key => `${key} = :${key}`).join(',');
    let conditionColumn = Object.keys(where).map(key => `${key} = :${key}`).join(' AND ');

    let parameters = { ...params, ...where };
    var SQL = "UPDATE wallet_txns SET " + column + " = ? WHERE " + conditionColumn + " = ? ";

    return await dbConnection.query(SQL, parameters);
}

const getWalletTxnUsingVoucher = async (params) => {
    var SQL = "SELECT id FROM wallet_txns WHERE voucher_number like :voucher_number";
    return await dbConnection.query(SQL, params);
}

const getWalletTxnMaxValidTill = async (params) => {
    var SQL = "SELECT MAX(wct.valid_till) AS ValidTill,u.mobile FROM `wallet_txns` wt INNER JOIN wallet_txn_details wtd on wtd.gyftr_wallet_txn_id = wt.id INNER JOIN wallet_txns wct ON wct.id = wtd.gyftr_wallet_cr_id INNER JOIN users u on u.id = wt.user_id WHERE wt.txn_guid = :txn_guid and wt.merchant_id = :merchant_id";
    return await queryBuilder(SQL, params);
}

const getUserMaxValidTill = async (params) => {
    var SQL = "SELECT MAX(wt.valid_till) AS validTillDate,u.mobile FROM `wallet_txns` wt INNER JOIN users u on u.id = wt.user_id WHERE wt.user_id = :user_id and wt.merchant_id = :merchant_id";
    return await queryBuilder(SQL, params);
}

async function queryBuilder(sqlQuery, replacements = []) {
    const [[queryResult]] = await dbConnection.query(sqlQuery, replacements);
    return queryResult;
}

module.exports = { getBuyerDetails, checkUserAgainstMerchantId, validateClientIp, createUserAgainstMerchant, getOtpUserData, updateOtpCodeData, upsertOtpUser, getLastOtp, createRecord, getWalletBalanceQuery, getUnRedeemedVoucherList, getWalletTxnData, getCjTxnStatus, getCjPaymentDetails, updateWalletBillingInfo, updateOtpUserData, updateOtpCodeStatus, getOtpData, getVoucherDetailsByMobileAndVoucherNumber, checkUserOtpVerifiedQuery, getWalletTxnFromVoucherNo, addORRemoveVoucherFromWallet, getBalanceAfterAddRemoveVouchers, getAllAppliedHoldVoucherListQuery, updateUserCustomVoucherData, checkVoucherIdAlreadyConsumed, walletVchrCreditV2, walletVchrCreditV3, checkRechargeAvailableLimit, getUniqueOrderIdQuery, updateUniqueTxnIds, getWalletTxnUsingVoucher, updateWalletTxnsData, walletDebitTransactionVoid, walletRedemption, getWalletTxnMaxValidTill, reverseWalletDebitTransactionV4, walletCreditByBrand, getTxnBalance, reverseWalletDebitTransactionV5, getUserMaxValidTill }