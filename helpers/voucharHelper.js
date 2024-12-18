const vouchagram = require("../components/vouchagram.component");
const MCrypt = require("../components/mcrypt.component");
const logs = require("../logs");
var moment = require('moment');
const element = require("./index");
const queryBuilder = require("./queryBuilderHelper");


exports.getVoucherDetailsInternal = async (vchrCode, mobile, client_guid_merchant) => {

    let returnVoucherDetailData = await vouchagram.voucherDetailSearchWithMerchant(vchrCode, client_guid_merchant);

    logs.wrapper_log('info', 'getVoucherDetailsInternal DCMS RESPONSE ' + JSON.stringify(returnVoucherDetailData));

    if ((returnVoucherDetailData?.ResultType) && returnVoucherDetailData?.ResultType.toLowerCase() == 'success') {
        let voucher_expiry = returnVoucherDetailData.response_data?.VoucherDetail[0]['EXPIRY DATE'].toString();
        let validTillDate = (voucher_expiry) ? moment(new Date(voucher_expiry)).format('DD MMM YYYY') : '';

        let voucher_number = element.ccMasking(vchrCode, 'X');
        let EncryptedVoucherNumber = await MCrypt.encrypt(vchrCode);
        let VoucherGuid = returnVoucherDetailData.response_data?.VoucherDetail[0].VOUCHERGUID;
        let VoucherCategory = returnVoucherDetailData.response_data?.VoucherDetail[0].CATEGORY;;
        let voucherAmount = (returnVoucherDetailData.response_data?.VoucherDetail[0].FACEVALUE) ? returnVoucherDetailData.response_data?.VoucherDetail[0].FACEVALUE : 0;
        let totalAvailableAmount = voucherAmount;
        let consumed_date = '';
        let vStatus = "";

        switch (returnVoucherDetailData.response_data.VoucherDetail[0].STATUS.toLowerCase()) {
            case 'valid':
                vStatus = "valid";
                break;
            case 'consumed':
                vStatus = "consumed";
                consumed_date = validTillDate;
                break;
            case 'expired':
                vStatus = "expired";
                break;
            default:
                vStatus = "invalid";
                break;
        }
        let curDateTime = moment().format('DD MMM YYYY');

        if (vStatus == "consumed") {
            let voucharDetailsRequest = {
                'MOBILE_NUMBER': mobile,
                'VOUCHER_NUMBER': vchrCode
            };
            let voucher_details = await queryBuilder.getVoucherDetailsByMobileAndVoucherNumber(voucharDetailsRequest);

            logs.wrapper_log('info', 'getVoucherDetailsInternal SP RESPONSE ' + JSON.stringify(voucher_details));

            if (voucher_details) {
                validTillDate = (voucher_details.valid_till) ? moment(new Date(voucher_expiry)).format('DD MMM YYYY') : '';

                voucherAmount = voucher_details.voucherAmount;
                totalAvailableAmount = voucher_details.totalAvailableAmount;
                let voucherStatus = (voucher_details.status) ? voucher_details.status.toLowerCase() : '';
                if (voucherStatus == 'success') {
                    vStatus = 'applied';
                } else {
                    vStatus = voucherStatus;
                }
                if (new Date(curDateTime) > new Date(validTillDate)) {
                    vStatus = 'expired';
                }

                return {
                    "statusCode": '0',
                    "VoucherGuid": VoucherGuid,
                    "VoucherNumber": voucher_number,
                    "EncryptedVoucherNumber": EncryptedVoucherNumber,
                    "Value": voucherAmount,
                    "AvailableBalance": totalAvailableAmount,
                    "ExpiryDate": validTillDate,
                    "BrandName": "",
                    "Status": vStatus,
                    "Category": VoucherCategory
                }
            } else {
                logs.wrapper_log('info', 'getVoucherDetailsInternal VOUCHER DETAILS NOT FOUND');
                return { "statusCode": 30 };
            }
        } else {
            if (new Date(curDateTime) > new Date(validTillDate)) {
                vStatus = 'expired';
            }

            return {
                "statusCode": '0',
                "VoucherGuid": VoucherGuid,
                "VoucherNumber": voucher_number,
                "EncryptedVoucherNumber": EncryptedVoucherNumber,
                "Value": voucherAmount,
                "AvailableBalance": totalAvailableAmount,
                "ExpiryDate": validTillDate,
                "BrandName": "",
                "Status": vStatus,
                "Category": VoucherCategory
            }
        }
    } else {
        logs.wrapper_log('info', 'getVoucherDetailsInternal INVALID VOUCHER DETAILS ');
        // Return Error Code
        return { "statusCode": 30 };
    }
}

exports.getDCMSWithAppliedAndHoldVouchersList = async (user_id, merchant_id, mobile, is_masked, vchr_add_remove_flag, client_guid_merchant) => {
    let custom_vchr_details = [];
    let listVchr = await vouchagram.voucherDetails(mobile, client_guid_merchant);

    if ((listVchr?.GETMERCHANTVCHRDTLResult) && listVchr?.GETMERCHANTVCHRDTLResult[0]?.ResultType == 'SUCCESS') {
        const vchrdetails = listVchr.GETMERCHANTVCHRDTLResult[0].VoucherDetails;

        if (vchrdetails) {

            await vchrdetails.forEach(async function (voucherData) {

                let EncryptedVoucherNumber = voucherData.Voucherno;
                let voucher_number = await MCrypt.decrypt(voucherData.Voucherno);
                if (is_masked == 'M') {
                    voucher_number = await element.ccMasking(voucher_number, 'X');
                }

                let voucharData = {
                    'VoucherGuid': voucherData.VoucherGuid,
                    'VoucherNumber': voucher_number,
                    'EncryptedVoucherNumber': EncryptedVoucherNumber,
                    'Value': voucherData.Value
                };
                if (vchr_add_remove_flag == 'Y') {
                    voucharData.AvailableBalance = voucherData.Value;
                }
                voucharData.ExpiryDate = voucherData.EndDate;
                voucharData.BrandName = voucherData.BrandName;
                if (vchr_add_remove_flag == 'Y') {
                    voucharData.Status = 'valid';
                    voucharData.Category = voucherData.Category;
                }

                custom_vchr_details.push(voucharData);
            });

            if (vchr_add_remove_flag == 'Y') {
                custom_vchr_details = await element.getAppliedAndHoldVouchersList(user_id, merchant_id, is_masked, custom_vchr_details);

            }
        }
        return custom_vchr_details;
    } else if (vchr_add_remove_flag == 'Y') {
        return await element.getAppliedAndHoldVouchersList(user_id, merchant_id, is_masked);
    } else {
        return false;
    }
};
