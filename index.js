'use strict';
// find . -name '*.png' -exec pngquant -ext .png -force 256 {} \;
const express = require('express');
const app = express();
const fs = require('fs')  
const path = require('path')  
const axios = require('axios')
const bodyParser = require('body-parser');
const morgan = require('morgan')
const loki = require('lokijs')
const port = 3111;
app.disable('x-powered-by');
app.use(express.static('maps'))
// app.use(morgan('combined'));

const emptyTileRelPath = '/maps/empty.png';
const emptyTileFullPath = path.join(__dirname, emptyTileRelPath);

const db = new loki('quickstart.db', {
    autoload: true,
    autoloadCallback : databaseInitialize,
    autosave: true, 
    autosaveInterval: 1000
});

// implement the autoloadback referenced in loki constructor
function databaseInitialize() {
  let entries = db.getCollection("entries");
  if (entries === null) {
    entries = db.addCollection("entries");
  }
  // kick off any program logic or start listening to external events
  runProgramLogic();
}

// example method with any bootstrap logic to run after database initialized
function runProgramLogic() {
  let entryCount = db.getCollection("entries").count();
  console.log("number of entries in database : " + entryCount);
}

function processUrl(response, extURL, tileRelDir, tileName){
	let pathRelTile  =  path.join(tileRelDir, tileName);
	// console.log(extURL);
	//http://pelagios.org/tilesets/imperium/4/9/4.png	
	// https://tiles.yaskevich.com/pelagios/imperium/4/9/4.png
	// response.setHeader('Cache-Control', 'max-age=31536000');
	
	
	var dbres = db.getCollection("entries").find({ url :extURL });
	if (dbres.length > 0){
		// console.log(dbres);
		console.log("Not covered:", pathRelTile);
		response.sendFile(emptyTileFullPath);
		return;
	}
	let pathFullLocalTile  = path.join(__dirname, pathRelTile);
	
	if (fs.existsSync(pathFullLocalTile) == true) {
		console.log("Cached:", pathRelTile);
		response.sendFile(pathFullLocalTile);
	} else {
		axios
		.request({
		  responseType: 'stream',
		  // url: 'http://datamap.by/bright/6/37/19.png',
		  url: extURL,
		  method: 'get',
		  timeout: 3000 // was 1000
		})
		.then(function (result) {
			let pathFullLocalTileDir = path.join(__dirname, tileRelDir);
			if (!fs.existsSync(pathFullLocalTileDir)){
				fs.mkdirSync(pathFullLocalTileDir, { recursive: true });
			}
			result.data.pipe(fs.createWriteStream(pathFullLocalTile));
			// return a promise and resolve when download finishes
			return new Promise((resolve, reject) => {
				result.data.on('end', () => {
					console.log("Written:", pathRelTile);
					response.sendFile(pathFullLocalTile);
				  resolve()
				})
				result.data.on('error', () => {
					console.log("error writing file");
				  reject()
				})
			})
		}).catch (function (e) {
			if(e) {
				console.log("ext error status:", e.response.status, extURL);
				db.getCollection("entries").insert({extURL});			
			} else {
				console.log("error with error", extURL);
			}
			response.sendFile(emptyTileFullPath);
		});
	}
}

// http://pelagios.org/tilesets/imperium/4/9/4.png
app.all('/pelagios/:name/:zoom/:x/:y.:type', function(req, res){
	let ps  = req.params;
	let url = 'http://pelagios.org/tilesets/' + ps.name + '/'+ps.zoom+"/"+ps.x+"/"+ps.y+'.'+ps.type;
	let scope  = '/maps/pelagios/';
	let pathRelTile  =  scope + ps.name + '/'+ps.zoom+'/'+ps.x+"/"+ps.y+'.'+ps.type;
	processUrl(res, url,  path.join(scope, ps.name, ps.zoom, ps.x), ps.y+'.'+ps.type);
}); 

