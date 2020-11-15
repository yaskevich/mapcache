'use strict';
const express = require('express');
const app = express();
const fs = require('fs')  
const path = require('path')  
const axios = require('axios')
const bodyParser = require('body-parser');
const morgan = require('morgan')
const loki = require('lokijs')
const port = 3111;
app.use(express.static('maps'))
// app.use(morgan('combined'));
var db = new loki('quickstart.db', {
    autoload: true,
    autoloadCallback : databaseInitialize,
    autosave: true, 
    autosaveInterval: 1000
});

// implement the autoloadback referenced in loki constructor
function databaseInitialize() {
  var entries = db.getCollection("entries");
  if (entries === null) {
    entries = db.addCollection("entries");
  }
  // kick off any program logic or start listening to external events
  runProgramLogic();
}

// example method with any bootstrap logic to run after database initialized
function runProgramLogic() {
  var entryCount = db.getCollection("entries").count();
  console.log("number of entries in database : " + entryCount);
}

app.all('/map/:num/:zoom/:x/:y.:type', function(req, res){
	let ps  = req.params;
	// console.log(ps);
	// http://demo.allmapsonline.com/maps/3/dtiles/14/14_9287_5566.png
	let url = 'http://demo.allmapsonline.com/maps/' + ps.num + '/dtiles/'+ps.zoom+'/'+ps.zoom+"_"+ps.x+"_"+ps.y+'.'+ps.type;
	let locl  = '/maps/' + ps.num + '/'+ps.zoom+'/'+ps.x+"/"+ps.y+'.'+ps.type;
	// console.log(url);
	var dbres = db.getCollection("entries").find({ url :url });
	if (dbres.length > 0){
		// console.log(dbres);
		console.log("Not covered:", locl);
		res.sendFile(path.join(__dirname, '/maps/empty.png'));
		return;
	}
	let the_path  = path.join(__dirname, locl);
	
	if (fs.existsSync(the_path) == true) {
		console.log("Cached:", locl);
		res.sendFile(the_path);
	} else {
		axios
		.request({
		  responseType: 'stream',
		  // url: 'http://datamap.by/bright/6/37/19.png',
		  url: url,
		  method: 'get',
		  timeout: 1000
		})
		.then(function (result) {
			['/maps/' + ps.num, '/maps/' + ps.num+ '/'+ps.zoom, '/maps/' + ps.num+ '/'+ps.zoom+'/'+ps.x]
			.map(x => path.join(__dirname, x))
			.map(y => !fs.existsSync(y)?fs.mkdirSync(y):null);
			
			result.data.pipe(fs.createWriteStream(the_path));
			// return a promise and resolve when download finishes
			return new Promise((resolve, reject) => {
				result.data.on('end', () => {
					console.log("Written:", locl);
					res.sendFile(the_path);
				  resolve()
				})
				result.data.on('error', () => {
					console.log("error writing file");
				  reject()
				})
			})
		}).catch (function (e) {
			console.log("external get error: " + e.response.status, url);
			db.getCollection("entries").insert({url});			
			res.sendFile(path.join(__dirname, '/maps/empty.png'));
		});
	}
	// let webpath = "http://lviv.datamap.by" + locl;
	// console.log(webpath);
	// res.status(200).send(webpath);
	
}); 

app.listen(port, () => {
    console.log('\nListening to port ' + port);
});
