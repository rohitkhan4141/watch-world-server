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
    const usersCollection = client.db("test").collection("users");

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

    // users route
    app.post("/users", async (req, res) => {
      const getDataFromReq = req.body;
      const newUser = {
        email: getDataFromReq.email,
        name: getDataFromReq.name,
      };
      const result = await usersCollection.insertOne(newUser);
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
