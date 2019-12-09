module.exports.SQLiteLogger = class SQLiteLogger {
    constructor(storeProvider) {
        this.DB = storeProvider;
    }

    async error(source, details) {
        try {
            await this.DB.executeQuery(`INSERT INTO Error (ProcessID, Error, CreatedTimestamp) VALUES (${source}, '${this.DB.escapeParameter(details)}', ${Date.now()})`);
        }
        catch(error) {
            console.error(`ERROR: SQLiteLogger unable to log errors: ${error}`);
        }
    }

    info(source, details) {
        // do nothing
    }
}