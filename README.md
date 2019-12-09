# domio-pricing-service

The following is a sample pricing service for fetching property price-updates every 5 second interval,
with event-notification for price-updates according to configured rules.

## General Notes on architecture

The 3 main interacting components are the PricingService, PropertyNotificationService and EmailService.
The PricingService polls every 5 seconds and populates a Prices table. The PropertyNotificationService
then queries the Prices table and reads from it's last-read timestamp (which it syncs on every tick) and
queues up notifications in the Notifications table if the price quote satisfies the notification rules
configured for each property type (this mapping is configurable and multiple dispatch methods are
possible for each property type). The EmailService will then read all unprocessed notifications in the
same table, like a queue, and attempt to send each one out - theoretically there could be other services
eg SMSService, AppPushService etc. that could all process the same notification. 

The Email service also compacts the current notification / outbox queue since newer price quotes could 
have arrived since the original price quote was queued, afterall if a user hasn't received any 
notifications yet, they would likely only want the most recent ONE. 

I've intentionally kept this as light-weight as possible with absolute bare minimum external dependencies.
I've created naive abstractions for accessing cache, data store and notifications so that the underlying
implementation can be trivially changed by implementing a corresponding -adapter class, or creating a
decorator / higher order function to forward the calls appropriately. While the glorified hashmap cache
seems excessive, I wanted to demonstrate decoupled design principles (this is much more rewarding when
using TypeScript and being able to define interfaces and abstract classes) and how trivial it would be to
swap implementations to say, Redis (my fave). Generally all components use constructor dependency
injection to resolve their intra-app dependencies or method-based injection

Many of the components will initialize asynchronously but will still receive requests in the meantime,
eg the SQLite database connection opens async, but other tasks will eagerly make requests for data - to
handle this I queue such requests for such async-initialized components and honor them when ready. As a
result, the majority of the component API is async. As an example, the AppDataService, which contains
static reference data, will have other components 


## 3.) Now, let's assume that over time, we'll be adding dozens of different property types
## with their own messaging rules and messaging platforms (such as sms or push). How do we support
## this? Would you change anything in your implementation?

I've implemented the concept of a property-type notification system where a central NotificationService
has a bunch of specific rule-implementations registered for a particular [roperty-type. At present, 
there is only the 'home' and 'apartment' types, but it would be trivial to add a new row in the SQL
look-up table PrzopertyTypes. In my present design I've also allowed additional flexibility to add 
multiple handlers / dispatcher-types (eg SMS, e-mail, phone - these just aren't defined) for each 
property type. 

If we added a completely new messaging platform, we would simply need to create an adapter class and
plug it into our property type -> handler architecture. Where possible I've tried to be as decoupled 
as possible, even my EmailService is wired into the app- specific notification logic by using a HOF 
wrapper to adapt it's call signature (although admittedly this abstraction became a little leaky towards 
the end, on account of the Mailbin bug that forced me to hastily dump extra parameters into the API 
to make retries and compaction easier).

One thing I would definitely change is create a NotfificationType abstraction and a corresponding table
to create the possibility of creating configurable mappings between PropertyTypes and NotificationTypes
and create / register the appropriate handlers at runtime after reading from the store. 

Right now the rules are implemented by dedicated functions, similar to a comparator object, and injected
into the notification handlers. If we wanted to be really really general, we could create a mini-schema 
of operators (<,>,===,!=== etc.) and field names to compare and store that in a persistence store, then 
recreate the rules at run-time into concrete operators and functions

## 4.) Update your code to handle application or server level failure states. For example, how
## do we ensure data is never missed? What do we do if we do miss a fetch cycle? What if our email API
## provider goes down?

Right now, if the e-mail server goes down, it can continue processing all unprocessed notifications
because the minute it comes back up, it will retrieve ONLY the most recent notification for each 
property ID. Depending how long the e-mail server has gone down, it's possible thousands of
notifications will have accummulated for the same property IDs that already had outstanding, unsent
notifications. 

The e-mail service can also remove / render obsolete existing notifications to a property, if a newer
price update for that property comes in, while there are still outstanding updates not yet dispatched. 
This way we carefully only send one notification to the recipient reflecting only the latest price. 
This way the e-mail service can be down indefinitely and still send only relevant, recent notifications.

Similarly, if the pricing service is down and multiple fetch-cycles are lost, we can still pick up
where we left off from because the property-notification services will only process the most recent
price for each unique property ID. Lost-cycles can't be retrieved because the REST API has no facility
to do historical look-ups, plus notifications only care about the latest prices anyway.

If the notification monitor service goes down, the pricing service will still keep fetching prices -
fortunately, the notification monitor keeps track of it's last read-timestamp so that when it comes
back up, it can continue reading since the time it went down and get only the most recent price for
each unique property that had at least one price-update since the last read-timestamp. If we didn't
have the last read-timestamp constraint, we would get the last price update for EVERY property that
ever existed and potentially end up re-processing notifications for properties again.

In short, each component, to a degree, can gracefully degrade service, and so long as there is still
existing data, continue running independently. If they go down, they can continue processing next-time
they come back up with via state information either as a last-read timestamp, otifications table with
processing status flag etc. The queue compaction in both the EmailService and PropertyNotification
services also help mitigate to a degree, badly behaving other components by guaranteeing that the
maximum size data-set can be constrained to the number of unique properties only.

## If I had more time ...
The Mailtrap issue really threw a spanner into my evening at the 11th hour - I implemented it last and 
was horrified that it was so sensitive. I've implemented throttling to limit the complaints, but 
they'll still inevitably occur. Fortunately, there will only be as many outstanding notifications as
there are unique property IDs because we compact obsolete notices, but if it wasn't for this, the 
Mailtrap-based email service would fall-behind the other components based on this current imp.

The Bootstrapper would be replaced by a dependency-injection container with configurable, declarative
dependencies, rather than be a bunch of hard-coded instantiations - instead it could be more dynamic,
eg I could create a mapping table between PropertyTypes and NotificationTypes and instantiate based on
configuration loaded. On that note, I'd also consider having alot of these services eg Pricing, 
Notification, Email use EventEmitters rather than passing around callbacks (realized this a bit late
in the game alas, to refactor). Also would drop the AppDataService and any other domain-model classes
in favor of an ORM (eg Mongoose) that can do what it basically does, already.

Convert the whole thing to TypeScript :) Oh and refactoring, lots and lots of refactoring, ESPECIALLY
the e-mail class - right now it knows too much about the app-domain model. Would also like to clean up
some of the magic numbers floating around (eg PropertyTypeIDs I hard-coded in the bootstrapper). We
might even want to add logic to not send unsent notifications that're older than a specific time period
relative to the initial notification creation time, if the dispatching services are that slow (looking
at you Mailtrap). Also add more wrapper classes / models for database entities.


### License

Dual licensed under **MIT** or **EUPLv1.1+**
