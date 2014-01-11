//Requirements
var credentials = require("./credentials.js")
  , Topcap = require('topcap')
  , TwitterStream = require("./twitterStream.js")
  , io = require('socket.io').listen(1235)

var topics = {}

io.set('log level', 2)

//Socket handler
io.sockets.on('connection', function(socket) {
	socket.on('subscribe', function(topic) {
    if (typeof topics[topic.toLowerCase()] != "undefined") {
	topics[topic.toLowerCase()].forEach(function (keyword) {
	  keyword.split(" ").forEach(function (split_keyword) {
	    console.log(split_keyword)
	    socket.join(split_keyword)
	  });
	});
      }
      console.log(io.sockets.manager.roomClients[socket.id])
    })

    socket.on('unsubscribe', function(topic) {
      if (typeof topics[topic.toLowerCase()] != "undefined") {
	topics[topic].forEach(function (keyword) {
		socket.leave(keyword)
	});
      }
    })
})

//Init TwitterStream
var ts = new TwitterStream(credentials);

//Init Topcap data provider
var tc = new Topcap(require('./tc_config.js'))

//records => [keywords, topics, topics_data]
//keywords is list of all keywords
//topics is {topic1: ["k1", "k2", "k3"], topic2: ["kv1", "kv2"]}
//topics_data is {topic1: { spreadsheet: spreadsheet,
//description: description, title: title, images: [], subtitle: subtitle}}
function recordsToModel(records) {
  var ret_keywords = [], ret_topics = {}
  records.forEach(function (record) {
    var keywords = record["Keywords"].split(",")
    var topic_key = record["Topic"].toLowerCase().split(" ").join("_")
    ret_topics[topic_key] = []
    keywords.forEach(function (keyword) {
      var key = keyword.trim()
      ret_topics[topic_key].push(key)
      ret_keywords.push(key)
    });
  });
  return [ret_keywords, ret_topics]
}

//On data update the model
tc.on('data', function(data) {
  if (data["updated"]) {
    var tuple = recordsToModel(data["records"])
    ts.setKeywords(tuple[0])
    topics = tuple[1]
    console.log(topics)
  }
})

//Get data and emit
ts.on('data', function(data) {
	data.categories.forEach(function (category) {
    if (category.trim().length > 0) {
		  io.sockets.in(category).emit('message', data);
    }
	});
})