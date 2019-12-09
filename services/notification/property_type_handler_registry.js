// helps abstract the mapping of property type notification handlers and
// property type IDs
module.exports.PropertyTypesHandlerRegistry = class PropertyTypesHandlerRegistry {
    constructor(propertyTypeHandlers) {
        this.notificationRegistry = {};

        if (propertyTypeHandlers && propertyTypeHandlers.length > 0) {
            propertyTypeHandlers.forEach(handler => {
                this.registerNotification(handler.PropertyTypeID, handler);
            })
        }
    }

    registerNotification(propertyTypeID, handler) {
        this.notificationRegistry[propertyTypeID] = this.notificationRegistry[propertyTypeID]
            ? this.notificationRegistry[propertyTypeID].concat(handler)
            : [handler];
    }

    getHandlerForPropertyType(propertyTypeID) {
        return this.notificationRegistry[propertyTypeID] || [];
    }
}