app.all('/lviv/:num/:zoom/:x/:y.:type', function(req, res){
	let ps  = req.params;
	// console.log(ps);
	// http://demo.allmapsonline.com/maps/3/dtiles/14/14_9287_5566.png
	let url = 'http://demo.allmapsonline.com/maps/' + ps.num + '/dtiles/'+ps.zoom+'/'+ps.zoom+"_"+ps.x+"_"+ps.y+'.'+ps.type;
	let scope  = '/maps/lviv/';
	let pathRelTile  =  scope + ps.num + '/'+ps.zoom+'/'+ps.x+"/"+ps.y+'.'+ps.type;
	
	// processUrl(response, extURL, tileRelDir, tileName){
	// let ps  = req.params;
	// let url = 'http://demo.allmapsonline.com/maps/' + ps.num + '/dtiles/'+ps.zoom+'/'+ps.zoom+"_"+ps.x+"_"+ps.y+'.'+ps.type;
	// scope url = '/maps/lviv/'
	processUrl(res, url,  path.join(scope, ps.num, ps.zoom, ps.x), ps.y+'.'+ps.type);
	// console.log(url);
	
	// // // // // // // res.setHeader('Cache-Control', 'max-age=31536000');
	// // // // // // // var dbres = db.getCollection("entries").find({ url :url });
	// // // // // // // if (dbres.length > 0){
		// // // // // // // // console.log(dbres);
		// // // // // // // console.log("Not covered:", pathRelTile);
		// // // // // // // res.sendFile(emptyTileFullPath);
		// // // // // // // return;
	// // // // // // // }
	// // // // // // // let pathFullLocalTile  = path.join(__dirname, pathRelTile);
	
	// // // // // // // if (fs.existsSync(pathFullLocalTile) == true) {
		// // // // // // // console.log("Cached:", pathRelTile);
		// // // // // // // res.sendFile(pathFullLocalTile);
	// // // // // // // } else {
		// // // // // // // axios
		// // // // // // // .request({
		  // // // // // // // responseType: 'stream',
		  // // // // // // // // url: 'http://datamap.by/bright/6/37/19.png',
		  // // // // // // // url: url,
		  // // // // // // // method: 'get',
		  // // // // // // // timeout: 1000
		// // // // // // // })
		// // // // // // // .then(function (result) {
			// // // // // // // [scope + ps.num, scope + ps.num+ '/'+ps.zoom, scope + ps.num+ '/'+ps.zoom+'/'+ps.x]
			// // // // // // // .map(x => path.join(__dirname, x))
			// // // // // // // .map(y => !fs.existsSync(y)?fs.mkdirSync(y):null);
			
			// // // // // // // result.data.pipe(fs.createWriteStream(pathFullLocalTile));
			// // // // // // // // return a promise and resolve when download finishes
			// // // // // // // return new Promise((resolve, reject) => {
				// // // // // // // result.data.on('end', () => {
					// // // // // // // console.log("Written:", pathRelTile);
					// // // // // // // res.sendFile(pathFullLocalTile);
				  // // // // // // // resolve()
				// // // // // // // })
				// // // // // // // result.data.on('error', () => {
					// // // // // // // console.log("error writing file");
				  // // // // // // // reject()
				// // // // // // // })
			// // // // // // // })
		// // // // // // // }).catch (function (e) {
			// // // // // // // if(e) {
				// // // // // // // console.log("ext error status:", e.response.status, url);
				// // // // // // // db.getCollection("entries").insert({url});			
			// // // // // // // } else {
				// // // // // // // console.log("error with error", url);
			// // // // // // // }
			// // // // // // // res.sendFile(emptyTileFullPath);
		// // // // // // // });
	// // // // // // // }
	// let webpath = "http://lviv.datamap.by" + pathRelTile;
	// console.log(webpath);
	// res.status(200).send(webpath);
	
}); 

app.listen(port, () => {
    console.log('\nListening to port ' + port);
});
