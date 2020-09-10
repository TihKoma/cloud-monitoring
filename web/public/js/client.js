let mas = []; // Массив с камерами, для обновления данных
window.openedCamId = undefined;

class Camera {
	constructor(camId, manager, coords, radius) {
		this._id = camId;
		this._manager = manager;
		this._coords = coords;
		this._radius = radius;

		this._counter = 0;
		this.flag = false;						// флаг - открыт baloon или нет
		this.position = null;

		// let mqttData = this._getHistoryMqttDataFromDB();
		// console.log(mqttData);
		this._masWindMqttData = [];				// MQTT данные ветра [[timestamp, wind], ...]
		this._masCloudMqttData = [];			// MQTT данные облачности [[timestamp, cloud], ...]
		this._getAndSetHistoryMqttDataFromDB();	// Получить историю mqtt данных и записать в массивы _masWindMqttData, _masCloudMqttData

		this.flagRedraw = false;				// Флаг для переотрисовки графиков
		this.cloudRedrawCallback = undefined;	// callback для переотрисовки графика (в каждой итерации setInterval)
		this.windRedrawCallback = undefined;	// callback для переотрисовки графика (в каждой итерации setInterval)
	}

	getMasWindMqttData() {
		return this._masWindMqttData;
	}

	getMasCloudMqttData() {
		return this._masCloudMqttData;
	}

	setFlagRedraw(value) {
		this.flagRedraw = value;
		console.log('redrawFlag set is ' + value);
	}

	setRedrawCallback(name, callback) {
		if (name == 'CloudMqttData')
			this.cloudRedrawCallback = callback;
		else
			this.windRedrawCallback = callback;
	}

	_getAndSetHistoryMqttDataFromDB() {
		let ajaxSettings = {
			method: 'GET',
			url: `/getHistoryMqttData`,
			data: {camId: `${this._id}`},
			dataType: 'json',
			xhrFields: {
				withCredentials: true
			},
			success: (result, status) => {
				// console.log(result);
				for (let i = 0; i < result.masWind.length; i++)
					this._masWindMqttData.push([new Date(result.masWind[i][0]), result.masWind[i][1]]);

				for (let i = 0; i < result.masCloud.length; i++)
					this._masCloudMqttData.push([new Date(result.masCloud[i][0]), result.masCloud[i][1]]);

				// this._masWindMqttData = result.masWind;		// MQTT данные ветра [[timestamp, wind], ...]
				// this._masCloudMqttData = result.masCloud;	// MQTT данные облачности [[timestamp, cloud], ...]
				console.log(this._masWindMqttData);
				console.log(this._masCloudMqttData);
			},
			error: function() {
				alert("Error get MQTT Data from DB (ajax-request)");
				console.log('error', arguments);
			}
		};
		
		$.ajax(ajaxSettings);
	}

