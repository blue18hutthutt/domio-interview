// simple log aggregator - currently have this configured to log to the console
// and SQLite table. Source is the ProcessID which should correspond to a known
// service in the Processes reference table for grouping exceptions by source
module.exports.LogService = class LogService {
    constructor(listeners) {
        this.listeners = listeners;
    }

    
    error(source, errorDetails) {
        if(this.listeners) {
            for(let i = 0; i < this.listeners.length; i++) {
                this.listeners[i].error(source, errorDetails);
            }
        }
        else {
            console.error("ERROR: no log listeners defined");
        }
    }

    info(source, msg) {
        if(this.listeners) {
            for(let i = 0; i < this.listeners.length; i++) {
                this.listeners[i].info(source, msg);
            }
        }
        else {
            console.error("ERROR: no log listeners defined");
        }
    }
}