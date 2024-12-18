const config = require("../config/custom.config");
const axios = require('axios');
const element = require("./index");
const logs = require("../logs");

const statusCodeList = config.getStatusCodes;

exports.sendResponse = async (statusCode = null, paramEnc = null, hashKey = null, hashIv = null, logKey = 'FINALRESPONSE', data = null, strreplace = null) => {
    let response = {};

    if (statusCode !== null) {
        // Get status Code and Message
        response = statusCodeList[Number(statusCode)];
        // remove ResultType key from object
        delete response.ResultType;
    }

    if (data) {
        response = Object.assign({}, response, data);
    }

    if (strreplace) {
        //search is a object than
        response.Message = exports.str_replace(strreplace, '', response.Message);
    }

    response = await element.obj_key_case_change(response, 'CASE_UPPER');

    logs.wrapper_log('info', logKey + JSON.stringify(response));
    if (paramEnc == "y") {
        let encParameters = await element.parameterEncryption(JSON.stringify(response), hashKey, hashIv);
        return {
            data: encParameters
        };
    } else {

        return response;
    }

}

exports.generateRandomNumber = (length = 4) => {
    return Math.floor(Math.pow(10, length - 1) + Math.random() * (Math.pow(10, length) - Math.pow(10, length - 1) - 1));
}

exports.isNumeric = (value) => {
    return !isNaN(parseFloat(value)) && isFinite(value);
}

// replacments of character
exports.str_replace = (search, replace, str) => {
    if (typeof search === 'object') {
        for (var key in search) {
            if (search.hasOwnProperty(key)) {
                str = str.replace(new RegExp(key, 'g'), search[key]);
            }
        }
    } else if (Array.isArray(search)) {
        for (var i = 0; i < search.length; i++) {
            str = str.replace(new RegExp(search[i], 'g'), replace);
        }
    } else {
        str = str.replace(new RegExp(search, 'g'), replace);
    }
    return str;
}

// Hit the API: Generic method

exports.callAPI = async (url, method = 'POST', headers, data = null, timeout = 60000, params = null) => {
    try {
        if (method == 'GET') {
            headers['Content-Type'] = 'application/json';
        }
        const { data: respData } = await axios({
            url: url,
            method: method,
            timeout: timeout,
            headers: headers,
            data: data,
            params: params
        });
        return respData;
    } catch (err) {

        return err;
    }
}

exports.isEmpty = (variable) => {
    return (
        variable === undefined || // Check if variable is undefined
        variable === null ||      // Check if variable is null
        variable === '' ||        // Check if variable is an empty string
        (Array.isArray(variable) && variable.length === 0) || // Check if variable is an empty array
        (typeof variable === 'object' && Object.keys(variable).length === 0) // Check if variable is an empty object
    );
};

// module.exports = { sendResponse, generateRandomNumber, callAPI, isNumeric, str_replace };