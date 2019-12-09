-- Up
CREATE TABLE Process (ProcessID INTEGER PRIMARY KEY, ProcessName TEXT);
CREATE TABLE PropertyType (PropertyTypeID INTEGER PRIMARY KEY, PropertyTypeName TEXT);
CREATE TABLE Prices (PropertyID TEXT, PropertyTypeID INTEGER, Address TEXT, DynamicDisplayPrice DECIMAL(10,5), BasePrice DECIMAL(10,5), Timestamp INTEGER);
CREATE TABLE ProcessingState (ProcessingStateID INTEGER, ProcessingStateName TEXT);
CREATE TABLE Notifications (PropertyID INTEGER, PropertyTypeID INTEGER, Address TEXT, Message TEXT, ProcessingStateID INTEGER, CreatedTimestamp INTEGER, ProcessedTimestamp INTEGER, PRIMARY KEY(PropertyID, PropertyTypeID));
CREATE TABLE LastReadState (ProcessID INTEGER PRIMARY KEY, Value INTEGER);
CREATE TABLE Error (ProcessID INTEGER, Error TEXT, CreatedTimestamp INTEGER);

INSERT INTO Process (ProcessName) VALUES ('UNKNOWN');
INSERT INTO Process (ProcessName) VALUES ('PropertyNotificationService');
INSERT INTO Process (ProcessName) VALUES ('EmailService');
INSERT INTO Process (ProcessName) VALUES ('PricingService');

INSERT INTO ProcessingState (ProcessingStateID, ProcessingStateName) VALUES(0, 'Unprocessed');
INSERT INTO ProcessingState (ProcessingStateID, ProcessingStateName) VALUES(1, 'Sent');
INSERT INTO ProcessingState (ProcessingStateID, ProcessingStateName) VALUES(2, 'Cancelled');

INSERT INTO PropertyType (PropertyTypeName) VALUES('UNKNOWN');
INSERT INTO PropertyType (PropertyTypeName) VALUES('home');
INSERT INTO PropertyType (PropertyTypeName) VALUES('apartment');

-- Down 
