import io from 'socket.io-client';
import ProviderEngine from 'web3-provider-engine';
import RpcSubprovider from 'web3-provider-engine/subproviders/rpc';
import WebsocketSubprovider from 'web3-provider-engine/subproviders/websocket';
import HookedWalletSubprovider from 'web3-provider-engine/subproviders/hooked-wallet';
import ethUtil from 'ethereumjs-util';
import 'isomorphic-fetch';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
  return typeof obj;
} : function (obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();

var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};

var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};

var host = 'http://localhost:50005';

var socket = null;
var connected = false;

var plugin = void 0;
var openRequests = [];

var allowReconnects = true;
var reconnectionTimeout = null;

var reconnectOnAbnormalDisconnection = async function reconnectOnAbnormalDisconnection() {
    if (!allowReconnects) return;

    clearTimeout(reconnectionTimeout);
    reconnectionTimeout = setTimeout(function () {
        SocketService.link();
    }, 1000);
};

var SocketService = function () {
    function SocketService() {
        classCallCheck(this, SocketService);
    }

    createClass(SocketService, null, [{
        key: 'init',
        value: function init(_plugin) {
            var timeout = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 60000;

            plugin = _plugin;

            this.timeout = timeout;
        }
    }, {
        key: 'link',
        value: async function link() {
            var _this = this;

            return Promise.race([new Promise(function (resolve, reject) {
                return setTimeout(async function () {
                    if (connected) return;
                    resolve(false);

                    if (socket) {
                        socket.disconnect();
                        socket = null;
                    }

                    reconnectOnAbnormalDisconnection();
                }, _this.timeout);
            }), new Promise(async function (resolve, reject) {

                socket = io.connect(host + '/scatter', { reconnection: false });

                socket.on('connected', async function () {
                    clearTimeout(reconnectionTimeout);
                    connected = true;
                    resolve(true);
                });

                socket.on('event', function (event) {
                    console.log('event', event);
                });

                socket.on('api', function (result) {
                    var openRequest = openRequests.find(function (x) {
                        return x.id === result.id;
                    });
                    if (!openRequest) return;
                    if (_typeof(result.result) === 'object' && result.result !== null && result.result.hasOwnProperty('isError')) openRequest.reject(result.result);else openRequest.resolve(result.result);
                });

                socket.on('disconnect', async function () {
                    console.log('Disconnected');
                    connected = false;
                    socket = null;

                    // If bad disconnect, retry connection
                    reconnectOnAbnormalDisconnection();
                });

                socket.on('connect_error', async function () {
                    allowReconnects = false;
                    resolve(false);
                });

                socket.on('rejected', async function (reason) {
                    console.error('reason', reason);
                    reject(reason);
                });
            })]);
        }
    }, {
        key: 'isConnected',
        value: function isConnected() {
            return connected;
        }
    }, {
        key: 'disconnect',
        value: async function disconnect() {
            socket.disconnect();
            return true;
        }
    }, {
        key: 'sendApiRequest',
        value: async function sendApiRequest(request) {
            return new Promise(async function (resolve, reject) {
                request.id = Math.round(Math.random() * 100000000 + 1);

                if (request.hasOwnProperty('payload') && !request.payload.hasOwnProperty('origin')) {
                    var origin = void 0;
                    if (typeof location !== 'undefined') {
                        if (location.hasOwnProperty('hostname') && location.hostname.length && location.hostname !== 'localhost') origin = location.hostname;else origin = plugin;
                    } else origin = plugin;

                    request.payload.origin = origin;
                }

                openRequests.push(Object.assign(request, { resolve: resolve, reject: reject }));
                socket.emit('api', { data: request, plugin: plugin });
            });
        }
    }]);
    return SocketService;
}();

var BLOCKCHAIN_SUPPORT = 'blockchain_support';

var Plugin = function Plugin() {
    var _name = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

    var _type = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';

    classCallCheck(this, Plugin);

    this.name = _name;
    this.type = _type;
};

var Blockchains = {
    EOS: 'eos',
    ETH: 'eth'
};

var BlockchainsArray = Object.keys(Blockchains).map(function (key) {
    return { key: key, value: Blockchains[key] };
});

