const { Quote } = require('../../models/quote');

// This main job of this service is to help generate notifications for properties based on
// new price quotes arriving in the Prices table. The service will read the latest price 
// for each unique property since the last-read timestamp. The service will update this 
// last-read timestamp on each successful tick so that if this service went down 
// indefinitely, it could still process the latest prices for each property since the last 
// read-time.
exports.PropertyNotificationService = class PropertyNotificationService {
    constructor(pricingService, storeAdapter, propertyTypeHandlersRegistry, interval, logger, appModel) {
        this.interval = interval;
        this.getLatestPricesTimer = null;
        this.DB = storeAdapter;
        this.logger = logger;
        this.pricingService = pricingService;

        // this creates too much coupling on the pricing service AND is synchronous which
        // can delay the pricing timer
        //this.pricingService.on("price_update", this.processPriceUpdate.bind(this));
        
        this.processID = null;
        this.appModel = appModel;
        this.propTypeHandlers = propertyTypeHandlersRegistry;
    }

    async start() {
        // repair state by processing updates of unread prices that've accummulated since last time notification service ran
        await this.appModel.ProcessesByName().then(result => {
            this.processID = result ? result[this.constructor.name] : null;
        });
        
        this.getLatestPricesTimer = setInterval(this.checkAndProcessPriceUpdates.bind(this), this.interval);
    }

    stop() {
        clearTimeout(this.getLatestPricesTimer);
    }

    // we keep track of the last timestamp we've successfully read + processed since so that if the Notification
    // service goes down, it can continue where it left off. We compact the prices so that we only deal with the
    // latest price for each property or else we could be processing ALOT of prices (and hence generating equally
    // many notifications) if we've been offline for awhile
    async getUnprocessedPrices(since) {
        try {
            const unprocessedPrices = [];
            const results = await this.DB.executeQuery(`SELECT PropertyID, PropertyTypeID, Address, DynamicDisplayPrice, BasePrice, Timestamp FROM Prices WHERE Timestamp > ${since} GROUP BY PropertyID HAVING MAX(Timestamp) ORDER BY Timestamp ASC`);
            if (results) {
                results.forEach(data => {
                    unprocessedPrices.push(new Quote(data.PropertyID, data.PropertyTypeID, data.Address, data.DynamicDisplayPrice, data.BasePrice, data.Timestamp));
                });
            }
            return unprocessedPrices;
        }
        catch (err) {
            if (this.logger) {
                this.logger.error(this.processID, `${this.constructor.name}: ${err}`);
            }
            throw err;
        }
    }

    async getLastTimeRead() {
        const row = await this.DB.executeQuery(`SELECT Value FROM LastReadState WHERE ProcessID = ${this.processID}`);
        return row && row[0] ? row[0].Value : 0;
    }

    async updateLastTimeRead() {
        await this.DB.executeQuery(`INSERT OR REPLACE INTO LastReadState (ProcessID, Value) VALUES (${this.processID}, ${Date.now()})`);
    }

    async processPriceUpdate(quote) {
        if (!quote) return;

        try {
            const notifiers = this.propTypeHandlers.getHandlerForPropertyType(quote.PropertyTypeID);
            if (notifiers.length === 0) {
                console.log(`WARNING: no handler registered for: PropertyTypeID: ${quote.PropertyTypeID}`);
                return;
            }
            let didNotify = false;
            for (let i = 0; i < notifiers.length; i++) {
                if (notifiers[i].validateRule(quote)) {
                    const message = notifiers[i].generateNotificationMessage(quote);
                    // INSERT or REPLACE so we don't potentially end up with stacked notifications for one property
                    // eg if notification service goes down, new notifications may be generated while it's offline
                    // throughout the day every 5 seconds - when the notification service comes back up, it only wants
                    // to process the most recent notification for a property
                    await this.DB.executeQuery("INSERT OR REPLACE INTO Notifications (PropertyID, PropertyTypeID, Address, Message, ProcessingStateID, CreatedTimestamp) " +
                        `VALUES ('${this.DB.escapeParameter(quote.PropertyID)}', ${quote.PropertyTypeID}, '${this.DB.escapeParameter(quote.Address)}', '${this.DB.escapeParameter(message)}', 0, ${Date.now()})`);
                        didNotify = true;
                }
            }
            return didNotify;
        }
        catch (err) {
            if (this.logger) {
                this.logger.error(this.processID, `${this.constructor.name}: ${err}`);
            }
            throw err;
        }
    }

    async checkAndProcessPriceUpdates() {
        try {
            const lastTimestamp = await this.getLastTimeRead();
            const unprocessedPrices = await this.getUnprocessedPrices(lastTimestamp);
            let newNotifications = 0;
            for (let i = 0; i < unprocessedPrices.length; i++) {
                const result = await this.processPriceUpdate(unprocessedPrices[i]);
                if(result) {
                    newNotifications++;
                }
            }
            this.updateLastTimeRead();
            if(this.logger && unprocessedPrices.length > 0) {
                this.logger.info(this.processID, `${this.constructor.name}: queued ${newNotifications} new price notifications`);
            }
        }
        catch (err) {
            if (this.logger) {
                this.logger.error(this.processID, `${this.constructor.name}: ${err}`);
            }
            throw err;
        }
    }
}