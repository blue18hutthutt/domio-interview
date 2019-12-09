const nodemailer = require('nodemailer');

// a service that constantly reads from a Notification queue and does it's best to
// send them out - uses MailTrap service, which is extremely sensitive to high
// request rates
module.exports.EmailService = class EmailService {
    constructor(serverAddress, port, username, password, sentFrom, logger, appService, persistenceStore, propertyTypesHandlerRegistry) {
        this.transport = nodemailer.createTransport({
            host: serverAddress,
            port: port,
            auth: {
                user: username,
                pass: password
            }
        });
        this.logger = logger;
        this.appService = appService;
        this.DB = persistenceStore;
        this.processID = null;
        appService.ProcessesByName().then(result => {
            this.processID = result ? result[this.constructor.name] : null;
        });

        this.notificationsTimer = null;


        // need to send e-mails on a delayed thread because otherwise Mailtrap will complain
        // I'm spamming them
        this.outboxInterval = 500;
        this.outbox = [];
        this.outboxErrorLast = false;
        this.listeners = [];
        this.outboxTimer = null;
        this.propTypeHandlers = propertyTypesHandlerRegistry;
    }

    start() {
        this.outboxTimer = setInterval(this.sendOutboxMails.bind(this), this.outboxInterval);
        this.notificationsTimer = setInterval(this.processPendingNotifications.bind(this), this.outboxInterval);
    }

    stop() {
        clearInterval(this.outboxTimer);
        clearInterval(this.notificationsTimer);
    }


    // runs on a timer and will only attempt to send a single e-mail at a time because
    // of the sensitivity of the Mailtrap server
    sendOutboxMails() {
        try {
            if (this.outbox.length > 0 && !this.isWaiting) {
                console.log(`Attempting to send ${this.outbox[0].Address}`);
                this.transport.sendMail(this.outbox[0], async (err, info) => {
                    if (err) {
                        // throttle for the next tick until the e-mail server calms down
                        this.logger.error(this.processID, `${this.constructor.name}: ${err}`);
                        this.outboxErrorLast = true;
                        this.outboxInterval *= 2;
                        this.stop();
                        this.start();            
                    }
                    else {
                        // otherwise we were successful, now callback anyone who is listening so they
                        // can mark the message as processed / confirmed and re-throttle back up
                        if(this.outbox[0].callback) {
                            await this.outbox[0].callback(this.outbox[0]);
                        }
                        this.outbox.shift(); 
                        if(this.outboxErrorLast) {
                            this.outboxErrorLast = false;
                            this.outboxInterval = 500;
                            this.stop();
                            this.start();
                        }
                        this.showOutbox();
                    }
                    this.isWaiting = false;
                });
                this.isWaiting = true;
            }
        }
        catch(err) {
            // MailTrap is probably complaining I'm spamming them - back off for a bit
            this.logger.error(this.processID, `${this.constructor.name}: ${err}`);
            this.outboxErrorLast = true;
            this.outboxInterval *= 2;
            this.stop();
            this.start();
        }
    }
    // only get the most recent, unprocessed notifications across all properties since the
    // Email Service might've been down there may have accummulated many notifications
    // so we compact and only apply our rules against the latest unsent notification
    async processPendingNotifications() {
        try {
            await this.DB.executeQuery("SELECT PropertyID, PropertyTypeID, Address, Message, CreatedTimestamp FROM Notifications WHERE ProcessingStateID = 0 GROUP BY PropertyID, PropertyTypeID HAVING MAX(CreatedTimestamp) ORDER BY CreatedTimestamp ASC").then(data => {
                if (data && data.length > 0) {
                    for (let i = 0; i < data.length; i++) {
                        // get the notification handler for this property type and let it take care of how it should be handled
                        const handlers = this.propTypeHandlers.getHandlerForPropertyType(data[i].PropertyTypeID);
                        handlers.forEach(handler => {
                            handler.dispatchNotifications(data[i]);
                        });
                    }
                }
                //console.log(`${this.constructor.name} queued ${data.length} price notifications`);
            });
        }
        catch (err) {
            if (this.logger) {
                this.logger.error(this.processID, `${this.constructor.name}: ${err}`);
            }
            throw err;
        }
    }

    // this originally sent mail synchronously until Mailtrap started freaking out, instead
    // I simply enqueue it to an outbox instead and let the outbox timer thread process it
    sendEmail(to, from, {Message, PropertyID, PropertyTypeID, Address, CreatedTimestamp}, callback) {
        // check for older notification and clear it
        for(let i = 0; i < this.outbox.length; i++) {
            if(this.outbox[i].PropertyID === PropertyID && this.outbox[i].PropertyTypeID === PropertyTypeID) {
                // a newer version of a price notification has become available, remove the older notification,
                // otherwise we will become backed-up with notifications for the same property, and the poor
                // recipient will be spammed to death with obsolete alerts
                //this.logger.info(this.processID, `${this.constructor.name}: A newer price update for ${Address} is available`);
                this.outbox.splice(i, 1);
                break;
            }
        }

        this.outbox.push({
            PropertyID,
            PropertyTypeID,
            CreatedTimestamp,
            Address,
            callback,
            from,
            to,
            subject: `Price Update for ${Address}`,
            text: Message
        });
    }

    // diagnostic method for showing contents of the outbox queue
    showOutbox() {
        if(this.outbox.length > 0) {
            let infoMsg = `${this.constructor.name}: [`;
            for(let i = 0; i < this.outbox.length; i++) {
                infoMsg = infoMsg + `${this.outbox[i].Address}${i === this.outbox.length - 1 ? ']' : ',' } `;
            }
            infoMsg = infoMsg + "remain in the outbox queue";
            this.logger.info(this.processID, infoMsg);
        }
    }
}

// a wrapper to convert the EmailService to handle our app-model specific parameters -
// initially the EmailService was relatively 'pure' but late in the game I discovered
// some issues that required sharing app-state / callbacks that made this abstraction
// leaky at best. Definite candidate to refactor - maybe emit a sent event rather than
// accept a callback
module.exports.EmailServiceNotificationAdapter = (to, from, emailService) => (notification, callback) => {
    emailService.sendEmail(to, from, notification, callback);
}