	startUpdate(mas) {

		let ajaxSettings = {
			method: 'GET',
			url: `/getCurrentMqttData`,
			data: {camId: `${this._id}`},
			dataType: 'json',
			xhrFields: {
				withCredentials: true
			},
			success: (result, status) => {
				// console.log(result);

				this._manager.objects.setObjectOptions(`circle_${this._id}`, {
					fillOpacity: result.cloud/100
				});

				let obj = this._manager.objects.getById(`circle_${this._id}`);
				let mqttData = `<h4 align="center">Данные с камеры</h4> <br>
								<table border="0">
									<tr>
										<td> <b>Облачность</b> </td> <td style="padding-left: 20px;"> ${result.cloud} % </td>
									</tr>
									<tr>
										<td> <b>Направление ветра</b> </td> <td style="padding-left: 20px;"> ${result.wind} °</td>
									</tr>
								</table> <br>
								<span class="camStat" onClick="showModalStat('${this._id}')">Статистика</span>`;
				obj.properties.balloonContent = mqttData;
				let checkBal = this._manager.objects.balloon.isOpen(`circle_${this._id}`);
				// console.log('checkBal = ' + checkBal);
				if (checkBal)
					this._manager.objects.balloon.setData(obj);
				// console.log('flag: ' + this.flag);
					// if (this.flag) {
					// console.log(this.position);
					// this._manager.objects.balloon.close(`circle_${this._id}`);
					// debugger;
					// let bal = this._manager.objects.balloon.open(`circle_${this._id}`);

					// console.log(this._manager.objects.balloon.getPosition());
					// this._manager.objects.balloon.setPosition({position: this.position}); //[55.69732021000674, 37.409061078125]
					// console.log(this._manager.objects.balloon.getPosition());
					// bal.setPosition(this.position);
					// let circle = this._manager.objects.getById(`circle_${this._id}`);
					// console.log(bal.getPosition());
					// console.log(this._manager.objects.balloon);
					// circle.geometry.setCoordinates(this.position);

					// this._manager.objects.balloon.setPosition(this.position);

					// this._manager.objects.balloon.open(`circle_${this._id}`, this.position);
					// circle.baloon.open(this.position);
					// };

					// this._manager.objects.setObjectGeometry(`wind_${this._id}`, {
					// 	coordinates: [this._coords[0]+0.4, this._coords[1]+0.4]
					// });


					// this._manager.objects.getById(`wind_${this._id}`).geometry = {coordinates: [this._coords[0]+0.4, this._coords[1]+0.4]};
					// console.log(this._manager.objects.getById(`wind_${this._id}`).geometry);

					// this._manager.objects.setObjectOptions(`wind_${this._id}`, {
					// 	coordinates: [this._coords[0]+0.4, this._coords[1]+0.4]
				// });
				this._manager.remove([`wind_${this._id}-${this._counter}`]);
				this._manager.remove([`windArrow1_${this._id}-${this._counter}`]);
				this._manager.remove([`windArrow2_${this._id}-${this._counter}`]);

				this._counter++;

				drawWindDirection(`${this._id}-${this._counter}`, this._manager, this._coords, result.wind, this._radius);

				this._masWindMqttData.push([new Date(result.windTimestamp), result.wind]);
				this._masCloudMqttData.push([new Date(result.cloudTimestamp), result.cloud]);

				if (this.flagRedraw) {
					this.windRedrawCallback();
					this.cloudRedrawCallback();
					console.log("redraw");
				};
			},
			error: function() {
				alert("Error update MQTT Data (ajax-request)");
				console.log('error', arguments);
			}
		};
		
		setInterval(() => {
			$.ajax(ajaxSettings);
		}, 3000);

	}
};

ymaps.ready(init);

