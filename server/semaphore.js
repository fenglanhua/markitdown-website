class Semaphore {
  constructor(max) {
    this._max = max;
    this._count = 0;
  }

  tryAcquire() {
    if (this._count >= this._max) return false;
    this._count++;
    return true;
  }

  release() {
    if (this._count > 0) this._count--;
  }
}

module.exports = { Semaphore };
