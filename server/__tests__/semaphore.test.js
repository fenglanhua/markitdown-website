const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Semaphore } = require('../semaphore');

describe('Semaphore', () => {
  it('允許取得 permit 直到上限', () => {
    const sem = new Semaphore(2);
    assert.equal(sem.tryAcquire(), true);
    assert.equal(sem.tryAcquire(), true);
    assert.equal(sem.tryAcquire(), false);
  });

  it('釋放後可再次取得', () => {
    const sem = new Semaphore(1);
    assert.equal(sem.tryAcquire(), true);
    assert.equal(sem.tryAcquire(), false);
    sem.release();
    assert.equal(sem.tryAcquire(), true);
  });

  it('release 不會超過初始上限', () => {
    const sem = new Semaphore(1);
    sem.release(); // 多餘的 release
    assert.equal(sem.tryAcquire(), true);
    assert.equal(sem.tryAcquire(), false); // 不應該有額外 permit
  });
});
