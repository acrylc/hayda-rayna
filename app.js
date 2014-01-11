//Requirements
var credentials = require("./credentials.js")
  , Topcap = require('topcap')
  , TwitterStream = require("./twitterStream.js")
  , express = require('express')
  , app = express()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server),
  compass = require('node-compass');

app.configure(function() {
    app.use(compass());
});

var topics = {}
var topics_data = {}

io.set('log level', 2)

//Socket handler
io.sockets.on('connection', function(socket) {
	socket.on('subscribe', function(topic) { 
        topics[topic].forEach(function (keyword) {
          keyword.split(" ").forEach(function (split_keyword) {
            socket.join(split_keyword)
          });
        });
    })

    socket.on('unsubscribe', function(topic) {  
        topics[topic].forEach(function (keyword) {
        	socket.leave(keyword)
        });
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
  var ret_keywords = [], ret_topics = {}, ret_topics_data = {}
  records.forEach(function (record) {
    var keywords = record["Keywords"].split(",")
    var topic_key = record["Topic"].toLowerCase().split(" ").join("_")
    ret_topics[topic_key] = []
    ret_topics_data[topic_key] = {}
    ret_topics_data[topic_key].timeline = record["Timeline"]
    ret_topics_data[topic_key].title = record["Title"]
    ret_topics_data[topic_key].subtitle = record["Subtitle"]
    ret_topics_data[topic_key].images = record["Images"].split(",")
    ret_topics_data[topic_key].description = record["Description"]
    ret_topics_data[topic_key].cover = record["Cover"]
    keywords.forEach(function (keyword) {
      var key = keyword.trim()
      ret_topics[topic_key].push(key)
      ret_keywords.push(key)
    });
  });
  return [ret_keywords, ret_topics, ret_topics_data]
}

//On data update the model
tc.on('data', function(data) {
  if (data["updated"]) {
    var tuple = recordsToModel(data["records"])
    ts.setKeywords(tuple[0])
    topics = tuple[1]
    topics_data = tuple[2]
    // console.log(topics_data)
  }
})

//Get data and emit
ts.on('data', function(data) {
	data.categories.forEach(function (category) {
		io.sockets.in(category).emit('message', data);
	});
})

//Server config
server.listen(4000)
app.set('view engine', 'html');
app.enable('view cache');
app.set('layout', 'layout')
app.engine('html', require('hogan-express'))
app.set('views', __dirname + '/views')
app.use("/public", express.static(__dirname + '/public'))


app.use(express.bodyParser())
app.use(app.router)

app.get("/", function(req, res) {
  covers = []
  for (var key in topics) {
    temp = {}
    temp.url = key
    temp.cover = topics_data[key].cover;
    temp.title = topics_data[key].title;
    temp.subtitle = topics_data[key].subtitle;
    covers.push(temp)
  }

  res.locals ={topics: Object.keys(topics), covers: covers}
  res.render("index")
})

      // timeline: topics_data[topic_key].timeline,
      // description: topics_data[topic_key].description,
      // title: topics_data[topic_key].title,
      // subtitle: topics_data[topic_key].subtitle,
      // images: topics_data[topic_key].images
app.get('/:topic', function(req, res) {

  if (typeof topics[req.params.topic] != "undefined") {
    var topic = topics_data[req.params.topic]
    res.locals = {
      topic: topic,
      cover: topic.cover,
      images: topic.images,
      description: topic.description,
      topic_data: JSON.stringify(topics_data[req.params.topic])
    }
    res.render('topic') 
  }
})