function init () {
	var map = new ymaps.Map('map', {
		center: [55.751574, 37.573856],
		zoom: 9,
		controls: []
	}),

	// Создадим собственный макет выпадающего списка.
	ListBoxLayout = ymaps.templateLayoutFactory.createClass(
		"<button id='my-listbox-header' class='btn btn-success dropdown-toggle' data-toggle='dropdown'>" +
		"{{data.title}} <span class='caret'></span>" +
		"</button>" +
		// Этот элемент будет служить контейнером для элементов списка.
		// В зависимости от того, свернут или развернут список, этот контейнер будет
		// скрываться или показываться вместе с дочерними элементами.
		"<div id='my-listbox'" +
		" class='dropdown-menu'" +
		" style='display: {% if state.expanded %}block{% else %}none{% endif %};'></div>", {

		build: function() {
			// Вызываем метод build родительского класса перед выполнением
			// дополнительных действий.
			ListBoxLayout.superclass.build.call(this);

			this.childContainerElement = $('#my-listbox').get(0);
			// Генерируем специальное событие, оповещающее элемент управления
			// о смене контейнера дочерних элементов.
			this.events.fire('childcontainerchange', {
				newChildContainerElement: this.childContainerElement,
				oldChildContainerElement: null
			});
		},

		// Переопределяем интерфейсный метод, возвращающий ссылку на
		// контейнер дочерних элементов.
		getChildContainerElement: function () {
			return this.childContainerElement;
		},

		clear: function () {
			// Заставим элемент управления перед очисткой макета
			// откреплять дочерние элементы от родительского.
			// Это защитит нас от неожиданных ошибок,
			// связанных с уничтожением dom-элементов в ранних версиях ie.
			this.events.fire('childcontainerchange', {
				newChildContainerElement: null,
				oldChildContainerElement: this.childContainerElement
			});
			this.childContainerElement = null;
			// Вызываем метод clear родительского класса после выполнения
			// дополнительных действий.
			ListBoxLayout.superclass.clear.call(this);
		}
	});

	// Также создадим макет для отдельного элемента списка.
	ListBoxItemLayout = ymaps.templateLayoutFactory.createClass(
		"<a class='dropdown-item' href='#' style='cursor: pointer'>{{data.content}}</a>"
	),

	// Создадим 2 пункта выпадающего списка
	listBoxItems = [
		new ymaps.control.ListBoxItem({
			data: {
				content: 'Добавить камеру'
			}
		})
		// new ymaps.control.ListBoxItem({
		// 	data: {
		// 		content: 'Удалить камеру'
		// 	}
		// })
	],

	// Теперь создадим список, содержащий 2 пункта.
	listBox = new ymaps.control.ListBox({
		items: listBoxItems,
		data: {
			title: 'Выберите действие'
		},
		options: {
			// С помощью опций можно задать как макет непосредственно для списка,
			layout: ListBoxLayout,
			// так и макет для дочерних элементов списка. Для задания опций дочерних
			// элементов через родительский элемент необходимо добавлять префикс
			// 'item' к названиям опций.
			itemLayout: ListBoxItemLayout
		}
	});
	// window.map2 = map;

	listBox.events.add('click', function (e) {
		// Получаем ссылку на объект, по которому кликнули.
		// События элементов списка пропагируются
		// и их можно слушать на родительском элементе.
		var item = e.get('target');
		// Клик на заголовке выпадающего списка обрабатывать не надо.
		if (item != listBox) 
			$("#myModal").modal('show');
			// alert('ok');
		//     myMap.setCenter(
		//         item.data.get('center'),
		//         item.data.get('zoom')
		//     );
		// }

	});

	map.controls.add(listBox, {float: 'left'});

	let objectManager = new ymaps.ObjectManager({ clusterize: false });
	
	// objectManager.objects.events.add('click', function (e) {
		// var objectId = e.get('objectId');
		// // console.log('objects is clicked');

		// setFlag(mas, objectId); // Установить флаг в mas, что baloon у элемента objectId открыт
	// });

	objectManager.objects.balloon.events.add('open', function (e) {
		var objectId = e.get('objectId');
		// console.log('objects is open');
		// let position = e.getPosition();
		let position = objectManager.objects.balloon.getPosition(`circle_${objectId}`);
		// objectManager.objects.balloon.setPosition(`circle_${objectId}`, [position[0]+0.3, position[1]+0.5]);
		// console.log(objectManager.objects.balloon);
		setFlag(mas, objectId, position); // Установить флаг в mas, что baloon у элемента objectId открыт
	});

	objectManager.objects.balloon.events.add('close', function (e) {
		// console.log('some click close');
		var objectId = e.get('objectId');
		deleteFlag(mas, objectId);
	});

	map.geoObjects.add(objectManager);

	getAllCamsFromDB(objectManager, map, mas); // Получить и отрисовать все камеры из БД
	
	$("#btn_add").click(() => {
		addClick(objectManager, map, mas);
	});

	// Закрытие модального окна
	$('#modalStat').on('hidden.bs.modal', function (e) {
		console.log('close modal window');
		if (!window.openedCamId)
			return;
		let cam = getInstanceCam(window.openedCamId);
		cam.setFlagRedraw(false);
	});

	// $(".camStat").click(() => {
	// 	alert("click");
		// $("#modalStat").modal('show');
	// });
}


let getAllCamsFromDB = (objectManager, map, mas) => {
	let ajaxSettings = {
		method: 'GET',
		url: '/getAllCams',
		// dataType: 'json',
		contentType: 'application/json',
		processData: false,
		xhrFields: {
			withCredentials: true
		},
		success: (result, status) => {
			console.log(status);
			// console.log(result[0]._id);
			// Отрисовка всех камер на карте
			for (let i = 0; i < result.length; i++)
				addNewCamToMap(result[i]._id, objectManager, map, mas, [+result[i].latitude, +result[i].longitude], result[i].azimuth, result[i].radius, result[i].viewAngle, result[i].wind, result[i].cloud);
		},
		error: function() {
			alert("Error ajax-request");
			console.log('error', arguments);
		}
	};
	let ajaxRequest = $.ajax(ajaxSettings);
};


