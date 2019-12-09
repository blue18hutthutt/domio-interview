// simple abstraction for a data access layer - wasn't sure at the time if I was going
// to stick with SQLite (since I'd never used it) and didn't want to deal with the API
exports.PersistenceStore = class PersistenceStore {
    constructor(storeAdapter) {
        this.db = storeAdapter;
    }

    async executeQuery(cmd) {
        return this.db.executeQuery(cmd);
    }

    // needed to do this because I couldn't figure out how to get SQL parameters to work 
    // with the SQLite API so I just wanted to show I know the implication of an injection
    // attack and how to at least partially mitigate it 
    escapeParameter(param) {
        return (param && typeof(param) === 'string') ? param.toString().replace("'", "''") : param;
    }
}