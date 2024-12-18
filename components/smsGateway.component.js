
const { callAPI } = require("../helpers/helper");
const { customConfig } = require("../config/custom.config");
const logs = require("../logs");
const xml2js = require('xml2js');
const queryBuilder = require("../helpers/queryBuilderHelper");

const sendOTPSMS = async (mobile, otp, mode) => {
    const rawPayload = {
        MobileNo: mobile,
        Mode: mode,
        OTP: otp,
        feedid: customConfig.SMS_OTP_API.FEEDID,
        senderid: customConfig.SMS_OTP_API.SENDERID
    };

    logs.wrapper_log('info', 'SMS Request ' + JSON.stringify(rawPayload));

    const reqHeaders = {
        'Content-Type': 'application/json',
        username: customConfig.SMS_OTP_API.USERID,
        password: customConfig.SMS_OTP_API.PASSWORD
    };

    let response = await callAPI(customConfig.SMS_OTP_API.URL, 'POST', reqHeaders, rawPayload, 61000);
    logs.wrapper_log('info', 'SMS response ' + JSON.stringify(response));
    return response;
}

const sendSMS = async (mobile, msg, encMobile, apiName) => {
    const rawPayload = {
        To: mobile,
        username: customConfig.SMS_API.USERNAME,
        password: customConfig.SMS_API.PASSWORD,
        feedid: customConfig.SMS_API.FEEDID,
        senderid: customConfig.SMS_API.SENDERID,
        Text: msg,
        time: ''
    };

    logs.wrapper_log('info', 'SMS Request ' + JSON.stringify(rawPayload));

    const reqHeaders = {};

    let smsResponse = await callAPI(customConfig.SMS_API.URL, 'GET', reqHeaders, null, 61000, rawPayload);

    logs.wrapper_log('info', 'SMS response ' + JSON.stringify(smsResponse));
    // Parsing XML string to JavaScript object
    xml2js.parseString(smsResponse, (err, result) => {
        if (err) {
            console.error(err);
            return;
        }

        // Now 'result' contains the JavaScript object representation of the XML
        let tid = (result?.RESULT?.MID[0]['$'].TID) ? result?.RESULT?.MID[0]['$'].TID : '';
        const params = {
            "mobile": encMobile,
            "message": msg,
            "response_id": tid,
            "api_name": apiName
        };
        queryBuilder.createRecord('message_logs', params);
    });

    return smsResponse;
}

module.exports = { sendOTPSMS, sendSMS };