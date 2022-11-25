const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 5000;
require("dotenv").config();
const jwt = require("jsonwebtoken");
const app = express();
//middleware
app.use(cors());
app.use(express.json());

const verifyJwt = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("unAuthorized Access");
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
};

// connect mongodb
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.oe1j3.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    // collections
    const usersCollection = client.db("watchsWorld").collection("users");
    const categoriesCollection = client
      .db("watchsWorld")
      .collection("categories");
    const watchesCollection = client.db("watchsWorld").collection("watches");

    const myBookedWatchesCollection = client
      .db("watchsWorld")
      .collection("myBookedWatches");

    // creating a jwt token route

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const isAlreadyExisted = await usersCollection.findOne(query);
      if (isAlreadyExisted) {
        const token = jwt.sign({ email: email }, process.env.ACCESS_SECRET, {
          expiresIn: "10h",
        });
        return res.status(200).send({
          accessToken: token,
        });
      }
      res.status(403).send({
        accessToken: "",
        message: "Forbidden User",
      });
    });

    // categories route

    app.get("/categories", async (req, res) => {
      const query = {};
      const result = await categoriesCollection.find(query).toArray();
      res.send(result);
    });

    // categorie based wathes route

    app.get("/categories/:name", async (req, res) => {
      const query = {
        categorieName: req.params.name,
      };
      const result = await watchesCollection.find(query).toArray();
      res.send(result);
    });

    // booking watch route

    app.get("/mybookings", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await myBookedWatchesCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/mybookings", async (req, res) => {
      const myWathesBookings = req.body;
      const query = { watchName: myWathesBookings?.watchName };
      const isExisted = await myBookedWatchesCollection.findOne(query);

      if (isExisted) {
        return res.send({ message: "Alredy Booked" });
      }
      const result = await myBookedWatchesCollection.insertOne(
        myWathesBookings
      );
      res.send(result);
    });

    // users route

    // admin varified routes
    app.get("/allbuyers", async (req, res) => {
      const query = {
        role: "buyer",
      };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/allsellers", async (req, res) => {
      const query = {
        role: "seller",
      };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    app.put("/users", async (req, res) => {
      const getDataFromReq = req.body;
      const query = { email: getDataFromReq.email };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          email: getDataFromReq.email,
          name: getDataFromReq?.name,
          role: getDataFromReq?.role,
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });
  } finally {
  }
}

run().catch((err) => console.log(err));

app.get("/", (req, res) => {
  res.send("server suru hoitasi");
});

app.listen(port);
