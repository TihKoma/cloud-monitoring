// MQTT broker
let mosca = require('mosca');
let settings = {port: 1234};
let broker = new mosca.Server(settings);

broker.on('ready', () => {
	console.log(broker);
	console.log("Broker is ready");
});

// broker.on('published', ());