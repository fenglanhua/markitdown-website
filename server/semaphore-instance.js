const { Semaphore } = require('./semaphore');

const MAX_CONCURRENT_PAGES = parseInt(process.env.MAX_CONCURRENT_PAGES || '5', 10);
const pageSemaphore = new Semaphore(MAX_CONCURRENT_PAGES);

module.exports = { pageSemaphore };
