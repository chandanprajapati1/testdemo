const winston = require("winston");
const filename = new Date().toJSON().slice(0, 10);
exports.bankingLog = (level, message) => {
	let logger = exports._log('./logs/banking_rewardz/' + filename + '.log');
	logger.log(level, message);
};

exports.wrapper_log = (level, message) => {
	let logger = exports._log('./logs/wrapper_log/' + filename + '.log');
	logger.log(level, message);
};

exports.gyftr_api = (level, message) => {
	let logger = exports._log('./logs/gyftr_api/' + filename + '.log');
	logger.log(level, message);
};


exports._log = (log_file) => {
	let logger = winston.createLogger({
		level: "debug",
		format: winston.format.json(),
		transports: [new winston.transports.File({ filename: log_file, }),],
	});

	return logger;
};