var Network = function () {
    function Network() {
        var _name = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

        var _protocol = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'https';

        var _host = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '';

        var _port = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;

        var blockchain = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : Blockchains.EOS;
        var chainId = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : '';
        classCallCheck(this, Network);

        this.name = _name;
        this.protocol = _protocol;
        this.host = _host;
        this.port = _port;
        this.blockchain = blockchain;
        this.chainId = chainId.toString();
    }

    createClass(Network, [{
        key: 'unique',
        value: function unique() {
            return (this.blockchain + ':' + (this.chainId.length ? 'chain:' + this.chainId : this.host + ':' + this.port)).toLowerCase();
        }
    }, {
        key: 'hostport',
        value: function hostport() {
            return '' + this.host + (this.port ? ':' : '') + this.port;
        }
    }, {
        key: 'fullhost',
        value: function fullhost() {
            return this.protocol + '://' + this.host + (this.port ? ':' : '') + this.port;
        }
    }, {
        key: 'clone',
        value: function clone() {
            return Network.fromJson(JSON.parse(JSON.stringify(this)));
        }
    }, {
        key: 'isEmpty',
        value: function isEmpty() {
            return !this.host.length;
        }
    }, {
        key: 'isValid',
        value: function isValid() {
            return this.protocol.length && this.host.length && this.port || this.chainId.length;
        }
    }], [{
        key: 'placeholder',
        value: function placeholder() {
            return new Network();
        }
    }, {
        key: 'fromJson',
        value: function fromJson(json) {
            var p = Object.assign(Network.placeholder(), json);
            p.chainId = p.chainId ? p.chainId.toString() : '';
            return p;
        }
    }, {
        key: 'fromUnique',
        value: function fromUnique(netString) {
            var blockchain = netString.split(':')[0];
            if (netString.indexOf(':chain:') > -1) return new Network('', '', '', '', blockchain, netString.replace(blockchain + ':chain:', ''));

            var splits = netString.replace(blockchain + ':', '').split(':');
            return new Network('', '', splits[0], parseInt(splits[1] || 80), blockchain);
        }
    }]);
    return Network;
}();

var proxy = function proxy(dummy, handler) {
    return new Proxy(dummy, handler);
};

