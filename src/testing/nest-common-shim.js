function Injectable() {
  return (target) => target;
}

class Logger {
  log() {}
  error() {}
  warn() {}
  debug() {}
  verbose() {}
}

module.exports = { Injectable, Logger };
