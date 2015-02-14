var esprima = require("esprima");
var options = {tokens:true, tolerant: true, loc: true, range: true };
var faker = require("faker");
var fs = require("fs");
faker.locale = "en";
var mock = require('mock-fs');
var _ = require('underscore');

function main()
{
	var args = process.argv.slice(2);

	if( args.length == 0 )
	{
		args = ["subject.js"];
	}
	var filePath = args[0];

	constraints(filePath);

	generateTestCases()

}


function fakeDemo()
{
	console.log( faker.phone.phoneNumber() );
	console.log( faker.phone.phoneNumberFormat() );
	console.log( faker.phone.phoneFormats() );
}

var functionConstraints =
{
}

var mockFileLibrary =
{
	pathExists:
	{
		'path/fileExists': {}
	},
	fileWithContent:
	{
		pathContent:
		{
  			file1: 'text content',
		}
	},
	fileWithOutContent:
	{
		pathContent:
		{
				file1: '',
		}
	},
	NoFile:
	{
		pathContent:{
				file2:'',
		}
	}

};

function generateTestCases()
{

	var content = "var subject = require('./subject.js')\nvar mock = require('mock-fs');var faker = require('faker');\n";
	for ( var funcName in functionConstraints )
	{
		var params = {};

		// initialize params
		for (var i =0; i < functionConstraints[funcName].params.length; i++ )
		{
			var paramName = functionConstraints[funcName].params[i];
			params[paramName] = '\'\'';
		}

		//console.log( params );

		// update parameter values based on known constraints.
		var constraints = functionConstraints[funcName].constraints;
		// Handle global constraints...
		var fileWithContent = _.some(constraints, {mocking: 'fileWithContent' });
		var pathExists      = _.some(constraints, {mocking: 'fileExists' });
		var fileNotExists   = _.some(constraints, {mocking: 'Nofile'});
		var Phone_Input		 	= _.contains(functionConstraints[funcName].params, "phoneNumber");

		for( var c = 0; c < constraints.length; c++ )
		{
			var constraint = constraints[c];
			if( params.hasOwnProperty( constraint.ident ) )
			{
				params[constraint.ident] = constraint.value;
			}

			if(Object.keys(params).length >1)
			{
				var args = Object.keys(params).map( function(k) {return params[k]; }).join(",");
			content += "subject.{0}({1});\n".format(funcName, args );
			}

		}

		// Prepare function arguments.

					var args = Object.keys(params).map( function(k) {return params[k]; }).join(",");
					if( pathExists || fileWithContent )
					{
						content += generateMockFsTestCases(pathExists,fileWithContent,!fileNotExists,funcName, args);
						// Bonus...generate constraint variations test cases....
						content += generateMockFsTestCases(!pathExists,!fileWithContent,!fileNotExists,funcName, args);
						content += generateMockFsTestCases(pathExists,!fileWithContent,!fileNotExists,funcName, args);
						content += generateMockFsTestCases(!pathExists,fileWithContent,!fileNotExists,funcName, args);
						content += generateMockFsTestCases(!pathExists,fileWithContent,fileNotExists,funcName, args);
						content += generateMockFsTestCases(pathExists,fileWithContent,fileNotExists,funcName, args);
						content += generateMockFsTestCases(pathExists,!fileWithContent,fileNotExists,funcName, args);
					}
					else if(Phone_Input)
					{
						var Phone_Number ='212-212-2112'
						var Phone_Format ='(NNN) NNN-NNNN'
						var Options = '{"normalize": true}'

						content+= generatePhoneTestCases(Phone_Number,Phone_Format,Options);

					}
					else
					{
						// Emit simple test case.
						content += "subject.{0}({1});\n".format(funcName, args );
					}


	}

	//Number case
	content += "subject.{0}({1});\n".format('blackListNumber', "'2121111111'");

	//content += "subject.{0}({1});\n".format('format', "'2-12222','(NNN) NNN-NNNN','False'");
	//content += "subject.{0}({1});\n".format('format', "'2122212222','(NNN) NNN-NNNN','True'");
	//content += "subject.{0}({1});\n".format('format', "'','False','False'");
	//content += 'mock({"path":{"blank_file":"", "full_file":"content"}});\n'
	//content += "subject.fileTest('path','path/blank_file');\n"
	//content += "subject.fileTest('path','path/full_file');\n"
	//content += "mock.restore();\n"
	//content += "subject.format(faker.phone.phoneNumber(),faker.phone.phoneNumberFormat(),'');\n"
	//content += "subject.format(faker.phone.phoneNumber(),faker.phone.phoneNumberFormat(),{'normalize':true});\n"

	fs.writeFileSync('test.js', content, "utf8");

}

function generatePhoneTestCases(Phone_Number,Phone_Format,Options)
{

		args+=Phone_Number+','+Phone_Format+
	 	var testCase = "";
		testCase += "\tsubject.{0}({1});\n".format(funcName, args );
		return testCase;
}



