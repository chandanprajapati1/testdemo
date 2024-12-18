exports.getStatusCodes = {
	'0': {
		'ResultType': 'Success',
		'Code': '00',
		'Message': 'SUCCESS.',
	},
	'1': {
		'ResultType': 'error',
		'Code': '01',
		'Message': 'Parameters are mandatory.',
	},
	'2': {
		'ResultType': 'error',
		'Code': '02',
		'Message': 'Access denied.',
	},
	'3': {
		'ResultType': 'error',
		'Code': '03',
		'Message': 'Invalid Header Credentials.',
	},
	'4': {
		'ResultType': 'error',
		'Code': '04',
		'Message': 'User already registerd.',
	},
	'5': {
		'ResultType': 'error',
		'Code': '05',
		'Message': 'Values of parameters are not in proper format.',
	},
	'6': {
		'ResultType': 'error',
		'Code': '06',
		'Message': 'Values have been tampered. Please contact administrator.',
	},
	'7': {
		'ResultType': 'error',
		'Code': '07',
		'Message': 'IP not validated.',
	},
	'8': {
		'ResultType': 'error',
		'Code': '08',
		'Message': 'Something went wrong. Please try later!',
	},
	'9': {
		'ResultType': 'error',
		'Code': '09',
		'Message': 'OTP not validated.',
	},
	'10': {
		'ResultType': 'error',
		'Code': '10',
		'Message': 'Time out. Please contact administrator.',
	},
	'11': {
		'ResultType': 'error',
		'Code': '11',
		'Message': 'Duplicate Transaction Request.',
	},
	'12': {
		'ResultType': 'error',
		'Code': '12',
		'Message': 'Duplicate Reversal Transaction Request.',
	},
	'13': {
		'ResultType': 'error',
		'Code': '13',
		'Message': 'Invalid Transaction.',
	},
	'14': {
		'ResultType': 'error',
		'Code': '14',
		'Message': 'Exception occurred. Please contact administrator.',
	},
	'15': {
		'ResultType': 'error',
		'Code': '15',
		'Message': 'Invalid json format.',
	},
	'16': {
		'ResultType': 'error',
		'Code': '16',
		'Message': 'Invalid Delivery Details.',
	},
	'17': {
		'ResultType': 'error',
		'Code': '17',
		'Message': 'Invalid Transaction.',
	},
	'18': {
		'ResultType': 'error',
		'Code': '18',
		'Message': 'Action type can only be 0 or 1.',
	},
	'19': {
		'ResultType': 'error',
		'Code': '19',
		'Message': 'Invalid Protocol.',
	},
	'20': {
		'ResultType': 'error',
		'Code': '20',
		'Message': 'Invalid MID/MOBILE.',
	},
	'21': {
		'ResultType': 'error',
		'Code': '21',
		'Message': 'Your account has been temporarily blocked for 1 minutes',
	},
	'24': {
		'ResultType': 'error',
		'Code': '24',
		'Message': 'Only post request is allowed',
	},
	'25': {
		'ResultType': 'error',
		'Code': '25',
		'Message': 'Invalid User details provided as input.',
	},
	'26': {
		'ResultType': 'error',
		'Code': '26',
		'Message': 'Invalid User Mobile/Pin.',
	},
	'27': {
		'ResultType': 'error',
		'Code': '27',
		'Message': 'Voucher code is already consumed.',
	},
	'28': {
		'ResultType': 'error',
		'Code': '28',
		'Message': 'Voucher code is expired.',
	},
	'29': {
		'ResultType': 'error',
		'Code': '29',
		'Message': 'Voucher number does not exists, please re-check.',
	},
	'30': {
		'ResultType': 'error',
		'Code': '30',
		'Message': 'Voucher code is invalid or blocked.',
	},
	'31': {
		'ResultType': 'error',
		'Code': '31',
		'Message': 'Invalid user details provided for pin reset.',
	},
	'32': {
		'ResultType': 'error',
		'Code': '32',
		'Message': 'Voucher details not found.',
	},
	'37': {
		'ResultType': 'error',
		'Code': '37',
		'Message': 'Insufficient Balance.',
	},
	'38': {
		'ResultType': 'error',
		'Code': '38',
		'Message': 'Voucher code is Expired.',
	},
	'39': {
		'ResultType': 'error',
		'Code': '39',
		'Message': 'Voucher code is already consumed.',
	},
	'40': {
		'ResultType': 'error',
		'Code': '40',
		'Message': 'You are on the wrong step. please check your balance and verify the otp first',
	},
	'41': {
		'ResultType': 'error',
		'Code': '41',
		'Message': 'Use voucher limit exceeded, You can not use more than {max_voucher_use_limit} vouchers.',
	},
	'42': {
		'ResultType': 'error',
		'Code': '42',
		'Message': 'You are not authorized for this action.',
	},
	'49': {
		'ResultType': 'error',
		'Code': '49',
		'Message': 'Amount can\'t be more than {dynamic_amount}.',
	},
	'51': {
		'ResultType': 'error',
		'Code': '51',
		'Message': 'Programs not available!',
	},
	'52': {
		'ResultType': 'error',
		'Code': '52',
		'Message': 'Previous Bill is not settled!',
	},
	'53': {
		'ResultType': 'error',
		'Code': '53',
		'Message': "Epay is disabled for  Hush puppies",
	},
	'54': {
		'ResultType': 'error',
		'Code': '54',
		'Message': "You have temporarily blocked for {dynamic_min} min.",
	},
	'55': {
		'ResultType': 'error',
		'Code': '55',
		'Message': "You have exceeded max recharge limit.",
	},
	'56': {
		'ResultType': 'error',
		'Code': '56',
		'Message': "Invalid Request or record not found. Please contact adminstrator.",
	}
};