let addClick = (objectManager, map, mas) => {

	let data = {
		latitude: $("#latitude").val(),
		longitude: $("#longitude").val(),
		azimuth: $("#azimuth").val(),
		radius: $("#radius").val(),
		viewAngle: $("#viewAngle").val()
	};
	
	let check = checkInputs(data); 			// Валидация формы
	if (check != 0) {
		alert(check);
		return;
	};

	let ajaxSettings = {
		method: 'POST',
		url: '/add',
		data: JSON.stringify(data),
		// dataType: form.method === 'get' ? 'jsonp' : 'json',
		// dataType: 'json',
		contentType: 'application/json',
		processData: false,
		xhrFields: {
			withCredentials: true
		},
		success: (result, status) => {
			// console.log(`status - ${status}`);
			alert((status == "success") ? "Камера успешно добавлена" : "Ошибка добавления");
			// console.log(`camId = ${result.camId}`);

			addNewCamToMap(result.camId, objectManager, map, mas, [+data.latitude, +data.longitude], data.azimuth, data.radius, data.viewAngle, null, 0); // Отрисовка на карте только что добавленной камеры
		},
		error: function() {
			alert("Error ajax-request");
			console.log('error', arguments);
		}
	};
	let ajaxRequest = $.ajax(ajaxSettings);
	console.log(ajaxRequest);
};

// Добавление камеры на карту
// mas - массив с объектами Camera;   azimuth - направление камеры, radius - радиус охвата, viewAngle - угол обзора камеры
// windAngle, cloudOpacity - mqtt данные
let addNewCamToMap = (camId, objectManager, map, mas, coordinates, azimuth, radius, viewAngle, windAngle, cloudOpacity) => {
	// console.log(`cloudOpacity = ${cloudOpacity}`);
	
	
	drawCircle(camId, objectManager, map, mas, coordinates, radius, cloudOpacity, windAngle);			// Отрисовка окружности (область наблюдения камеры)
	drawCam(camId, objectManager, map, coordinates, azimuth, radius, viewAngle);		// отрисовка камеры
	if (windAngle)
		drawWindDirection(`${camId}-0`, objectManager, coordinates, windAngle, radius); // Отрисовка направления ветра
	drawCamDirection(camId, objectManager, coordinates, azimuth, radius, viewAngle);	// Направление камеры
	// drawAzimuth();
	// console.log(camId);
	mas.push(new Camera(camId, objectManager, coordinates, radius));
	mas[mas.length-1].startUpdate(mas);
	// console.log(mas);


	// console.log('manager: ');
	// console.log(objectManager);

};

// Отрисовка окружности (область наблюдения камеры)
let drawCircle = (camId, manager, map, mas, coordinates, radius, cloudOpacity, windDirection) => {
	let id = `circle_${camId}`;
	let geometry = {
		type: 'Circle',
		coordinates,
		radius
	};

	let mqttData = `<h4 align="center">Данные с камеры</h4> <br>
					<table border="0">
						<tr>
							<td> <b>Облачности</b> </td> <td style="padding-left: 20px;"> ${cloudOpacity} % </td>
						</tr>
						<tr>
							<td> <b>Направление ветра</b> </td> <td style="padding-left: 20px;"> ${windDirection} ° </td>
						</tr>
					</table> <br>
					<span class="camStat" onClick="showModalStat('${camId}')">Статистика</span>`;

	let properties = {
		balloonContent: mqttData
	};

	let options = {
		cursor: "default",
		fillColor: "#00CCFF",
		fillOpacity: cloudOpacity/100,
		strokeColor: "#0000FF", 		// Цвет обводки
		strokeOpacity: 0.8,				// Прозрачность обводки
		strokeWidth: 1 					// Ширина обводки в пикселях

	};

	addNewObject(id, manager, geometry, options, properties);
};

