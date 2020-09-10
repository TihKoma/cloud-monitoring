let sendCamDataToSubscriber = (data) => {
	return instance.post('addCam', { data })
		.then(response => response.data);
};

let sendToSub_PublishAllCams = (masCams) => {
	console.log("func masCams:");
	console.log(masCams);
	return instance.post('startPublishAllCams', { masCams })
		.then(response => response.data);
};


let express = require('express');
let bodyParser = require('body-parser');

const MongoClient = require("mongodb").MongoClient;

const axios = require('axios');
const instance = axios.create({
	withCredentials: true,
	baseURL: 'http://192.168.99.100:3498/',
	headers: {
		// dataType: 'json',
		// contentType: 'application/json'
	}
});


let app = express();

console.log('its ok');

let urlEncodedParser = bodyParser.json();

// app.use(function (req, res, next) {
// 	res.header("Access-Control-Allow-Origin", req.headers.origin);
// 	res.header('Access-Control-Allow-Credentials', 'true');
// 	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
// 	next();
// });

// app.use(express.favicon()); // отдаем стандартную фавиконку, можем здесь же свою задать
// app.use(express.logger('dev')); // выводим все запросы со статусами в консоль
// app.use(express.bodyParser()); // стандартный модуль, для парсинга JSON в запросах
// app.use(express.methodOverride()); // поддержка put и delete
// app.use(app.router); // модуль для простого задания обработчиков путей
// app.use(express.static(path.join(__dirname, "public"))); // запуск статического файлового сервера, который смотрит на папку public/ (в нашем случае отдает index.html)

app.use('/public', express.static('public'));


app.post('/add', urlEncodedParser, async function (req, res) {
	console.log("request: ");
	console.log(req.body);
	try {
		// console.log(await sendCamDataToSubscriber(req.body));
		res.status(201).send(await sendCamDataToSubscriber(req.body));
	} catch (e) {
		res.sendStatus(e.response.status);
	};
});

app.get('/', function (req, res) {
	res.sendFile(__dirname + '/public/index.html');
});

app.listen(1337, function(){
	console.log('Express server listening on port 1337');
});

const mongoClient = new MongoClient("mongodb://mongoDB", { useNewUrlParser: true, useUnifiedTopology: true});
mongoClient.connect((err, database) => {

	if (err)
		return console.log(err);

	const db = database.db("camsDB");
	const camCollection = db.collection("camCorders");

	// http-запрос из контейнера web на получение всех камер
	app.get('/getAllCams', async function (request, response) {
		console.log('request getAllCams2');

		try {
			let res = camCollection.find().toArray(async function (err, results) {
				console.log(results);
				let masCams = await getInfoAllCams(db, results); // массив со всеми камерами [{id, wind, cloud},...] - вырезка из results + mqtt данные
				await sendToSub_PublishAllCams(masCams);
				// console.log(resSend);
				getMqttDataAndSendAll(response, db, results);
			});
			// console.log('res: ' + res);
		} catch (e) {
			response.send(e);
		};
	});

	app.get('/getCurrentMqttData', function (request, response) {
		console.log('request getCurrentMqttData');
		console.log('camId' + request.query.camId);

		try {
			findCurrentCloudAndWind(response, db, request.query.camId);
		} catch (e) {
			response.send(e);
		};
	});

	app.get('/getHistoryMqttData', function (request, response) {
		console.log('request getHistoryMqttData');
		console.log('camId ' + request.query.camId);

		try {
			findHistoryCloudAndWind(response, db, request.query.camId);
		} catch (e) {
			response.send(e);
		};
	});
	// database.close();

	let findHistoryCloudAndWind = (response, db, camId) => {
		// console.log(`camId - ${camId}`);
		let collection = db.collection("historyCloudOpacity");

		collection.find({camId: `${camId}`}).toArray(function (err, results) {
			// console.log('results: ');
			let masCloud = [];
			for (let i = 0; i < results.length; i++)
				masCloud.push([results[i].timestamp, results[i].value]);
			// console.log(masCloud);
				// console.log('value: ' + results[i].value + ' timestamp: ' + results[i].timestamp);
			findHistoryWind(response, db, camId, masCloud);
		});
	};

	let findHistoryWind = (response, db, camId, masCloud) => {
		let collection = db.collection("historyWindDirection");

		collection.find({camId: camId}).toArray(function (err, results) {
			let masWind = [];
			for (let i = 0; i < results.length; i++)
				masWind.push([results[i].timestamp, results[i].value]);

			let resData = JSON.stringify({
				masCloud,
				masWind
			});
			console.log(resData);
			response.status(201).send(`${resData}`);

		});
	};

	let findCurrentCloudAndWind = (response, db, camId) => {
		console.log(`camId - ${camId}`);
		let collection = db.collection("currentCloudOpacity");

		collection.find({camId: `${camId}`}).toArray(function (err, results) {
			console.log('results: ');
			console.log(results);
			let cloudValue = results[0].value;
			let cloudTimestamp = results[0].timestamp;
			// let collection = db.collection("currentWindDirection");

			// collection.find({camId}).toArray(function (err, results) {
			// 	let resData = {
			// 		cloud: cloudValue,
			// 		wind: results[0].value
			// 	};
			console.log(cloudValue);
			findCurrentWind(response, db, camId, cloudValue, cloudTimestamp);

			// });

		});
	};

	let findCurrentWind = (response, db, camId, cloudValue, cloudTimestamp) => {
		let collection = db.collection("currentWindDirection");

		collection.find({camId: camId}).toArray(function (err, results) {
			let resData = JSON.stringify({
				cloud: cloudValue,
				wind: results[0].value,
				cloudTimestamp,
				windTimestamp: results[0].timestamp
			});
			console.log(resData);
			response.status(201).send(`${resData}`);

		});
	};
});

// На входе - массив со всеми камерами.
// Получаем mqtt данные этих камер, совмещаем и отправляем
let getMqttDataAndSendAll = async (response, db, mas) => {
	console.log("getMqttDataAndSendAll");
	for (let i = 0; i < mas.length; i++) {
		let camId = `${mas[i]._id}`;

		let wind = await db.collection("currentWindDirection").findOne({camId: camId});
		let cloud = await db.collection("currentCloudOpacity").findOne({camId: camId});
		mas[i].wind = wind.value;
		mas[i].cloud = cloud.value;
		// console.log(`wind = ${wind.value}, cloud = ${cloud.value}`);
	};
	// console.log(mas);
	response.status(201).send(mas);
};

// Получить массив с id всех камер
// let getIdAllCams = (masCams) => {

// 	for (let i = 0; i < masCams.length; i++)
// 		resMas.push(masCams[i]._id);
	
	
// };

// Получить массив со всеми камерами [{id, wind, cloud},...] - вырезка из results + mqtt данные
// fullMasCams - массив со всеми данными камер (без mqtt данных)
let getInfoAllCams = async (db, fullMasCams) => {
	let resMas = [];
	
	for (let i = 0; i < fullMasCams.length; i++) {
		let wind = await db.collection("currentWindDirection").findOne({camId: `${fullMasCams[i]._id}`});
		let cloud = await db.collection("currentCloudOpacity").findOne({camId: `${fullMasCams[i]._id}`});
		let data = {
			id: fullMasCams[i]._id,
			wind: wind.value,
			cloud: cloud.value
		};
		resMas.push(data);
	};

	console.log("resMas: ");
	console.log(resMas);
	return resMas;
};