const Quote = require('../../models/quote');

// this class associates multiple dispatchers (eg email, SMS, app-push etc.) with
// property type IDs. It also allows a configurable rule (similar to comparator)
// to be specified in order to make this class as flexible as possible in 
// associating property types, dispatchers, and rules
module.exports.PropertyTypeNotifier = class PropertyTypeNotifier {
    constructor(propertyTypeID, compareRule, databaseAdapter, appModel, logService) {
        this.PropertyTypeID = propertyTypeID;
        this.dispatchers = [];
        this.DB = databaseAdapter;
        this.appModel = appModel;
        this.propertyTypesByName = null;
        this.compareRule = compareRule;
        this.logService = logService;
    }

    registerDispatcher(dispatcher) {
        this.dispatchers.push(dispatcher);
    }

    // can be configured to use different rules at construction time
    validateRule(quote) {
        return this.compareRule(quote);
    }
    
    generateNotificationMessage(quote) {
        return `This is a notification to let you know that the home property at ${quote.Address} now has a dynamicDisplayPrice of ${quote.DynamicDisplayPrice}, and is now ${quote.DynamicDisplayPrice > quote.BasePrice ? "greater" : "less"} than the base price of ${quote.BasePrice}, as of ${new Date(quote.Timestamp).toLocaleString()}`;
    }

    // iterate through the list of dispatchers and apply them to the same out-going notification
    async dispatchNotifications(notification) {
        if(!this.dispatchers) return;

        for(let i = 0; i < this.dispatchers.length; i++) {
            this.dispatchers[i](notification, this.updateNotificationProcessed.bind(this));
        }
    }

    // update the notification as having been processed successfully and also clear out
    // and mark obsolete (ProcessingStateID = 2) records that were still in the pending queue
    // before they were replaced by a more recent price update. This helps keep the number of
    // outstanding notifications for the same property to only one, otherwise there could still
    // be remaining notifications further in the Notification queue for the same property
    async updateNotificationProcessed(notification) {
        await this.DB.executeQuery(`UPDATE Notifications SET ProcessingStateID = 1, ProcessedTimestamp = ${Date.now()} WHERE PropertyID = '${notification.PropertyID}' AND PropertyTypeID = ${notification.PropertyTypeID} AND CreatedTimestamp = ${notification.CreatedTimestamp}`);
        await this.DB.executeQuery(`UPDATE Notifications SET ProcessingStateID = 2 WHERE PropertyID = '${notification.PropertyID}' AND PropertyTypeID = ${notification.PropertyTypeID} AND ProcessingStateID = 0`);
        console.info(`Email sent for ${notification.Address}`);
        
    }
}

// I've added an extra check, that in-addition to the base condition passing, that the timestamp
// is less than a day old, afterall, we don't want to process price updates for unprocessed price
// requests (eg if NotificationService went down) that might be stale by now in a worst case scenario
module.exports.HomeNotificationRule = (quote) => { 
    return quote.DynamicDisplayPrice > quote.BasePrice && Date.now() - quote.Timestamp < 24 * 60 * 60 * 1000 };
module.exports.ApartmentNotificationRule = (quote) => { 
    return quote.DynamicDisplayPrice < quote.BasePrice && Date.now() - quote.Timestamp < 24 * 60 * 60 * 1000 };