var EOS = function (_Plugin) {
    inherits(EOS, _Plugin);

    function EOS() {
        classCallCheck(this, EOS);
        return possibleConstructorReturn(this, (EOS.__proto__ || Object.getPrototypeOf(EOS)).call(this, Blockchains.EOS, BLOCKCHAIN_SUPPORT));
    }

    createClass(EOS, [{
        key: 'signatureProvider',
        value: function signatureProvider() {
            for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                args[_key] = arguments[_key];
            }

            var throwIfNoIdentity = args[0];

            // Protocol will be deprecated.
            return function (network, _eos) {
                var _options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

                network = Network.fromJson(network);
                if (!network.isValid()) throw Error.noNetwork();
                var httpEndpoint = network.protocol + '://' + network.hostport();

                var chainId = network.hasOwnProperty('chainId') && network.chainId.length ? network.chainId : options.chainId;

                // The proxy stands between the eosjs object and scatter.
                // This is used to add special functionality like adding `requiredFields` arrays to transactions
                return proxy(_eos({ httpEndpoint: httpEndpoint, chainId: chainId }), {
                    get: function get$$1(eosInstance, method) {

                        var returnedFields = null;

                        return function () {
                            for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                                args[_key2] = arguments[_key2];
                            }

                            if (args.find(function (arg) {
                                return arg.hasOwnProperty('keyProvider');
                            })) throw Error.usedKeyProvider();

                            // The signature provider which gets elevated into the user's Scatter
                            var signProvider = async function signProvider(signargs) {
                                throwIfNoIdentity();

                                var requiredFields = args.find(function (arg) {
                                    return arg.hasOwnProperty('requiredFields');
                                }) || { requiredFields: {} };
                                var payload = Object.assign(signargs, { blockchain: Blockchains.EOS, network: network, requiredFields: requiredFields.requiredFields });
                                var result = await SocketService.sendApiRequest({
                                    type: 'requestSignature',
                                    payload: payload
                                });

                                // No signature
                                if (!result) return null;

                                if (result.hasOwnProperty('signatures')) {
                                    // Holding onto the returned fields for the final result
                                    returnedFields = result.returnedFields;

                                    // Grabbing buf signatures from local multi sig sign provider
                                    var multiSigKeyProvider = args.find(function (arg) {
                                        return arg.hasOwnProperty('signProvider');
                                    });
                                    if (multiSigKeyProvider) {
                                        result.signatures.push(multiSigKeyProvider.signProvider(signargs.buf, signargs.sign));
                                    }

                                    // Returning only the signatures to eosjs
                                    return result.signatures;
                                }

                                return result;
                            };

                            // TODO: We need to check about the implications of multiple eosjs instances
                            return new Promise(function (resolve, reject) {
                                var _eos2;

                                (_eos2 = _eos(Object.assign(_options, { httpEndpoint: httpEndpoint, signProvider: signProvider, chainId: chainId })))[method].apply(_eos2, args).then(function (result) {

                                    // Standard method ( ie. not contract )
                                    if (!result.hasOwnProperty('fc')) {
                                        result = Object.assign(result, { returnedFields: returnedFields });
                                        resolve(result);
                                        return;
                                    }

                                    // Catching chained promise methods ( contract .then action )
                                    var contractProxy = proxy(result, {
                                        get: function get$$1(instance, method) {
                                            if (method === 'then') return instance[method];
                                            return function () {
                                                for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
                                                    args[_key3] = arguments[_key3];
                                                }

                                                return new Promise(async function (res, rej) {
                                                    instance[method].apply(instance, args).then(function (actionResult) {
                                                        res(Object.assign(actionResult, { returnedFields: returnedFields }));
                                                    }).catch(rej);
                                                });
                                            };
                                        }
                                    });

                                    resolve(contractProxy);
                                }).catch(function (error) {
                                    return reject(error);
                                });
                            });
                        };
                    }
                }); // Proxy
            };
        }
    }]);
    return EOS;
}(Plugin);

var ethNetwork = void 0;

var ETH = function (_Plugin) {
    inherits(ETH, _Plugin);

    function ETH() {
        classCallCheck(this, ETH);
        return possibleConstructorReturn(this, (ETH.__proto__ || Object.getPrototypeOf(ETH)).call(this, Blockchains.ETH, BLOCKCHAIN_SUPPORT));
    }

    createClass(ETH, [{
        key: 'signatureProvider',
        value: function signatureProvider() {

            return function (_network, _web3) {
                ethNetwork = Network.fromJson(_network);
                if (!ethNetwork.isValid()) throw Error.noNetwork();

                var rpcUrl = ethNetwork.protocol + '://' + ethNetwork.hostport();

                var engine = new ProviderEngine();
                var web3 = new _web3(engine);

                var walletSubprovider = new HookedWalletSubprovider(new ScatterEthereumWallet());
                engine.addProvider(walletSubprovider);

                if (ethNetwork.protocol.indexOf('http') > -1) engine.addProvider(new RpcSubprovider({ rpcUrl: rpcUrl }));else engine.addProvider(new WebsocketSubprovider({ rpcUrl: rpcUrl }));

                engine.start();

                return web3;
            };
        }
    }]);
    return ETH;
}(Plugin);