// Отрисовка картинки камеры + baloon с данными камеры
let drawCam = (camId, manager, map, coordinates, azimuth, radius, viewAngle) => {
	console.log("drawCam");
	let id = `camera_${camId}`;
	let geometry = {
		type: 'Point',
		coordinates
	};

	let camInfo = `	<h4 align="center">Информация о камере</h4> <br>
					<table border="0">
						<tr>
							<td> <b>id</b> </td> <td style="padding-left: 20px;"> ${camId} </td>
						</tr>
						<tr>
							<td> <b>Координаты</b> </td> <td style="padding-left: 20px;"> ${coordinates} </td>
						</tr>
						<tr>
							<td> <b>Направление (азимут)</b> </td> <td style="padding-left: 20px;"> ${azimuth} </td>
						<tr>
						<tr>
							<td> <b>Радиус охвата</b> </td> <td style="padding-left: 20px;"> ${radius} </td>
						</tr>
						<tr>
							<td> <b>Угол обзора</b> </td> <td style="padding-left: 20px;"> ${viewAngle} </td>
						</tr>
					</table>`;

	let properties = {
		hintContent: `Камера ${camId}`,
		balloonContent: camInfo
	};
	let options = {
		iconLayout: 'default#image', 				// тип макета
		iconImageHref: '/public/images/camera.png', // Изображение иконки метки
		iconImageSize: [26, 36], 					// Размеры метки
		iconImageOffset: [-15, -21] 				// Смещение левого верхнего угла иконки относительно точки привязки
	};

	addNewObject(id, manager, geometry, options, properties);
};

// Отрисовка стрелки направления ветра
// angle - угол направления ветра (азимут), R - радиус охвата камеры
// center - координаты камеры
let drawWindDirection = (camId, manager, center, angle, R) => {
	const kY = 111345.6155215434;
	const kX = 62859.83705528761;
	// console.log('!!!!!!!!!!!!!!!!camId: ' + camId);

	// коэффициент при корне. выше или ниже лежит точка относительно оси OX
	let kAngle = (angle > 90 && angle < 270) ? -1 : 1;
	// console.log('angle = ' + angle);
	let r = 2*R/3;
	let x = r*Math.sin((angle).toRad());
	let y = kAngle*Math.sqrt(r*r - x*x);
	x = x/kX;
	y = y/kY;

	let id = `wind_${camId}`;
	let geometry = {
		type: 'LineString',
		coordinates: [center, [+center[0] + +y, +center[1] + +x]]
	};
	// console.log(geometry);

	let options = {
		draggable: false,
		strokeColor: "#000000", // Цвет линии
		strokeWidth: 2,			// Ширина линии
		zIndex: 1000
	};
	// console.log('geometry');
	// console.log(geometry);
	// console.log('options');
	// console.log(options);


	addNewObject(id, manager, geometry, options);

	// отрисовка законцовок стрелки
	drawArrow(`windArrow1_${camId}`, angle, 30, 1000, [+center[0] + +y, +center[1] + +x], manager);
	drawArrow(`windArrow2_${camId}`, angle, -30, 1000, [+center[0] + +y, +center[1] + +x], manager);

};

// Законцовка стрелки
// l - длина законцовок стрелки, angle - азимут, alpha - угол от стрелки до законцовки
let drawArrow = (id, angle, alpha, l, center, manager) => {
	const kY = 111345.6155215434;
	const kX = 62859.83705528761;

	let k;
	if (angle >= 180)
		if (angle >= 270) k = 1
		else k = 2
	else
		if (angle >= 90) k = 3
		else k = 0;
	let phi = k*90 + 90 - angle.mod(90);

	let beta = phi + alpha - 180;

	let y = l*Math.sin(beta.toRad());
	let x = l*Math.cos(beta.toRad());

	x = x/kX;
	y = y/kY;

	let geometry = {
		type: 'LineString',
		coordinates: [center, [center[0]+y, center[1]+x]]
	};

	let options = {
		draggable: false,
		strokeColor: "#000000", // Цвет линии
		strokeWidth: 2,			// Ширина линии
		zIndex: 1000
	};

	addNewObject(id, manager, geometry, options);
};


