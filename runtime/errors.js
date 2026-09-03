'use strict';

class RuntimeHoldError extends Error {
  constructor(code, message, details = {}, options = {}) {
    super(message);
    this.name = 'RuntimeHoldError';
    this.code = code;
    this.details = details;
    this.status = options.status || 'WAITING';
    this.interruptionLevel = options.interruptionLevel || 'QUEUE';
  }
}

class ContractError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ContractError';
    this.code = code;
    this.details = details;
  }
}

module.exports = { RuntimeHoldError, ContractError };
