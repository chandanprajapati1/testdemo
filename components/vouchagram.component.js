const { callAPI } = require("../helpers/helper");
const { customConfig } = require("../config/custom.config");
const logs = require("../logs");

exports.voucherDetailSearchWithMerchant = async (vchrCode, client_guid_merchant) => {

    let URL = customConfig.VouchagramCRM.BASE_URL + 'voucher/POSTVOUCHERDETAIL'

    const rawPayload = {
        VoucherNumber: vchrCode,
        MerchantGuid: client_guid_merchant
    };

    logs.gyftr_api('info', 'voucherDetailSearchWithMerchant Request ' + JSON.stringify(rawPayload));

    const reqHeaders = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'UserId': customConfig.VouchagramCRM.UserId,
        'Password': customConfig.VouchagramCRM.Password
    };

    let response = await callAPI(URL, 'POST', reqHeaders, rawPayload, 120000);

    logs.gyftr_api('info', 'voucherDetailSearchWithMerchant RESPONSE ' + JSON.stringify(response));
    return response;
}

exports.voucherDetails = async (mobile, client_guid_merchant) => {

    let URL = customConfig.VouchagramCRM.BASE_URL + 'VCHRDTL/POSTMERCHANTVCHRDTL'

    const rawPayload = {
        MOBILENUMBER: mobile,
        MERCHANTGUID: client_guid_merchant
    };

    logs.gyftr_api('info', 'voucherDetails Request ' + JSON.stringify(rawPayload));

    const reqHeaders = {
        'Content-Type': 'application/json',
        'UserId': customConfig.VouchagramCRM.UserId,
        'Password': customConfig.VouchagramCRM.Password
    };

    let response = await callAPI(URL, 'POST', reqHeaders, rawPayload, 120000);

    logs.gyftr_api('info', 'voucherDetails RESPONSE ' + JSON.stringify(response));
    return response;
}

exports.consumeVoucher = async (voucherCode, txnOrderId, amount = null, merchantData = null) => {

    let URL = customConfig.Vouchagram.BASE_URL + 'consume'

    const rawPayload = {
        deviceCode: 'p',
        merchantUid: merchantData.client_guid_merchant,
        shopCode: merchantData.shopCode,
        password: merchantData.client_password_merchant,
        requestjobnumber: txnOrderId,
        BillValue: amount,
        VoucherNumber: voucherCode
    };

    logs.gyftr_api('info', 'consumeVoucher Request ' + JSON.stringify(rawPayload));

    const reqHeaders = {};

    let response = await callAPI(URL, 'GET', reqHeaders, null, 120000, rawPayload);

    logs.gyftr_api('info', 'consumeVoucher RESPONSE ' + JSON.stringify(response));
    return response;
}

exports.cancelVoucher = async (voucherCode, merchantData = null) => {

    let URL = customConfig.Vouchagram.BASE_URL + 'Cancel'

    const rawPayload = {
        deviceCode: 'p',
        merchantUid: merchantData.client_guid_merchant,
        shopCode: merchantData.shopCode,
        password: merchantData.client_password_merchant,
        VoucherNumber: voucherCode
    };

    logs.gyftr_api('info', 'cancelVoucher Request ' + JSON.stringify(rawPayload));

    const reqHeaders = {};

    let response = await callAPI(URL, 'GET', reqHeaders, null, 120000, rawPayload);

    logs.gyftr_api('info', 'cancelVoucher RESPONSE ' + JSON.stringify(response));
    return response;
}

