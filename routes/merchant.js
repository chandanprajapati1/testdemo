const express = require('express');
const router = express.Router();
const merchantServices = require("../controllers/merchantServicesController");

router.post("/generateOtp", merchantServices.generateOTP);
router.post("/getWalletBalance", merchantServices.getWalletBalance);
router.post("/getWalletTxnStatus", merchantServices.getWalletTxnStatus);
router.post("/getCjTxnsStatus", merchantServices.getCjTxnsStatus);
router.post("/updateBillingDetails", merchantServices.updateBillingDetails);
router.post("/voucherDetails", merchantServices.voucherDetails);
router.post("/removeVoucher", merchantServices.removeVoucher);
router.post("/loadWallet", merchantServices.loadWallet);
router.post("/rechargeWallet", merchantServices.rechargeWallet);
router.post("/walletRedemption", merchantServices.walletRedemption);
router.post("/walletReversal", merchantServices.walletReversal);
router.post("/refunds", merchantServices.refunds);

module.exports = router;