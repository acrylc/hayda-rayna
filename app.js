//Requirements
var Topcap = require('topcap')
  , express = require('express')
  , app = express()
  , server = require("http").createServer(app)
  compass = require('node-compass');

app.configure(function() {
    app.use(compass());
});

var topics = {}
var topics_data = {}

//Init Topcap data provider
var tc = new Topcap(require('./tc_config.js'))

//records => [keywords, topics, topics_data]
//keywords is list of all keywords
//topics is {topic1: ["k1", "k2", "k3"], topic2: ["kv1", "kv2"]}
//topics_data is {topic1: { spreadsheet: spreadsheet, 
//description: description, title: title, images: [], subtitle: subtitle}}
function recordsToModel(records) {
  console.log("RECORD");
  var ret_keywords = [], ret_topics = {}, ret_topics_data = {}
  records.forEach(function (record) {
      console.log(record);

    var keywords = record["Keywords"].split(",")
    var topic_key = record["Topic"].toLowerCase().split(" ").join("_")
    ret_topics[topic_key] = []
    ret_topics_data[topic_key] = {}

    for (var key in record) {
      var k = key.toLowerCase();
      ret_topics_data[topic_key][k] = record[key]
    }
    ret_topics_data[topic_key]["images"] = ret_topics_data[topic_key]["images"].split(",")
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
    topics = tuple[1]
    topics_data = tuple[2]
  }
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
    temp.title_ar = topics_data[key].title_ar;
    temp.subtitle = topics_data[key].subtitle;
    temp.subtitle_ar = topics_data[key].subtitle_ar;
    covers.push(temp)
  }

  res.locals ={topics: Object.keys(topics), covers: covers}
  res.render("index")
})

app.get('/participate', function(req,res){
  console.log('Routing to participate')
});

app.get('/about', function(req,res){
  console.log('Routing to about')
});

app.get('/:topic', function(req, res) {

  if (typeof topics[req.params.topic] != "undefined") {
    var topic = topics_data[req.params.topic];
    var d = new Date(Date.parse(topic.date))
    var dd = d.getDate(); var mm = d.getMonth()+1;
    var yyyy = d.getFullYear(); 
    if(dd<10){dd='0'+dd} 
    if(mm<10){mm='0'+mm} 
    d = dd+'/'+mm+'/'+yyyy;
    res.locals = {
      topic_data: JSON.stringify(topics_data[req.params.topic])
    }
    for (var key in topic) {
      res.locals[key] = topic[key]
    }
    res.locals.date = d
    res.render('topic') 
  }
})

