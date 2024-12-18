const customConfig = require("../config/custom.config.js");
const mysql = require('mysql2');

class DB {
  constructor() {
    this.dbConfigs = customConfig.dbConfig;
  }

  async query(queryStr, replacements = {}) {

    try {

      var connection = mysql.createConnection(this.dbConfigs);

      connection.config.queryFormat = function (queryStr, replacements) {
        if (!replacements) return queryStr;

        return queryStr.replace(/\:(\w+)/g, function (txt, key) {
          if (replacements.hasOwnProperty(key)) {
            return connection.escape(replacements[key]);
          }
          return txt;
        }.bind(connection));
      }

      const result = await connection.promise().query(queryStr, replacements);

      return result;
    } catch (err) {
      console.log('DB_QUERY_ERR', err);
      return false;
    } finally {
      connection.end();
    }
  }
}

module.exports = DB;