var ScatterEthereumWallet = function () {
    function ScatterEthereumWallet() {
        classCallCheck(this, ScatterEthereumWallet);

        this.getAccounts = this.getAccounts.bind(this);
        this.signTransaction = this.signTransaction.bind(this);
    }

    createClass(ScatterEthereumWallet, [{
        key: 'getAccounts',
        value: async function getAccounts(callback) {
            var result = await SocketService.sendApiRequest({
                type: 'identityFromPermissions',
                payload: {}
            });
            var accounts = !result ? [] : result.accounts.filter(function (account) {
                return account.blockchain === Blockchains.ETH;
            }).map(function (account) {
                return account.address;
            });

            callback(null, accounts);
            return accounts;
        }
    }, {
        key: 'signTransaction',
        value: async function signTransaction(transaction) {
            if (!ethNetwork) throw Error.noNetwork();

            // Basic settings
            if (transaction.gas !== undefined) transaction.gasLimit = transaction.gas;
            transaction.value = transaction.value || '0x00';
            if (transaction.hasOwnProperty('data')) transaction.data = ethUtil.addHexPrefix(transaction.data);

            // Required Fields
            var requiredFields = transaction.hasOwnProperty('requiredFields') ? transaction.requiredFields : {};

            // Contract ABI
            var abi = transaction.hasOwnProperty('abi') ? transaction.abi : null;
            if (!abi && transaction.hasOwnProperty('data')) throw Error.signatureError('no_abi', 'You must provide a JSON ABI along with your transaction so that users can read the contract');

            var payload = Object.assign(transaction, { blockchain: Blockchains.ETH, network: ethNetwork, requiredFields: requiredFields });

            var _ref = await SocketService.sendApiRequest({
                type: 'requestSignature',
                payload: payload
            }),
                signatures = _ref.signatures,
                returnedFields = _ref.returnedFields;

            if (transaction.hasOwnProperty('fieldsCallback')) transaction.fieldsCallback(returnedFields);

            return signatures[0];
        }
    }]);
    return ScatterEthereumWallet;
}();

/***
 * Setting up for plugin based generators,
 * this will add more blockchain compatibility in the future.
 */

var PluginRepositorySingleton = function () {
    function PluginRepositorySingleton() {
        classCallCheck(this, PluginRepositorySingleton);

        this.plugins = [];
        this.loadPlugins();
    }

    createClass(PluginRepositorySingleton, [{
        key: 'loadPlugins',
        value: function loadPlugins() {
            this.plugins.push(new EOS());
            this.plugins.push(new ETH());
        }
    }, {
        key: 'signatureProviders',
        value: function signatureProviders() {
            return this.plugins.filter(function (plugin) {
                return plugin.type === BLOCKCHAIN_SUPPORT;
            });
        }
    }, {
        key: 'supportedBlockchains',
        value: function supportedBlockchains() {
            return this.signatureProviders().map(function (plugin) {
                return name;
            });
        }
    }, {
        key: 'plugin',
        value: function plugin(name) {
            return this.plugins.find(function (plugin) {
                return plugin.name === name;
            });
        }
    }, {
        key: 'endorsedNetworks',
        value: async function endorsedNetworks() {
            return await Promise.all(this.signatureProviders().map(async function (plugin) {
                return await plugin.getEndorsedNetwork();
            }));
        }
    }]);
    return PluginRepositorySingleton;
}();

var PluginRepository = new PluginRepositorySingleton();

var throwNoAuth = function throwNoAuth() {
    if (!holder.scatter.isExtension && !SocketService.isConnected()) throw new Error('Connect and Authenticate first ( scatter.connect(pluginName, keyGetter, keySetter )');
};

var checkForPlugin = function checkForPlugin(resolve) {
    var tries = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

    if (tries > 20) return;
    if (holder.scatter.isExtension) return resolve(true);
    setTimeout(function () {
        return checkForPlugin(resolve, tries + 1);
    }, 100);
};

