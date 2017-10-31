/*eslint-disable unknown-require*/

'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var Conversation = require('watson-developer-cloud/conversation/v1');
var watson = require('watson-developer-cloud');

var app = express();
app.use(express.static('./public'));
app.use(bodyParser.json());
var conversation = new Conversation({
	url: 'https://gateway.watsonplatform.net/conversation/api',
	version_date: '2016-10-21',
	version: 'v1'
});
var retrieve_and_rank = watson.retrieve_and_rank({
	username: '548dbdd6-0074-46ae-8750-b546a61172ed',
	password: 'gaExe61H4mvV',
	version: 'v1'
});
var params = {
	cluster_id: 'sc491060c9_da36_4dcf_837c_6fa5b2449b8e',
	collection_name: 'soho'
};
var qs = require('qs');
var solrClient = retrieve_and_rank.createSolrClient(params);
var ranker_id = '7ff711x34-rank-5092';
/*
 * Function to update conversation dialog
 */
/*
function updateConversation(intent_update, output_rnr) {
	console.log('inside rip');
	console.log('intent:' + intent_update);
	console.log('output_rnr:' + output_rnr);
	var headers_conv = {
		'Content-Type': 'application/json',
		'Accept': 'application/json',
		'Authorization': 'Basic YWFjZWU2MTgtOTEwMS00N2NhLWEzZGQtMzBhOGJmMWMxZGMyOnQ3SW1XSkxrODJ4bQ=='
	};
	var dataString = '{ "output": { "text": {  "values": [' + output_rnr + '], "selection_policy": "sequential" }  }  }';
	var options_conv = {
		url: 'https://watson-api-explorer.mybluemix.net/conversation/api/v1/workspaces/ce88aa87-ad00-4d17-81e6-aa3d697b7765/dialog_nodes/' + intent_update + '?version=2017-05-26',
		method: 'POST',
		headers: headers_conv,
		body: dataString
	};

	function callback_conv(error, response, body) {
		if (!error && response.statusCode === 200) {
			console.log(body);
		} else {
			console.log('response body:' + response.body);
			console.log('error' + error);
		}
	}
	request(options_conv, callback_conv);
}
*/
app.post('/api/message', function(req, res) {
	var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
	if (!workspace || workspace === '<workspace-id>') {
		return res.json({
			'output': {
				'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple">README</a> documentation on how to set this variable. <br>' + 'Once a workspace has been defined the intents may be imported from ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
			}
		});
	}
	var payload = {
		workspace_id: workspace,
		context: req.body.context || {},
		input: req.body.input || {}
	};

	// Send the input to the conversation service
	conversation.message(payload, function(err, data) {
			if (err) {
				return res.status(err.code || 500).json(err);
			}
			console.log('retrun to ui');
			var response = data;
			var result = '';
			if (!response.output) {
				response.output = {};
				console.log('response.output build');

			} else {
				console.log('inside else');
				if (response.intents.length > 0) {
					var nodeID = '';
					var question = response.input.text;
					var answer = '';
					
					/*
					 * Dont send question to rnr if it is welcome node or intent is greeting in middle of conversation
					 */
					if(response.output.nodes_visited[0] === 'node_8_1505918860284' || response.intents[0].intent == 'greeting'){
						question = '';
					}
					
					if (response.output.nodes_visited[0] === 'node_9_1507222366845') {
						nodeID = 'node_9_1507222366845';
						if (response.entities[0].value === 'yes') {
							question = 'what are different shipping applications?';
						}
						else{
							question = '';
						}
						answer = 'From my understanding, ';
						if(response.context.fragile_check == 'yes'){
							answer = answer + ' your products are <strong>fragile</strong>, ';
						}
						else{
							answer = answer + ' your products are <strong>not fragile</strong>, ';
						}
						if(response.context.dryice_check == 'yes'){
							answer = answer + ' <strong>temperature-sensitive</strong>,';
						}
						else{
							answer = answer + ' <strong>not temperature-sensitive</strong>,';
						}
						if(response.context.hazard_check == 'yes'){
							answer = answer + ' and contains <strong>hazardous materials</strong>. ';
						}
						else{
							answer = answer + 'and <strong>doesn\'t contain hazardous materials</strong>. ';
						}
						if(response.context.shipment_value > 1000){
							answer = answer + ' Your shipments need to declared as <strong>high valued</strong>. ';
						}
						if(response.context.international_check == 'yes'){
							answer = answer + ' You ship <strong>internationally</strong>. ';
						}
						else{
							answer = answer + ' You ship <strong>inside US</strong>. ';
						}
						if(response.context.pickup_check == 'yes'){
							answer = answer + ' and UPS will </strong>pickup</strong> your shipments.';
						}
						else{
							answer = answer + ' and you will <strong>drop off</strong> packages at UPS Counter.';
						}
						answer = answer + 'I can help with any of the topics like dry ice, fragile packing or any other? (e.g., how to pack perishable goods? Tell me more about CampusShip)';
					}
				
				console.log('inside if');

				var entity = '';
				if (response.entities.length > 0) {
					entity = response.entities[0].value;
				}

				var query = qs.stringify({
					q: entity + ' ' + question,
					ranker_id: ranker_id,
					fl: 'contentHtml'
				});

				solrClient.get('fcselect', query, function(err, searchResponse) {
					if (err) {
						console.log('Error searching for documents: ' + err);
					} else {
						console.log('start of rnr');
						console.log(question);
						//result = JSON.stringify(searchResponse.response.docs[0].contentHtml, null, 1);
						if (JSON.stringify(searchResponse.response.numFound) !== '0') {
							result = searchResponse.response.docs[0].contentHtml;
						} else {
							result = '';
						}
						result = result.replace('<a ', '<a target="blank" ');
						console.log('result:' + result);
						console.log('response.output.text[0]:' + response.output.text[0]);
						if(!response.output.text[0]){
							response.output.text[0] = '';
						}
						response.output.text[0] = result + response.output.text[0] + answer;
						console.log('before con');
						//updateConversation(nodeID, JSON.stringify(result));
						console.log('after con');

						console.log('conversation log:');
						console.log(response);
						return res.json(response);
					}
				});

			} else {
				console.log(response);
				return res.json(response);
			}

		}

	});
});



module.exports = app;