// Направление камеры
// center - координаты центра окружности
let drawCamDirection = (camId, manager, center, alpha, R, viewAngle) => {
	const kY = 111345.6155215434;
	const kX = 62859.83705528761;

	let beta = +alpha - +(viewAngle/2); // угол первой границы
	// коэффициент при корне. выше или ниже лежит точка относительно оси OX
	let kBeta = (beta > 90 && beta < 270) ? -1 : 1;

	let x = R*Math.sin((beta).toRad());
	let y = kBeta*Math.sqrt(R*R - x*x);
	x = x/kX;
	y = y/kY;

	let id = `camDirection1_${camId}`;
	let geometry = {
		type: 'LineString',
		coordinates: [center, [+center[0] + +y, +center[1] + +x]]
	};

	let options = {
		draggable: true,
		strokeColor: "#000000", 	// Цвет линии
		strokeWidth: 2,				// Ширина линии
		strokeStyle: 'shortdashdot',
		zIndex: 1000
	};
	addNewObject(id, manager, geometry, options);

	//============Вторая граница===============
	beta = +alpha + +(viewAngle/2); 				// угол второй границы
	kBeta = (beta > 90 && beta < 270) ? -1 : 1;
	// console.log(`beta = ${beta}`);
	x = R*Math.sin((beta).toRad());
	y = kBeta*Math.sqrt(R*R - x*x);
	x = x/kX;
	y = y/kY;

	id = `camDirection2_${camId}`;
	geometry = {
		type: 'LineString',
		coordinates: [center, [+center[0] + +y, +center[1] + +x]]
	};

	options = {
		draggable: true,
		strokeColor: "#000000", 	// Цвет линии
		strokeWidth: 2,				// Ширина линии
		strokeStyle: 'shortdashdot',
		zIndex: 1000
	};
	addNewObject(id, manager, geometry, options);
};

// Динамическое добавление фигуры в менеджер объектов
let addNewObject = (id, manager, geometry, options, properties = {hintContent: '', balloonContent: ''}) => {
	// console.log(`id: ${id}, manager: ${manager}`);
	// console.log(geometry);
	// console.log(options);
	manager.add({
		type: 'Feature',
		id,
		geometry,
		properties,
		options
	});
};

// деление с остатком
Number.prototype.mod = function (divider) {return (this % divider)};
Number.prototype.toRad = function () { return this * Math.PI / 180; }




// установить флаг того, что открыт baloon элемента с camId
let setFlag = (mas, camId, position) => {
	console.log("mas: ");
	for (let i = 0; i < mas.length; i++) {
		camId = camId.replace('circle_', '');
		// console.log('_id: ' + mas[i]._id + ' camId: ' + camId);
		if (mas[i]._id == camId) {
			mas[i].flag = true;
			mas[i].position = position;
		};
	};
};

// Удалить флаг того, что открыт baloon элемента с camId
let deleteFlag = (mas, camId) => {
	for (let i = 0; i < mas.length; i++) {
		camId = camId.replace('circle_', '');
		if (mas[i]._id == camId)
			mas[i].flag = false;
	};
};

let showModalStat = (camId) => {
	window.openedCamId = camId;
	$("#modalStat").modal('show');

	let cam = getInstanceCam(camId);
	let masDataWind = cam.getMasWindMqttData(); 	// Получить массив с mqtt данными wind (history)
	let masDataCloud = cam.getMasCloudMqttData(); 	// Получить массив с mqtt данными cloud (history)
	
	google.charts.load('current', {packages: ['corechart', 'line']});
	google.charts.setOnLoadCallback(() => {
		drawGraphic(masDataWind, 'WindMqttData', 'Направление ветра', cam);
		drawGraphic(masDataCloud, 'CloudMqttData', 'Облачность', cam)
	});

	// google.charts.load('current', {packages: ['corechart', 'line']});
	// google.charts.setOnLoadCallback(() => {
	// 	// drawGraphic(masDataWind, 'WindMqttData', 'Направление ветра', cam);
	// 	drawGraphic(masDataCloud, 'CloudMqttData', 'Облачность', cam)
	// });
};