exports.customConfig = {
	'CONTAINER_KEY': {
		'KEY': 'HSDGHSDG!@##$%^&*21DJB65454$#@!@_CONT'
	},
	'CONSUMER_KEY': {
		'KEY': 'TFREN!$#@%^2145698MNBCVXCSW!@#$#_CONS'
	},
	'SMS_OTP_API': {
		'URL': 'https://communication.gyftr.com/communication/API/v1/send_otp',
		'USERID': 'azlwOXCULyrihN08',
		'PASSWORD': 'Plokijuhyg@1234',
		'FEEDID': '391485',
		'SENDERID': 'GYFTRR'
	},
	'SMS_API': {
		'URL': 'http://bulkpush.mytoday.com/BulkSms/SingleMsgApi',
		'USERNAME': '9289210570',
		'PASSWORD': 'jttpg',
		'FEEDID': '376227',
		'SENDERID': 'GYFTRR'
	},
	'Vouchagram': {
		'BASE_URL': 'https://pos-staging.vouchagram.net/service/restserviceimpl.svc/',
		'merchantUid': '49F79EB8-061D-4A6F-B7FA-E5DC1088DBBE',
		'merchantPassword': 'DpWB+dGrxKnrWEEXPUZC/A==',
		'shopCode': 'webtest'
	},
	'VouchagramCRM': {
		'BASE_URL': 'https://crmservices.vouchagram.net/Api/',
		'merchantUid': '49F79EB8-061D-4A6F-B7FA-E5DC1088DBBE',
		'merchantPassword': 'DpWB+dGrxKnrWEEXPUZC/A==',
		'UserId': 'rJBOnxTVPPIOetdA/J7QaQ==',
		'Password': 'rJBOnxTVPPIOetdA/J7QaQ==',
		'shopCode': 'webtest'
	},
	'EPAY_URL': 'https://consumer.gyftr.net/'
};
exports.dbConfig = {
	host: "commondatabase.cluster-cigfmtlfyoea.ap-south-1.rds.amazonaws.com",
    user: "awswebuserdev",
    password: "orDe#we%usr!22",
    database: "merchantpay",
	debug: false,
	multipleStatements: false,
	dateStrings: true,
	connectTimeout: 10000
};

exports.constantData = {
	INVALID_ATTEMPT_INITIAL_TIME_DELAY_SECONDS: 60,
	INVALID_ATTEMPT_FINAL_TIME_DELAY_SECONDS: 120,
};
exports.containerRedemptionType = ['Normal', 'Partial', 'Full'];
exports.apiSources = ['W', 'P', 'A', 'W-Container', 'W-Consumer', 'W-Widget'];

exports.constantData = {
	INVALID_ATTEMPT_INITIAL_TIME_DELAY_SECONDS: 60,
	INVALID_ATTEMPT_FINAL_TIME_DELAY_SECONDS: 120,
};
exports.PORT = '3735';

exports.getPIencdec = () => {
	return { 'key': 'XFHYT4SMtZ8Q732VtVDGUMQ5YePTdQuB', 'iv': '9811106119541541' };
};

exports.getVoucherencdec = {
	'key': 'i0p7wrgd241k1shiyhl8h0zp', 'iv': 'TQRmWYIS', 'reEncKey': 'aZSRcsk6Qf7Gmlona26fkDMB', 'reEnciv': 'bXrcu7Zz'
};