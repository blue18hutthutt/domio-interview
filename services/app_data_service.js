const PROPERTY_TYPES_NAME_KEY = "PropertyTypesByName";
const PROCESSES_BY_NAME_KEY = "ProcessesByName";

// A convenient way to centrally access common reference data stored in a data store.
// Stores this data in a cache (in-memory for here but would be distributed eg Redis
// in a real app). This component initializes asynchronously therefore it might be
// invoked before it's ready, thus the accessor methods are async to reflect this. 
// Also in real life, we might also have a separate thread that polls and invalidates
// any data in the cache that is stale. In this simple trivial project, this mostly
// serves as a heavy-weight version of serving out enums from a database
module.exports.AppDataService = class AppDataService {
    constructor(persistenceStore, cacheStore) {
        this.DB = persistenceStore;
        this.cache = cacheStore;
        this.isLoading = true;
        this.queryInitializerQueue = [];
        this.cache = cacheStore;
        this.initializeData();
        this.isLoadingCache = true;
    }

    // starts reading all the various static reference data - especially useful for resolving
    // between identifiers and names that correspond to values in look-up tables
    async initializeData() {
        await this.DB.executeQuery("SELECT ProcessID, ProcessName FROM Process").then(data => {
            if(data) {
                const processesByName = {}
                data.forEach(row => {
                    processesByName[row.ProcessName] = row.ProcessID;
                });
                this.cache.set(PROCESSES_BY_NAME_KEY, processesByName);
            }
        });

        await this.DB.executeQuery("SELECT PropertyTypeID, PropertyTypeName FROM PropertyType").then(data => {
            if(data) {
                const propertyTypesByName = {}
                data.forEach(propType => {
                    propertyTypesByName[propType.PropertyTypeName] = propType.PropertyTypeID;
                });
                this.cache.set(PROPERTY_TYPES_NAME_KEY, propertyTypesByName);
            }
        });

        this.isLoading = false; // go ahead and honor all new requests while we backfill old requests
        this.flushInitializerQueues();
    }

    // fulfill all the promises to code that requested data when this was still initializing
    async flushInitializerQueues() {
        for(let i = 0; i < this.queryInitializerQueue.length; i++) {
            const request = this.queryInitializerQueue[i];
            const result = await request.method();
            request.resolve(result);
        }
        this.queryInitializerQueue = [];
    }

    // returns a PropertyTypeID based on string
    async PropertyTypesByName() {
        if(this.isLoading) {
            const queryPromise = new Promise((resolve, reject) => {
                console.log("Deferring request for Property Types until DB is ready");
                this.queryInitializerQueue.push({ method: this.PropertyTypesByName.bind(this), resolve});
            });
            return queryPromise;
        }
        else {
            return this.cache.get(PROPERTY_TYPES_NAME_KEY);
        }
    }

    // returns a uniquely identifying ProcessID based on the process (class) name
    async ProcessesByName() {
        if(this.isLoading) {
            const queryPromise = new Promise((resolve, reject) => {
                console.log("Deferring request for Processes until DB is ready");
                this.queryInitializerQueue.push({ method: this.ProcessesByName.bind(this), resolve});
            });
            return queryPromise;
        }
        else {
            return this.cache.get(PROCESSES_BY_NAME_KEY);
        }
    } 
}