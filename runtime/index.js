'use strict';

module.exports = {
  ...require('./contract'),
  ...require('./errors'),
  ...require('./registries'),
  ...require('./operations-bus'),
  ...require('./presentation'),
};
