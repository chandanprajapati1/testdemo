const crypto = require('crypto');
const config = require("../config/custom.config.js");
const MCrypt = require("../components/mcrypt.component.js");
const queryBuilder = require("./queryBuilderHelper.js");
const helper = require("./helper.js");

const logs = require("../logs");
var moment = require('moment');
const statusCodeList = config.getStatusCodes;

exports.getClientIP = (request) => {
	let ip_address = request.socket.localAddress;
	return ip_address;
};

exports.validateOTP = async (otpCode, mId, encMobile) => {
	if (!otpCode) {
		return 1;
	}
	let curDateTime = moment().format('YYYY-MM-DD HH:mm:ss');
	let getOtpDataRequest = { 'mid': mId, 'mobile': encMobile, 'otp_code': otpCode, 'status': 'Not Used', 'cur_date': curDateTime }
	let otpData = await queryBuilder.getOtpData(getOtpDataRequest);

	if (!otpData) {

		let attempt = await queryBuilder.getOtpUserData({ 'mid': mId, 'mobile': encMobile });

		let attemped = attempt.invalid_otp_attempts + 1;

		let blockTime = (attempt?.blocked_date !== null) ? moment(attempt?.blocked_date).format('YYYY-MM-DD HH:mm:ss') : null;

		var otpAttemptsResponse = '9';
		if (attemped == 3) {
			blockTime = moment().add(config.constantData.INVALID_ATTEMPT_INITIAL_TIME_DELAY_SECONDS, 'seconds').format('YYYY-MM-DD HH:mm:ss');
			otpAttemptsResponse = { 'Code': '21', 'Message': 'Your account has been temporarily blocked for ' + (config.constantData.INVALID_ATTEMPT_INITIAL_TIME_DELAY_SECONDS / 60) + ' minutes.' };
		} else if (attemped % 3 == 0) {
			blockTime = moment().add(config.constantData.INVALID_ATTEMPT_FINAL_TIME_DELAY_SECONDS, 'seconds').format('YYYY-MM-DD HH:mm:ss');
			otpAttemptsResponse = { 'Code': '21', 'Message': 'Your account has been temporarily blocked for ' + (config.constantData.INVALID_ATTEMPT_FINAL_TIME_DELAY_SECONDS / 60) + ' minutes.' };
		}
		let updateOTPrequest = {
			'blocked_date': blockTime,
			'invalid_otp_attempts': attemped,
			'id': attempt.id
		};
		queryBuilder.updateOtpUserData(updateOTPrequest);
		return otpAttemptsResponse;
	} else {
		let updateOTPZeroRequest = {
			'blocked_date': null,
			'invalid_otp_attempts': 0,
			'id': otpData.otp_user_id
		};

		let updateOtpCodeRequest = {
			'status': 'Used',
			'id': otpData.id
		};
		queryBuilder.updateOtpCodeStatus(updateOtpCodeRequest);
		queryBuilder.updateOtpUserData(updateOTPZeroRequest);
	}
	return 0;
};

exports.checkUserOtpVerified = async (mId, encMobile, checkTime) => {
	let userOTPVerifiedRequest = {
		'mid': mId,
		'mobile': encMobile,
		'status': 'Used',
		'cur_date': checkTime
	};
	let otpData = await queryBuilder.checkUserOtpVerifiedQuery(userOTPVerifiedRequest);

	if (otpData) {
		return otpData;
	} else {
		return 0;
	}
};

exports.getAppliedAndHoldVouchersList = async (user_id, merchant_id, is_masked, custom_vchr_details = []) => {
	let HoldVoucherListRequest = {
		'USER_ID': user_id,
		'MERCHANT_ID': merchant_id,
		'TYPE': 'all'
	};

	let voucher_details = await queryBuilder.getAllAppliedHoldVoucherListQuery(HoldVoucherListRequest);
	if (voucher_details) {

		voucher_details.forEach(async function (voucherData) {

			var status = (voucherData.status.toLowerCase() == 'success') ? 'applied' : voucherData.status.toLowerCase();
			var voucher_expiry = (voucherData.vchr_expiry_date) ? moment(new Date(voucherData.vchr_expiry_date)).format('DD MMM YYYY') : '';
			let EncryptedVoucherNumber = await MCrypt.encrypt(voucherData.voucher_number);
			let voucher_number = voucherData.voucher_number;
			if (is_masked == 'M') {
				voucher_number = exports.ccMasking(voucher_number, 'X');
			}

			let voucharData = {
				'VoucherGuid': voucherData.voucher_guid,
				'VoucherNumber': voucher_number,
				'EncryptedVoucherNumber': EncryptedVoucherNumber,
				'Value': voucherData.amount,
				'AvailableBalance': voucherData.availableAmount,
				'ExpiryDate': voucher_expiry,
				'BrandName': "",
				'Status': status,
				'Category': voucherData.Category
			};

			custom_vchr_details.push(voucharData);
		});
		return custom_vchr_details;
	}
	return false;
};

