// this exists to bridge the schema between an outside system eg REST API vs internal schema as
// there are some differences in spelling, capitalization etc. this normalizes things. In a real
// app would likely use an ORM and have dedicated entity-classes
module.exports.Quote = class Quote {
    constructor(PropertyID, PropertyTypeID, Address, DynamicDisplayPrice, BasePrice, Timestamp) {
        this.PropertyID = PropertyID;
        this.PropertyTypeID = PropertyTypeID;
        this.Address = Address;
        this.DynamicDisplayPrice = DynamicDisplayPrice;
        this.BasePrice = BasePrice;
        this.Timestamp = Timestamp;
    }
}