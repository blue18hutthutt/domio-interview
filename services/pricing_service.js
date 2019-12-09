const { EventEmitter } = require('events');
const axios = require('axios');
const { Quote } = require('../models/quote');

const LATEST_PRICES_CACHE_KEY = "LATEST_PRICES_CACHE_KEY";
// polls every 5 seconds (default) for new prices and populates them into a Prices table
class PricingService extends EventEmitter {

    constructor(serviceUrl, interval, persistenceStore, appModel, logger) {
        super();
        this.serviceUrl = serviceUrl;
        this.interval = interval;
        this.timer = null;
        this.DB = persistenceStore;
        this.appModel = appModel;
        this.propertyTypesByName = null;
        this.isLoading = true;
        this.logger = logger;

        this.processID = null;
        appModel.ProcessesByName().then(result => {
            this.processID = result ? result[this.constructor.name] : null;
        });
    }

    async start() {
        this.propertyTypesByName = await this.appModel.PropertyTypesByName();
        this.timer = setInterval(this.fetchPrices.bind(this), this.interval);
    }

    stop() {
        if(this.timer) {
            clearTimeout(this.timer);
        }
    }

    async fetchPrices() {
        try {
            const response = await axios.get(this.serviceUrl);
            const latestPrices = (response.data && response.data.properties ? response.data.properties : []);
            const currentTime = Date.now();

            latestPrices.forEach(row => {
                const currentPropertyTypeID = this.propertyTypesByName[row.type] || 1; // look-up Property Type ID
                const quote = new Quote(row.id, currentPropertyTypeID, row.address, row.dynamicDisplayPrice, row.basePrice, currentTime);

                this.DB.executeQuery("INSERT INTO Prices (PropertyID, PropertyTypeID, Address, DynamicDisplayPrice, BasePrice, Timestamp) " + 
                    `VALUES('${this.DB.escapeParameter(quote.PropertyID)}', ${quote.PropertyTypeID}, '${this.DB.escapeParameter(quote.Address)}', ${quote.DynamicDisplayPrice}, ${quote.BasePrice}, ${currentTime})`);
                
                //this.emit("price_update", quote);
            });

            console.log(`${this.constructor.name}: fetched ${latestPrices.length} new price updates`);
        }
        catch(err) {
            if(this.logger) {
                this.logger.error(this.processID, `${this.constructor.name}: ${err}`);
            }
        }
    }
}

exports.PricingService = PricingService;