exports.updateInvalidRechargeAttempts = async (user_id, custom_voucher_attempts, type) => {
	let custom_voucher_blocked_date = null;
	if (type == 'add') {
		custom_voucher_attempts = custom_voucher_attempts + 1;
		custom_voucher_blocked_date = moment().format('YYYY-MM-DD HH:mm:ss');
	} else {
		custom_voucher_attempts = 0;
	}

	let blockDateRequest = {
		'custom_voucher_attempts': custom_voucher_attempts,
		'blocked_date': custom_voucher_blocked_date,
		'user_id': user_id
	}

	await queryBuilder.updateUserCustomVoucherData(blockDateRequest);

	return true;
}

exports.rechargeAlreadyConsumedVoucher = async (voucher_id, vchrCode, user_id, merchant_id, postedData, merchantDetails, VoucherGuid, vouchagramComponent) => {
	const checkConsumedWithUs = await queryBuilder.checkVoucherIdAlreadyConsumed({ 'given_voucher_id_dcms': voucher_id });
	let merchantData = { 'client_guid_merchant': merchantDetails.client_guid_merchant, 'client_password_merchant': merchantDetails.client_password_merchant, 'shopCode': merchantDetails.shopCode };

	logs.wrapper_log('info', "MOBILE: [" + postedData.mobile + "] [__rechargeAlreadyConsumedVoucher] SP DATA_CONSUMED_CHECK RESP \N" + JSON.stringify(checkConsumedWithUs));

	if (checkConsumedWithUs.status && checkConsumedWithUs.txn_guid) {
		const returnVoucherData = await vouchagramComponent.consumeVoucher(vchrCode, checkConsumedWithUs.txn_guid, null, merchantData);
		logs.wrapper_log('info', "MOBILE: [" + postedData.mobile + "] [__rechargeAlreadyConsumedVoucher] consume_api_dcms RESP \N" + JSON.stringify(returnVoucherData));

		let amount = returnVoucherData?.ConsumeResult[0].Value;
		let auth_code = returnVoucherData?.ConsumeResult[0].AuthorizationCode;
		let voucher_id_from_consumed_api = returnVoucherData?.ConsumeResult[0].VoucherID;

		if (parseInt(voucher_id) === parseInt(voucher_id_from_consumed_api)) {

			let validTillDate = checkConsumedWithUs['exp_date'];

			let walletVchrCrRequest = {
				'given_user_id': user_id,
				'given_merchant_id': merchant_id,
				'given_txn_guid': 'M' + checkConsumedWithUs.txn_guid,
				'given_porderid': postedData.porderid,
				'given_amount': amount,
				'given_voucher_code': vchrCode,
				'given_points': null,
				'given_loyalty_prefix': null,
				'given_source': postedData.source,
				'given_tid': postedData.tid,
				'given_auth_code': auth_code,
				'given_voucher_id': voucher_id,
				'given_voucher_guid': VoucherGuid,
				'given_vchr_expiry_date': validTillDate
			};

			const walletVchrCreditResults = await queryBuilder.walletVchrCreditV2(walletVchrCrRequest);

			if (walletVchrCreditResults && walletVchrCreditResults.credit_txn_id !== undefined) {
				let wallet_main_balance = 0;
				let walletBalanceRequest = { 'user_id': user_id, 'merchant_id': merchant_id };
				const wallet_balance = await queryBuilder.getWalletBalanceQuery(walletBalanceRequest);

				if (wallet_balance) {
					if (wallet_balance.status == 1) {
						wallet_main_balance = wallet_balance.main_balance;
					}
				}

				let voucherResults = {
					'Code': '00',
					'mobile': postedData.mobile,
					'mid': postedData.mid,
					'tid': postedData.tid,
					'porderid': postedData.porderid,
					'vouchertype': postedData.vouchertype,
					'txnid': walletVchrCreditResults.order_guid,
					'balance': wallet_main_balance,
					'amount': amount,
					'txndate': moment().unix()
				}

				return voucherResults;
			} else {
				return statusCodeList[8];
			}
		} else {
			return statusCodeList[27];
		}
	} else {
		return statusCodeList[27];
	}

}