function generateMockFsTestCases (pathExists,fileWithContent,NoFile,funcName,args)
{
	var testCase = "";
	// Insert mock data based on constraints.
	var mergedFS = {};

				if( pathExists && NoFile && !fileWithContent)
				{
						for (var attrname in mockFileLibrary.pathExists) { mergedFS[attrname] = mockFileLibrary.pathExists[attrname]; }
						for (var attrname in mockFileLibrary.NoFile) { mergedFS[attrname] = mockFileLibrary.NoFile[attrname]; }
				}

				if(pathExists && !NoFile && !fileWithContent)
				{
							for (var attrname in mockFileLibrary.pathExists) { mergedFS[attrname] = mockFileLibrary.pathExists[attrname]; }
							for (var attrname in mockFileLibrary.fileWithOutContent) { mergedFS[attrname] = mockFileLibrary.fileWithOutContent[attrname]; }
				}

				if( pathExists && fileWithContent && !NoFile)
				{
					for (var attrname in mockFileLibrary.pathExists) { mergedFS[attrname] = mockFileLibrary.pathExists[attrname]; }
					for (var attrname in mockFileLibrary.fileWithContent) { mergedFS[attrname] = mockFileLibrary.fileWithContent[attrname]; }
				}

	testCase +=
	"mock(" +
		JSON.stringify(mergedFS)
		+
	");\n";

	testCase += "\tsubject.{0}({1});\n".format(funcName, args );
	testCase+="mock.restore();\n";
	return testCase;
}

function constraints(filePath)
{
	var buf = fs.readFileSync(filePath, "utf8");
	var result = esprima.parse(buf, options);

	traverse(result, function (node)
	{
		if (node.type === 'FunctionDeclaration')
		{
			var funcName = functionName(node);
			console.log("Line : {0} Function: {1}".format(node.loc.start.line, funcName ));

			var params = node.params.map(function(p) {return p.name});

			functionConstraints[funcName] = {constraints:[], params: params};

			// Check for expressions using argument.
			traverse(node, function(child)
			{
				if( child.type === 'BinaryExpression')
				{

					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1 )
					{
						// get expression from original source code:
						//var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])

						if(child.operator == "<" ||  child.operator == "<=")
						{
								functionConstraints[funcName].constraints.push(
									{
										ident: child.left.name,
										value: rightHand

									});

								functionConstraints[funcName].constraints.push(
									{
											ident: child.left.name,
											value: rightHand -1
									});


								functionConstraints[funcName].constraints.push(
									{
											ident: child.left.name,
											value: rightHand +1
									});
						}

						if(child.operator == ">" ||  child.operator == ">=")
						{
								functionConstraints[funcName].constraints.push(
									{
										ident: child.left.name,
										value: rightHand
									});

								functionConstraints[funcName].constraints.push(
									{
											ident: child.left.name,
											value: rightHand +1
									});

									functionConstraints[funcName].constraints.push(
										{
												ident: child.left.name,
												value: rightHand -1
										});

						}


						if(child.operator == "==")
						{
								functionConstraints[funcName].constraints.push(
									{
										ident: child.left.name,
										value: rightHand
									});

									functionConstraints[funcName].constraints.push(
										{
											ident: child.left.name,
											value: '\'\''
										});

						}
					}

				}

				if( child.type == "CallExpression" &&
					child.callee.property &&
					child.callee.property.name =="readFileSync" )
				{
					for( var p =0; p < params.length; p++ )
					{
						if( child.arguments[0].name == params[p] )
						{
							functionConstraints[funcName].constraints.push(
							{
								// A fake path to a file
								ident: params[p],
								value: "'pathContent/file1'",
								mocking: 'fileWithContent'
							});
						}
					}
				}


				if( child.type == "CallExpression" &&
					child.callee.property &&
					child.callee.property.name =="existsSync")
				{
					for( var p =0; p < params.length; p++ )
					{
						if( child.arguments[0].name == params[p] )
						{
							functionConstraints[funcName].constraints.push(
							{
								// A fake path to a file
								ident: params[p],
								value: "'path/fileExists'",
								mocking: 'fileExists'
							});
						}
					}
				}

			});

			console.log( functionConstraints[funcName]);

		}
	});
}

function traverse(object, visitor)
{
    var key, child;

    visitor.call(null, object);
    for (key in object) {
        if (object.hasOwnProperty(key)) {
            child = object[key];
            if (typeof child === 'object' && child !== null) {
                traverse(child, visitor);
            }
        }
    }
}

function traverseWithCancel(object, visitor)
{
    var key, child;

    if( visitor.call(null, object) )
    {
	    for (key in object) {
	        if (object.hasOwnProperty(key)) {
	            child = object[key];
	            if (typeof child === 'object' && child !== null) {
	                traverseWithCancel(child, visitor);
	            }
	        }
	    }
 	 }
}

function functionName( node )
{
	if( node.id )
	{
		return node.id.name;
	}
	return "";
}


if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) {
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

main();