var Scatter = function () {
    function Scatter() {
        var _this = this;

        classCallCheck(this, Scatter);

        var noIdFunc = function noIdFunc() {
            if (!_this.identity) throw new Error('No Identity');
        };

        PluginRepository.signatureProviders().map(function (sigProvider) {
            _this[sigProvider.name] = sigProvider.signatureProvider(noIdFunc);
        });

        this.isExtension = false;
        this.identity = null;
    }

    createClass(Scatter, [{
        key: 'isInstalled',
        value: async function isInstalled() {
            return new Promise(function (resolve) {
                setTimeout(function () {
                    resolve(false);
                }, 3000);

                Promise.race([checkForPlugin(resolve), SocketService.ping().then(function (found) {
                    console.log('found', found);
                    if (found) resolve(true);
                })]);

                // Tries to set up Desktop Connection
            });
        }
    }, {
        key: 'connect',
        value: async function connect(pluginName, options) {
            var _this2 = this;

            return new Promise(function (resolve) {
                if (!pluginName || !pluginName.length) throw new Error("You must specify a name for this connection");

                // Setting options defaults
                options = Object.assign({ initTimeout: 10000, linkTimeout: 30000 }, options);

                // Auto failer
                setTimeout(function () {
                    resolve(false);
                }, options.initTimeout);

                // Defaults to scatter extension if exists
                checkForPlugin(resolve);

                // Tries to set up Desktop Connection
                SocketService.init(pluginName, options.linkTimeout);
                SocketService.link().then(async function (authenticated) {
                    if (!authenticated) return false;
                    _this2.identity = await _this2.getIdentityFromPermissions();
                    return resolve(true);
                });
            });
        }
    }, {
        key: 'disconnect',
        value: function disconnect() {
            return SocketService.disconnect();
        }
    }, {
        key: 'isConnected',
        value: function isConnected() {
            return SocketService.isConnected();
        }
    }, {
        key: 'getVersion',
        value: function getVersion() {
            return SocketService.sendApiRequest({
                type: 'getVersion',
                payload: {}
            });
        }
    }, {
        key: 'getIdentity',
        value: async function getIdentity(requiredFields) {
            var _this3 = this;

            throwNoAuth();
            return SocketService.sendApiRequest({
                type: 'getOrRequestIdentity',
                payload: {
                    fields: requiredFields
                }
            }).then(function (id) {
                if (id) _this3.identity = id;
                return id;
            });
        }
    }, {
        key: 'getIdentityFromPermissions',
        value: function getIdentityFromPermissions() {
            var _this4 = this;

            throwNoAuth();
            return SocketService.sendApiRequest({
                type: 'identityFromPermissions',
                payload: {}
            }).then(function (id) {
                if (id) _this4.identity = id;
                return id;
            });
        }
    }, {
        key: 'forgetIdentity',
        value: function forgetIdentity() {
            var _this5 = this;

            throwNoAuth();
            return SocketService.sendApiRequest({
                type: 'forgetIdentity',
                payload: {}
            }).then(function (res) {
                _this5.identity = null;
                return res;
            });
        }
    }, {
        key: 'authenticate',
        value: function authenticate() {
            throwNoAuth();
            return SocketService.sendApiRequest({
                type: 'authenticate',
                payload: {}
            });
        }
    }, {
        key: 'getArbitrarySignature',
        value: function getArbitrarySignature(publicKey, data) {
            var whatfor = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '';
            var isHash = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;

            throwNoAuth();
            return SocketService.sendApiRequest({
                type: 'requestArbitrarySignature',
                payload: {
                    publicKey: publicKey,
                    data: data,
                    whatfor: whatfor,
                    isHash: isHash
                }
            });
        }
    }, {
        key: 'suggestNetwork',
        value: function suggestNetwork(network) {
            throwNoAuth();
            return SocketService.sendApiRequest({
                type: 'requestAddNetwork',
                payload: {
                    network: network
                }
            });
        }
    }, {
        key: 'requestSignature',
        value: function requestSignature(payload) {
            throwNoAuth();
            return SocketService.sendApiRequest({
                type: 'requestSignature',
                payload: payload
            });
        }
    }, {
        key: 'createTransaction',
        value: function createTransaction(blockchain, actions, account, network) {
            throwNoAuth();
            return SocketService.sendApiRequest({
                type: 'createTransaction',
                payload: {
                    blockchain: blockchain,
                    actions: actions,
                    account: account,
                    network: network
                }
            });
        }
    }]);
    return Scatter;
}();

var Holder = function Holder(_scatter) {
    classCallCheck(this, Holder);

    this.scatter = _scatter;
};

var holder = new Holder(new Scatter());
if (typeof window !== 'undefined') window.scatter = holder.scatter;

// Catching extension instead of Desktop
if (typeof document !== 'undefined') {
    document.addEventListener('scatterLoaded', function (scatterExtension) {
        holder.scatter = window.scatter;
        holder.scatter.isExtension = true;
        holder.scatter.connect = function () {
            return new Promise(function (resolve) {
                return resolve(true);
            });
        };
    });
}

export default holder;