exports.getRechargeAvailableLimit = async (user_id, merchant_id, per_user_recharge_limit, per_user_recharge_days_limit) => {

	let FROM_DATE = moment().subtract(per_user_recharge_days_limit, 'days').format('YYYY-MM-DD');
	let TO_DATE = moment().format('YYYY-MM-DD');

	let availableLimit = per_user_recharge_limit;

	const checkRechargeLimitReq = {
		'MERCHANT_ID': merchant_id,
		'USER_ID': user_id,
		'FROM_DATE': FROM_DATE,
		'TO_DATE': TO_DATE,
		'USER_RECHARGE_LIMIT': per_user_recharge_limit
	};

	const availableDetails = await queryBuilder.checkRechargeAvailableLimit(checkRechargeLimitReq);

	if (availableDetails) {
		availableLimit = availableDetails.availableLimit;
	}
	return availableLimit;
}

exports.rechargeValidVouchers = async (vchrCode, voucher_id, validTillDate, user_id, merchant_id, vchr_add_remove_flag, voucherGuid, voucherCategory, merchantDetails, postedData, vouchagramComponent) => {

	const orderId = await exports.getUniqueOrderIdValueV2(voucher_id, validTillDate);
	let merchantData = { 'client_guid_merchant': merchantDetails.client_guid_merchant, 'client_password_merchant': merchantDetails.client_password_merchant, 'shopCode': merchantDetails.shopCode };
	const returnVoucherData = await vouchagramComponent.consumeVoucher(vchrCode, orderId, null, merchantData);
	logs.wrapper_log('info', "MOBILE: [" + postedData.mobile + "] [rechargeValidVouchers] consume_api_dcms RESP \N" + JSON.stringify(returnVoucherData));

	if (returnVoucherData && returnVoucherData.ConsumeResult[0].ResultType !== undefined && returnVoucherData.ConsumeResult[0].ResultType.toLowerCase() == 'success') {

		let amount = returnVoucherData?.ConsumeResult[0].Value;
		let auth_code = returnVoucherData?.ConsumeResult[0].AuthorizationCode;
		let walletVchrCreditResults;
		let walletVchrCrRequest = {
			'given_user_id': user_id,
			'given_merchant_id': merchant_id,
			'given_txn_guid': orderId,
			'given_porderid': postedData.porderid,
			'given_amount': amount,
			'given_voucher_code': vchrCode,
			'given_points': null,
			'given_loyalty_prefix': null,
			'given_source': postedData.source,
			'given_tid': postedData.tid,
			'given_auth_code': auth_code,
			'given_voucher_id': voucher_id,
			'given_voucher_guid': voucherGuid,
			'given_vchr_expiry_date': validTillDate
		};

		if (vchr_add_remove_flag == 'Y') {
			walletVchrCrRequest.voucher_category = voucherCategory;
			walletVchrCreditResults = await queryBuilder.walletVchrCreditV3(walletVchrCrRequest);
		} else {
			walletVchrCreditResults = await queryBuilder.walletVchrCreditV2(walletVchrCrRequest);
		}

		if (walletVchrCreditResults && walletVchrCreditResults.credit_txn_id !== undefined) {
			let wallet_main_balance = 0;
			let walletBalanceRequest = { 'user_id': user_id, 'merchant_id': merchant_id };
			const wallet_balance = await queryBuilder.getWalletBalanceQuery(walletBalanceRequest);

			if (wallet_balance) {
				if (wallet_balance.status == 1) {
					wallet_main_balance = wallet_balance.main_balance;
				}
			}

			let voucherResults = {
				'Code': '00',
				'mobile': postedData.mobile,
				'mid': postedData.mid,
				'tid': postedData.tid,
				'porderid': postedData.porderid,
				'vouchertype': postedData.vouchertype,
				'txnid': walletVchrCreditResults.order_guid,
				'balance': wallet_main_balance,
				'amount': amount,
				'txndate': moment().unix()
			}

			return voucherResults;
		} else {
			return statusCodeList[8];
		}
	} else if (returnVoucherData.ConsumeResult[0].ResultType.toLowerCase() == 'timeout') {
		return statusCodeList[10];
	} else {
		return statusCodeList[29];
	}
}

