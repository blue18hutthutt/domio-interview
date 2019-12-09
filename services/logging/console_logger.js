module.exports.ConsoleLogger = class ConsoleLogger {
    error(source, errorDetails) {
        console.error(`${errorDetails}`);
    } 

    info(source, msg) {
        console.info(msg);
    }
}