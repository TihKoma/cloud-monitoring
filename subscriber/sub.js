// MQTT subscriber
let mqtt = require('mqtt');
let client = mqtt.connect("http://mqtt");
let topic = 'myTopic';

let express = require('express');
let app = express();
let bodyParser = require('body-parser');
let jsonParser = bodyParser.json();


client.on('connect', () => {
	client.subscribe(topic);
});

console.log('subscriber');


const axios = require('axios');
const instance = axios.create({
	withCredentials: true,
	baseURL: 'http://192.168.99.100:8080/',
	headers: {
		// dataType: 'json',
		contentType: 'application/json'
		// "API-KEY": "ec9377e0-3924-4787-a0cc-baba333fe985"
		// "API-KEY": "706db5af-f834-4e2c-a9dc-bef600d22075"
	}
});


// process.on('uncaughtException', function (err) {
//     console.log(err);
// }); 

const MongoClient = require("mongodb").MongoClient;


app.get('/hey', function (req, res) {
	// res.sendFile(__dirname + '/public/index.html');
	res.send("sub get post request");
	console.log('request subscriber is TRUE');
});

// console.log("http://mongoDB");
// console.log(`mongodb://${process.env.MONGO_PORT_27017_TCP_ADDR}:27017/`);

// создаем объект MongoClient и передаем ему строку подключения
const mongoClient = new MongoClient("mongodb://mongoDB", { useNewUrlParser: true, useUnifiedTopology: true});
mongoClient.connect(function(err, database){

	if (err)
		return console.log(err);

	const db = database.db("camsDB");
	// const collection = db.collection("msg");

	// http-запрос из контейнера web на добавление камеры
	app.post('/addCam', jsonParser, async function (req, response) {
		// response.send('subscriber get JSON request');
		console.log('request: ');
		console.log(req.body.data);

		try {
			let camId = await addCamToDB(db, req.body.data); 	// Добавления камеры в БД
			
			let topicCloud = "camCorders/CloudOpacity/" + camId;
			let topicWind = "camCorders/WindDirection/" + camId;
			// console.log(`topic sub: ${topic}`);
			client.subscribe(topicCloud);
			client.subscribe(topicWind);

			let resPub = await sendCamIdToPublisher(camId); 				// Отправка id новой камеры publisher, для конфигурации потока данных
			// console.log(resPub);



			response.status(201).send({camId});
		} catch (e) {
			response.send(e);
		};
	});

	// client.on('message', (topic, message) => writeToDB(topic, message, collection)); // получение сбщ от mqtt брокера
	client.on('message', async (topic, message) => {
		// console.log(`subscriber get message: ${message}, topic: ${topic}`);
		console.log(`message: '${message}'`);
		let res = await addMqttDataToDB(db, `${topic.split('/')[1]}`, topic.split('/')[2], message); // collection, camId, value
	});

	// database.close();
});

app.listen(3498, function(){
	console.log('Express server listening on port 1337');
});



app.post('/startPublishAllCams', jsonParser, async function (request, response) {
	// response.send('subscriber get JSON request');
	console.log('startPublishAllCams: ');
	console.log(request.body);

	try {
		await sendToPub_PublishAllCams(request.body.masCams); // Отправка subscriber'у - начать поток mqtt данных со всех камер
		for (let i = 0; i < request.body.masCams.length; i++) {
			let topicCloud = "camCorders/CloudOpacity/" + request.body.masCams[i].id;
			let topicWind = "camCorders/WindDirection/" + request.body.masCams[i].id;
			console.log(`topicCloud: ${topicCloud}; topicWind: ${topicWind}`);
			client.subscribe(topicCloud);
			client.subscribe(topicWind);
		};

		response.sendStatus(201);
	} catch (e) {
		response.send(e);
	};
});

// topic - cloudOpacity или windDirection
let addMqttDataToDB = async (db, topic, camId, value) => {
	// console.log('topic' + topic);
	// console.log(`collection: ${collection.namespace.collection}; camId: ${camId}; value: ${value}`);
	// console.log(`value: '${parseFloat(value)}'`);
	let data = {
		camId,
		value: parseFloat(value),
		timestamp: Date.now()
	};
	console.log(data);
	let current = await db.collection(`current${topic}`).update({camId}, data, {upsert: true});
	let history = await db.collection(`history${topic}`).insertOne(data);
	// return result.insertedId.toString();
};

let addCamToDB = async (db, data) => {
	let result = await db.collection("camCorders").insertOne(data);
	let camId = result.insertedId.toString();
	console.log("inserted camId: ");
	console.log(camId);

	db.collection("currentCloudOpacity").insertOne({camId, value: -1});
	db.collection("currentWindDirection").insertOne({camId, value: -1});


	return camId;
};


let writeToDB = (topic, message, collection) => {
	message = message.toString();
	console.log(`request of '${message}'`);

	let msg = {value: message};

	collection.insertOne(msg, function(err, result){
		console.log("msg success added");
		if(err)
			return console.log(err);

		console.log(result.ops);
	});
};
// app.get('/', function (req, res) {
// 	res.sendFile(__dirname + '/public/index.html');
// 	// res.send();
// 	// console.log('request is true');
// });



let sendCamIdToPublisher = (camId) => {
	return instance.post('addCam', { camId })
			.then(response => response.data);
};

let sendToPub_PublishAllCams = (masCams) => {
	return instance.post('startPublishAllCams', { masCams })
			.then(response => response.data);
};