exports.getUniqueOrderIdValueV2 = async (voucherId = null, expDate = null) => {
	let txnGuid = 'MRVC' + moment().unix();

	let uniqueOrderIdRequest = {
		'txn_guid': txnGuid,
		'voucher_id_dcms': voucherId,
		'voucher_exp_date': expDate
	};

	const orderGuid = await queryBuilder.getUniqueOrderIdQuery(uniqueOrderIdRequest);

	if (orderGuid && orderGuid.status == 0) {

		const uniqueTxnId = await queryBuilder.checkVoucherIdAlreadyConsumed({ 'given_voucher_id_dcms': voucherId });
		if (uniqueTxnId && uniqueTxnId.status == 1) {
			return uniqueTxnId.txn_guid;
		} else {
			exports.getUniqueOrderIdValueV2(voucherId, expDate);
		}
	} else {
		return txnGuid;
	}
}

exports.dLinkVouchar = async (vchrCode, voucherId, userId, merchantId, txnGuid, porderId, merchantDetails, vouchagramComponent) => {

	const countVouchar = await queryBuilder.getWalletTxnUsingVoucher({ 'voucher_number': vchrCode + '%' });

	const updateFeild = {
		'txn_type': 'VOID',
		'txn_subtype': 'V',
		'voucher_id': null,
		'voucher_guid': null,
		'purpose': 'Dlink',
		'voucher_number': vchrCode + '_' + Object.keys(countVouchar).length,
		'porder_id': porderId + '_' + Object.keys(countVouchar).length,
		'action_by': userId,
		'updated': moment().format('YYYY-MM-DD HH:mm:ss')
	};
	const whereCondition = {
		'txn_guid': txnGuid,
		'merchant_id': merchantId
	};

	let updated = await queryBuilder.updateWalletTxnsData(updateFeild, whereCondition);

	if (updated && updated.affectedRows > 0) {
		let merchantData = { 'client_guid_merchant': merchantDetails.client_guid_merchant, 'client_password_merchant': merchantDetails.client_password_merchant, 'shopCode': merchantDetails.shopCode };

		const cancelVoucharDetails = await vouchagramComponent.cancelVoucher(vchrCode, merchantData);
		logs.wrapper_log('info', "vchrCode: [" + vchrCode + "] [rechargeValidVouchers] dLinkVouchar RESP \N" + JSON.stringify(cancelVoucharDetails));
		if (cancelVoucharDetails && cancelVoucharDetails.vCancelResult[0]['ResultType'] == 'SUCCESS') {
			await queryBuilder.updateUniqueTxnIds({ 'voucher_id_dcms': voucherId });
		}
	}

	return true;

}

exports.processVOIDByRefunds = async (user_id, merchant_id, postedData) => {
	let voidRequest = {
		'GIVEN_USER_ID': user_id,
		'GIVEN_MERCHANT_ID': merchant_id,
		'GIVEN_TXN_GUID': postedData.drtxnid,
		'GIVEN_PORDER_ID': postedData.drorderid,
		'GIVEN_DESC': postedData.desc,
		'GIVEN_TIMEOUT': 0
	};
	const walletTransactionVoid = await queryBuilder.walletDebitTransactionVoid(voidRequest);

	if (!helper.isEmpty(walletTransactionVoid) && walletTransactionVoid.msg == 'Success') {
		let voidResults = {
			'Code': '00',
			'mid': postedData.mid,
			'tid': postedData.tid,
			'porderid': postedData.porderid,
			'drorderid': postedData.drorderid,
			'txnstatus': 'Success',
			'txnid': postedData.drtxnid,
			'txndate': moment().unix()
		}

		return voidResults;
	} else {
		return statusCodeList[8];
	}
}

exports.processCreditNote = async (user_id, merchant_id, orderId, valid_till, postedData) => {
	let creditNoteRequest = {
		'given_user_id': user_id,
		'given_merchant_id': merchant_id,
		'given_txn_guid': orderId,
		'given_porderid': postedData['porderid'],
		'given_amount': postedData['amount'],
		'given_source': postedData['source'],
		'var_valid_from': moment().format('YYYY-MM-DD'),
		'var_valid_till': valid_till,
		'var_purpose': postedData['desc'],
		'given_bill_no': postedData['billno'],
		'given_tid': postedData['tid']
	};

	const walletCreditBrand = await queryBuilder.walletCreditByBrand(creditNoteRequest);

	if (!helper.isEmpty(walletCreditBrand) && walletCreditBrand.credit_txn_id != undefined) {

		let creditNoteResults = {
			'Code': '00',
			'mid': postedData.mid,
			'tid': postedData.tid,
			'porderid': postedData.porderid,
			'txnstatus': 'Success',
			'txnid': walletCreditBrand.order_guid,
			'txndate': moment().unix()
		}

		return creditNoteResults;
	} else {
		return statusCodeList[8];
	}
}

