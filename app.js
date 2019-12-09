const { DB, PricingService, PropertyNotificationService, AppDataService, LogService, EmailService } = require('./bootstrapper');

process.on('uncaughtException', function (err) {
    LogService.error(err);
})

// nice and simple :) the Bootstrapper does most of the heavy-lifting for wiring-up components
// and feeding dependencies leaving us with a fresh slate to start with
PricingService.start();
PropertyNotificationService.start();
EmailService.start();