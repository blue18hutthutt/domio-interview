const SQLite = require('sqlite');
const { PersistenceStore } = require("./persistence_store");

// simple wrapper over the unfamilar SQLite API (never used it before) - since this
// API is promise-based, the class receives requests before the database has
// completed initializing on the next tick, so we enqueue requests then flush this
// queue of requests and return results once the DB has finished loading.
// NOTE: some reason couldn't get SQL parameters working with this API so had to rely
// on esaping parameters 
exports.SQLiteAdapter = class SQLiteAdapter {
    constructor(conn) {
        this.connectionString = conn;
        this.queryInitializerQueue = [];
        this.DB = null;
        SQLite.open(conn, {})
            .then(db => { 
                this.DB = db; 
                db.migrate()
                    .then(db => {
                        this.flushInitializerQueues();
                    })
                    .catch(err => {
                        console.log(err.message);
                        process.exit(1);
                    });
                })
            .catch(err => {
                console.log(err.message);
                process.exit(1); 
            });
    }

    async flushInitializerQueues() {
        for(let i = 0; i < this.queryInitializerQueue.length; i++) {
            const request = this.queryInitializerQueue[i];
            const result = await this.executeQuery(request.cmd, request.params);
            request.resolve(result);
        }
        this.queryInitializerQueue = [];
    }

    async executeQuery(cmd, params) {
        if(!this.DB) {
            const queryPromise = new Promise((resolve, reject) => {
                this.queryInitializerQueue.push({ cmd, params, resolve});
            });
            return queryPromise;
        }
        else {
            return this.DB.all(cmd, params);
        }
    }
}