exports.processRefunds = async (user_id, merchant_id, postedData) => {
	let refundsRequest = {
		'GIVEN_USER_ID': user_id,
		'GIVEN_TXN_GUID': postedData.drtxnid,
		'GIVEN_MERCHANT_ID': merchant_id,
		'GIVEN_AMOUNT': postedData.amount,
		'GIVEN_PORDER_ID': postedData.porderid,
		'GIVEN_DESC': postedData.desc
	};

	const reverseData = await queryBuilder.reverseWalletDebitTransactionV5(refundsRequest);

	if (!helper.isEmpty(reverseData)) {

		if (reverseData.msg == 'Duplicate') {
			return {
				'Code': '11',
				'mid': postedData.mid,
				'tid': postedData.tid,
				'porderid': postedData.porderid,
				'drorderid': postedData.drorderid,
				'txnstatus': 'Failed',
				'txndate': moment().unix()
			};
		} else if (reverseData.msg == 'Success') {
			return {
				'Code': '00',
				'mid': postedData.mid,
				'tid': postedData.tid,
				'porderid': postedData.porderid,
				'drorderid': postedData.drorderid,
				'txnstatus': 'Success',
				'txnid': reverseData.order_guid,
				'txndate': moment().unix()
			};
		} else {
			return statusCodeList[13];
		}
	} else {
		return statusCodeList[8];
	}
}

exports.parameterDecryption = (enc_payload, secret_key, secret_iv) => {

	if (enc_payload !== undefined && typeof enc_payload == "string") {
		let decipher = crypto.createDecipheriv('aes-256-cbc', secret_key, secret_iv);
		let decrypted = decipher.update(enc_payload, 'base64', 'utf8');
		let plainPayload = JSON.parse((decrypted + decipher.final('utf8')));

		if (plainPayload instanceof Object) {
			return plainPayload;
		}
	}
	return false;
}

exports.parameterEncryption = (payload, secret_key, secret_iv) => {
	let cipher = crypto.createCipheriv('aes-256-cbc', secret_key, secret_iv);
	let encrypted = cipher.update(payload, 'utf8', 'base64');
	encrypted += cipher.final('base64');
	return encrypted;
}

exports.obj_key_case_change = (obj, case_change) => {
	let all_cases = {
		'CASE_LOWER': (key) => { return key.toLowerCase() },
		'CASE_UPPER': (key) => { return key.toUpperCase() }
	};
	let copy_obj = new Object;
	Object.entries(obj).forEach(([key, value]) => { copy_obj[all_cases[case_change](key)] = value; });
	return copy_obj;
}

exports.isValidMobileNum = (mobile) => {
	return helper.isEmpty(mobile) ? false : /^[6-9]{1}([0-9]{9,9})$/.test(mobile) ? true : false;
}

exports.piEncryption = (pidata, blockSize = 256) => {
	const piConfig = config.getPIencdec();
	let secret_key = piConfig['key'];
	let secret_iv = piConfig['iv'];

	let cipher = crypto.createCipheriv('aes-256-cbc', secret_key, secret_iv);
	let encrypted = cipher.update(pidata, 'utf8', 'base64');
	encrypted += cipher.final('base64');
	return encrypted;
}

exports.piDecryption = (encdata, blockSize = 256) => {
	const piConfig = config.getPIencdec();
	let secret_key = piConfig['key'];
	let secret_iv = piConfig['iv'];

	let decipher = crypto.createDecipheriv('aes-256-cbc', secret_key, secret_iv);
	let decrypted = decipher.update(encdata, 'base64', 'utf8');
	decrypted = (decrypted + decipher.final('utf8'));
	return decrypted;
}

exports.ccMasking = (number, maskingCharacter = 'X') => {
	return number.substring(0, 2) + maskingCharacter.repeat(number.length - 4) + number.substring(number.length - 2);
}

