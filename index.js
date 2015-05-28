var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var val = require('validator');

//Generate
module.exports.methods = [ "OPTIONS", "GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "TRACE", "CONNECT" ];
module.exports.generate = function(dingle, directory){
	directory = path.join(process.cwd(), directory);
	
	//Hostname
	var hostname = '';
	if (dingle.config.https.listen != '' && dingle.config.https.hostname != ''){
		hostname = 'https://' + dingle.config.https.hostname + ':' + dingle.config.https.port + '/';
	}else if (dingle.config.http.listen != '' && dingle.config.http.hostname != '' ){
		hostname = 'http://' + dingle.config.http.hostname + ':' + dingle.config.http.port + '/';
	}else{
		throw "HTTP and HTTPS are not listening or do not have a hostname";
	}
	
	//Generate
	setup(dingle, directory);
	for (func in dingle.functions){
		generate(dingle,hostname, dingle.functions[func], directory);
	}
}

//Setup
function setup(dingle, directory){
	var str = '';

	//Generate File
	str+= 'import Foundation\n'
	str+= 'import Alamofire\n'
	str+= 'import SwiftyJSON\n'
	
	str+= 'class ' + dingle.config.app.prefix + ' {\n'
	str+= '	class func sendRequest(url: String, method: Alamofire.Method, params: Dictionary<String,String>, callback:(success: Bool, message: String, output: Dictionary<String,AnyObject>)->()) {\n'
	str+= '		Alamofire.request(method, url, parameters:params).validate(statusCode: 200..<501).validate(contentType: ["application/json"]).responseJSON{(req, res, json, error) in\n'
	str+= '			if(error != nil) {\n'
	str+= '				if error?.code == -1 || error?.code == -1005{\n';
	str+= '					callback(success: false, message:"Could not reach server, please check your internet connection", output: [:])\n'
	str+= '				}else if error?.code == -1202{\n';
	str+= '					callback(success: false, message:"A valid SSL certificate could not be found on the server", output: [:])\n'
	str+= '				}else{\n'
	str+= '					callback(success: false, message: error!.localizedDescription, output: [:])\n'
	str+= '				}\n'
	str+= '			}else {\n'
	str+= '				var json = JSON(json!)\n'
	str+= '				callback(success: json["success"].boolValue, message: json["message"].stringValue, output: json["output"].dictionaryObject!)\n'
	str+= '			}\n'
	str+= '		}\n'
	str+= '	}\n'
	str+= '}'
	
	write(path.join(directory, dingle.config.app.prefix + '.swift'), str);
}
	
//Each Call
function generate(dingle, hostname, func, directory){
	var str = '';
	
	//Params
	var methodParam = ""
	var reqParam = ""
	for (var param in func.params){
		var obj = func.params[param];
		
		//Compare
		var kind = 'String';
		try{
			if (val.isBoolean(obj.validator('true'))){ kind = 'Bool'; }
		}catch(error){ }
		try{
			if (val.isInt(obj.validator('123'))){ kind = 'Int'; }
		}catch(error){ }
		try{
			if (val.isFloat(obj.validator('123.123'))){ kind = 'Double'; }
		}catch(error){ }
		
		//Optional
		var optional = '';
		if (!obj.required){
			optional = '?';
		}
		
		//Construct
		methodParam += param + ': ' + kind + optional + ','
		reqParam += '"' + param + '": "\\(' + param + ')",'
	}
	reqParam = reqParam.slice(0,-1);
	
	//No params
	if (reqParam == ''){
		reqParam = ':';
	}
	
	//Choose method
	var method = '';
	for (meth in func.methods){
		var meth = func.methods[meth];
		if (module.exports.methods.indexOf(meth) != -1){
			method = meth;
			break;
		}
	}
	if (method == ''){
		return;
	}

	//Generate File	
	str+= 'import Foundation\n'
	str+= 'import Alamofire\n'
	str+= 'import SwiftyJSON\n'
	str+= 'extension ' + dingle.config.app.prefix + '{\n'
	str+= '	class func ' + func.name + '(' + methodParam + 'callback: (success: Bool, message: String, output: Dictionary<String, AnyObject>)->()){\n'
	str+= '		self.sendRequest("' + hostname + func.name + '/", method: .' + method + ', params: [' + reqParam + '], callback: callback)\n'
	str+= '	}\n'
	str+= '}'
	
	//Make directory and file
	write(path.join(directory, dingle.config.app.prefix + '_' + func.name + '.swift'), str);
}

//Write File
function write(filename, contents){
	mkdirp(path.dirname(filename), function (error) {
		if (error){
			throw error;
		}else{
			fs.writeFile(filename, contents, function(error){
				if (error){
					throw error;
				}else{
					return;
				}
			});
		}
	});
}