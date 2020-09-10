// MQTT publisher
let mqtt = require('mqtt');
let client = mqtt.connect("http://mqtt");
console.log("Publisher");
// console.log(process.env);

let express = require('express');
let app = express();
let bodyParser = require('body-parser');
let jsonParser = bodyParser.json();


class Camera {
	constructor(id, cloud = null, wind = null) {
		this._id = id;
		this._cloud = (cloud === null) ? (getRandomInt(0, 100)) : cloud;
		this._wind = (wind === null) ? (getRandomInt(0, 360)) : wind;
	}

	startPublish(client) {
		let topicCloud = "camCorders/CloudOpacity/" + this._id;
		let topicWind = "camCorders/WindDirection/" + this._id;
		// console.log(`topic publisher: ${topic}`);
		// let message = "data of camera";
		setInterval(() => {
			this._cloud = Math.abs(this._cloud + getRandomInt(-10, 10));
			this._cloud = (this._cloud > 100) ? (100 - (this._cloud%100)) : this._cloud;
			
			this._wind = (this._wind + getRandomInt(-10, 10))%360;
			this._wind = (this._wind < 0) ? (360 + this._wind) : this._wind;
			// console.log(`cloud = ${this._cloud}; wind = ${this._wind}`);

			let messageCloud = `${this._cloud}`;
			let messageWind = `${this._wind}`;

			client.publish(topicCloud, messageCloud);
			client.publish(topicWind, messageWind);

			// console.log("message вроде как sent");
		}, 3000);
	}
}; 

let mas = [];

app.post('/addCam', jsonParser, function (req, response) {
	// response.send('subscriber get JSON request');
	console.log('request: ');
	console.log(req.body.camId);
	try {
		mas.push(new Camera(req.body.camId));
		mas[mas.length-1].startPublish(client);

		response.sendStatus(201);
	} catch (e) {
		response.send(e);
	};
});

app.post('/startPublishAllCams', jsonParser, function (req, response) {
	console.log('startPublishAllCams');
	console.log(req.body.masCams);
	try {
		checkArrayAndStartPublish(mas, req.body.masCams); // Добав-ие в основной массив mas недостающие id камер и старт потока mqtt данных
		// mas.push(new Camera(req.body.camId));
		// mas[mas.length-1].startPublish(client);

		response.sendStatus(201);
	} catch (e) {
		response.send(e);
	};
});


console.log("its works");
let topic = 'myTopic';
let message = 'it is work';

// client.on('connect', () => {
// 	setInterval(() => {
// 		client.publish(topic, message);
// 		console.log('message sent');
// 	}, 5000);
// });


app.listen(8080, function(){
	console.log('Express server listening on port 1337');
});


function getRandomInt(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1)) + min; //Максимум и минимум включаются
};

// Проверка на наличие el в массиве
Array.prototype.checkArray =function(el) {
	console.log("el: " + el);
	console.log(this);
	for (let i = 0; i < this.length; i++)
		if (this[i]._id == el)
			return true;
	return false;
};

// Добавить в основной массив mas недостающие id камер и старт потока mqtt данных
// mas - основной массив (объектов), masCams - массив со всеми камерами (id, wind, cloud)
let checkArrayAndStartPublish = (mas, masCams) => {
	for (let i = 0; i < masCams.length; i++) {
		if (!mas.checkArray(masCams[i].id)) { 			// если нет искомого id в массиве mas
			mas.push(new Camera(masCams[i].id, masCams[i].cloud, masCams[i].wind));
			mas[mas.length-1].startPublish(client);

			console.log("add id mas: " + mas[mas.length-1]._id);
		};
	};
	console.log(mas);
};