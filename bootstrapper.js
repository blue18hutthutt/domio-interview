// a poor man's DI container - hardwired dependencies and initialization

const { CacheProvider, HashCache } = require('./services/cache');
const { PersistenceStore, SQLiteAdapter } = require('./services/persistence');
const { PricingService } = require('./services/pricing_service');
const { PropertyNotificationService, PropertyTypeNotifier, HomeNotificationRule, ApartmentNotificationRule, PropertyTypesHandlerRegistry } = require('./services/notification');
const { EmailService, EmailServiceNotificationAdapter } = require('./services/email_service');
const { AppDataService } = require('./services/app_data_service');
const { LogService, SQLiteLogger, ConsoleLogger } = require('./services/logging');

const fs = require('fs');
let config = JSON.parse(fs.readFileSync("config.json", 'utf8'));

const cache = new CacheProvider(new HashCache());
const persistenceStore = new PersistenceStore(new SQLiteAdapter(config["dbConnectionString"]));

const sqliteLogger = new SQLiteLogger(persistenceStore);
const consoleLogger = new ConsoleLogger();
const logService = new LogService([sqliteLogger, consoleLogger]);

const appDataService = new AppDataService(persistenceStore, cache);
const pricingService = new PricingService(config["serviceUrl"], Number(config["fetchIntervalMS"]), persistenceStore, appDataService, logService);


// these Property-Type handlers can support multiple-dispatch methods (eg Email, SMS, app push-notification)
// you simply would need to create the appropriate wrapper / adapter and register each dispatch method with
// each handler for each Property-Type
const homeNotifier = new PropertyTypeNotifier(2, HomeNotificationRule, persistenceStore, appDataService);
const apartmentNotifier = new PropertyTypeNotifier(3, ApartmentNotificationRule, persistenceStore, appDataService);

const propertyTypesHandlerRegistry = new PropertyTypesHandlerRegistry();
propertyTypesHandlerRegistry.registerNotification(2, homeNotifier);
propertyTypesHandlerRegistry.registerNotification(3, apartmentNotifier);
const propertyNotificationService = new PropertyNotificationService(pricingService, persistenceStore, propertyTypesHandlerRegistry, config["fetchIntervalMS"], logService, appDataService);

const emailService = new EmailService(config["emailServer"], config["emailPort"], config["emailUsername"], config["emailPassword"], config["emailSendFrom"], logService, appDataService, persistenceStore, propertyTypesHandlerRegistry);
const emailServiceWrapper = EmailServiceNotificationAdapter(config["adminEmail"], config["emailSendFrom"], emailService, logService);
homeNotifier.registerDispatcher(emailServiceWrapper);
apartmentNotifier.registerDispatcher(emailServiceWrapper);


exports.DB = persistenceStore;
exports.PricingService = pricingService;
exports.PropertyNotificationService = propertyNotificationService;
exports.AppDataService = appDataService;
exports.LogService = logService;
exports.EmailService = emailService;