// let drawGraphicWind = () => {

	// 	google.charts.load('current', {packages: ['corechart', 'line']});
	// 	google.charts.setOnLoadCallback(drawBasic);
	// 	var data = new google.visualization.DataTable();
	// 	data.addColumn('number', 'X');
	// 	data.addColumn('number', 'Направление ветра');

	// 	data.addRows([
	// 		[0, 0],   [1, 10],  [2, 23],  [3, 17],  [4, 18],  [5, 9],
	// 		[6, 11],  [7, 27],  [8, 33],  [9, 40],  [10, 32], [11, 35],
	// 		[12, 30], [13, 40], [14, 42], [15, 47], [16, 44], [17, 48],
	// 		[18, 52], [19, 54], [20, 42], [21, 55], [22, 56], [23, 57],
	// 		[24, 60], [25, 50], [26, 52], [27, 51], [28, 49], [29, 53],
	// 		[30, 55], [31, 60], [32, 61], [33, 59], [34, 62], [35, 65],
	// 		[36, 62], [37, 58], [38, 55], [39, 61], [40, 64], [41, 65],
	// 		[42, 63], [43, 66], [44, 67], [45, 69], [46, 69], [47, 70],
	// 		[48, 72], [49, 68], [50, 66], [51, 65], [52, 67], [53, 70],
	// 		[54, 71], [55, 72], [56, 73], [57, 75], [58, 70], [59, 68],
	// 		[60, 64], [61, 60], [62, 65], [63, 67], [64, 68], [65, 69],
	// 		[66, 70], [67, 72], [68, 75], [69, 80], [200, 140]
	// 	]);

	// 	var options = {
	// 		hAxis: {
	// 			title: 'Time'
	// 		},
	// 		vAxis: {
	// 			title: 'Popularity'
	// 		}
	// 	};

	// 	var chart = new google.visualization.LineChart(document.getElementById('chart_div'));

	// 	chart.draw(data, options);
// };

// Получить экземляр камеры (объект Camera c _id = camId)
// mas - массив с объектами всех камер
let getInstanceCam = (camId) => {
	for (let i = 0; i < mas.length; i++)
		if (mas[i]._id == camId)
			return mas[i];
	return null;
};

// cam - экземляр Camera текущей камеры
function drawGraphic(masData, idHtml, strTitle, cam) {
	var data = new google.visualization.DataTable();
	data.addColumn('date', 'Month');
	data.addColumn('number', strTitle);

	// let masData = [
	// 	[new Date(Date.now()), 210]//, [new Date(2020, 5, 28, 18, 50, 43), 210],   [new Date(2020, 5, 28, 18, 52, 43), 230], [new Date(2020, 5, 28, 18, 52, 53), 200], [new Date(2020, 5, 28, 18, 53, 5), 180]
	// ];
	console.log(masData);

	data.addRows(masData);

	var options = {
		hAxis: {
			title: 'Время',
			format: 'H:mm:ss dd.MM',
			slantedText: true,
			slantedTextAngle: 45,
			// showTextEvery: 1,
		},
		vAxis: {
			title: strTitle
		},
		width: 1000,
		height: 600
	};

	var chart = new google.visualization.LineChart(document.getElementById(idHtml));
	var formatter = new google.visualization.DateFormat({pattern: 'H:mm:ss dd.MM.yy'});
	formatter.format(data, 0);

	chart.clearChart();
	chart.draw(data, options);

	console.log(`cam.getMas${idHtml}`);

	cam.setFlagRedraw(true);					// Установка флага для перерисовки графика (отрисовка в setInterval)
	cam.setRedrawCallback(idHtml, () => redrawGraphic(chart, eval(`cam.getMas${idHtml}()`), options));

};

let redrawGraphic = (chart, masData, options) => {
	let data = new google.visualization.DataTable();
	data.addColumn('date', 'Month');
	data.addColumn('number', options.vAxis.title);

	data.addRows(masData);

	formatter = new google.visualization.DateFormat({pattern: 'H:mm:ss dd.MM.yy'});
	formatter.format(data, 0);

	chart.clearChart();
	chart.draw(data, options);
};



let checkInputs = (data) => {
	const re = /^[?!,.0-9\s]+$/;
	for (let key in data) {
		if (data[key] == '')
			return 'Ошибка. Пустое поле в форме';
		// console.log(re.test(data[key]));
		if (!re.test(data[key]))
			return 'Ошибка. Недопустимые символы';
	};
	return 0;
};