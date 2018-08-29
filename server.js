'use strict';

var express = require('express');
var mongoose = require('mongoose');
var cors = require('cors');
var app = express();
var bodyParser = require('body-parser');
var dns = require('dns');
var dotenv = require('dontenv');

dotenv.load();

var port = process.env.PORT || 3000;
console.log("env", process.env.MONGOLAB_URI);
mongoose.connect(process.env.MONGOLAB_URI);

app.use(cors());

app.use(bodyParser.urlencoded({extended: false}));

app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/views/index.html');
});

const counterSchema = new mongoose.Schema({
  _id: {type: String, required: true}, 
  seq: {type: Number, default: 0}
});

const Counter = mongoose.model("Counter", counterSchema);

const urlSchema = new mongoose.Schema({
  original_url: String, 
  short_url: Number
});

const URL = mongoose.model("URL", urlSchema);

app.post("/api/shorturl/new", (req, res) => {
  const url = {original_url: req.body.url};
  URL.findOne(url).lean().exec()
    .then(result => {
      if(result === null) {
        dns.lookup(req.body.url.split(/^https?:\/\//m)[1], (err, addresses, family) => {
          if(err) {
            console.log(err);
            res.send({error: "invalid URL"});
          } else {
            // transactions are supported in MongoDB 4.0 and Mongoose 5.2.0
            Counter.findByIdAndUpdate(
              "short_url", 
              {$inc: { seq: 1} },
              {new:true, upsert: true, lean: true}
            ) 
            .then(result => {
              url.short_url = result.seq;
              
              URL.create(url)
              .then(result => {
                res.send({original_url: result.original_url, short_url: result.short_url});
              })
              .catch(err => {
                console.log(err);
                res.status(500).send("Something went wrong.");
              });
            })
            .catch(err => console.log(err));
          }
        });
      } else {
        res.send({original_url: result.original_url, short_url: result.short_url});
      }
    })
    .catch(err => {
      console.log(err);
      res.status(500).send("Something went wrong.");
    });
});

app.get("/api/shorturl/:url", (req, res) => {
  URL.findOne({short_url: req.params.url}).lean().exec()
  .then(result => {
    res.redirect(result.original_url);
  })
  .catch(err => console.log(err));
});

app.listen(port, () => {
  console.log('Server is listening on port ' + port);
});