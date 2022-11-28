const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
// const stripe = require("stripe")(process.env.STRIPE_SECRET);

const Stripe = require("stripe");
const stripe = Stripe(
  "sk_test_51M8A9vB7GM64ljvN9XSkn7o9xILsfheA7zfUzTKez9Mlxpbz5Ui0KJkbYuXTzTcAywZeIwwJ3KRSVjDHY017OJiq00d6r6TuU2"
);

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

    const advertisedProduct = client.db("watchsWorld").collection("addProduct");

    const sellerCollection = client
      .db("watchsWorld")
      .collection("sellerProduct");

    const productReportCollection = client
      .db("watchsWorld")
      .collection("product-report");

    //verify admin
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.isAdmin !== true) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };

    // verify seller
    const verifySeller = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "seller") {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };

    // creating a jwt token route

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const isAlreadyExisted = await usersCollection.findOne(query);
      if (isAlreadyExisted) {
        const token = jwt.sign({ email: email }, process.env.ACCESS_SECRET);
        return res.status(200).send({
          accessToken: token,
        });
      }
      res.status(403).send({
        accessToken: "",
        message: "Forbidden User",
      });
    });

    // report to admin

    app.post("/report", verifyJwt, async (req, res) => {
      const id = req.body._id;
      const query = { _id: id };
      const isExisted = await productReportCollection.findOne(query);
      if (isExisted) {
        return res.send({
          message: "Already Reported",
        });
      }
      const result = await productReportCollection.insertOne(req.body);
      res.send(result);
    });

    app.get("/report", verifyJwt, verifyAdmin, async (req, res) => {
      const query = {};
      const result = await productReportCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/report/:id", verifyJwt, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const filter = { _id: id };
      const result = await productReportCollection.deleteOne(filter);
      const response = await watchesCollection.deleteOne(query);
      res.send(response);
    });

    // categories route and homepage route

    app.get("/categories", async (req, res) => {
      const query = {};
      const result = await categoriesCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/advertisedproduct", async (req, res) => {
      const query = {};
      const result = await advertisedProduct.find(query).toArray();
      res.send(result);
    });

    app.delete("/advertisedproduct/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const filter = { _id: id };
      const userResult = await watchesCollection.deleteOne(query);
      const advertiseResult = await advertisedProduct.deleteOne(filter);
      res.send(advertiseResult);
    });
    // categorie based wathes route

    app.get("/categories/:name", verifyJwt, async (req, res) => {
      const query = {
        categorieName: req.params.name,
      };
      const result = await watchesCollection.find(query).toArray();
      res.send(result);
    });

    // booking watch route

    app.get("/mybookings", verifyJwt, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await myBookedWatchesCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/mybookings", async (req, res) => {
      const myWathesBookings = req.body;
      const query = {
        watchName: myWathesBookings?.watchName,
        email: myWathesBookings?.email,
      };
      const isExisted = await myBookedWatchesCollection.findOne(query);

      if (isExisted) {
        return res.send({ message: "Alredy Booked" });
      }
      const result = await myBookedWatchesCollection.insertOne(
        myWathesBookings
      );
      res.send(result);
    });

    // sellers routes

    app.post("/products", verifyJwt, verifySeller, async (req, res) => {
      const product = req.body;
      const pushToSellerCollection = await sellerCollection.insertOne(product);
      const result = await watchesCollection.insertOne(product);
      res.send(result);
    });

    app.post(
      "/products/advertise",
      verifyJwt,
      verifySeller,
      async (req, res) => {
        const product = req.body;
        console.log(product);
        const result = await advertisedProduct.insertOne(product);
        res.send(result);
      }
    );

    app.get("/products", verifyJwt, verifySeller, async (req, res) => {
      const email = req.query.email;
      const query = { sellerEmail: email };
      //ekhane change korsi seller colletion
      const result = await sellerCollection.find(query).toArray();
      res.send(result);
    });

    app.put("/products/:id", verifyJwt, verifySeller, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          advertise: true,
        },
      };
      // egla porer
      const response = await sellerCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.send(response);
    });

    app.delete("/products/:id", verifyJwt, verifySeller, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const filter = { _id: id };
      const deleteFromAdvertise = await advertisedProduct.deleteOne(filter);
      const response = await watchesCollection.deleteOne(query);
      const result = await sellerCollection.deleteOne(query);
      res.send(result);
    });

    // get seller by email;

    app.get(
      "/users/sellers/:email",
      verifyJwt,
      verifySeller,
      async (req, res) => {
        const email = req.params.email;
        const query = { email };
        const user = await usersCollection.findOne(query);
        res.send(user);
      }
    );

    // get a single user information

    app.get("/watches/:id", verifyJwt, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await myBookedWatchesCollection.findOne(query);
      if (result?.watchId) {
        const filter = { _id: ObjectId(result?.watchId) };
        const response = await watchesCollection.findOne(filter);
        response.myBookingWatchId = id;
        res.send(response);
      }
    });

    app.put("/product/:id", verifyJwt, async (req, res) => {
      const id = req.params.id;
      const myBookingWatchId = req.body?.myBookingWatchId;
      const query = { _id: ObjectId(id) };
      const fileter = { _id: ObjectId(myBookingWatchId) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          transactionId: req.body?.transactionId,
        },
      };
      const addToMyOrdersCollection = await myBookedWatchesCollection.updateOne(
        fileter,
        updateDoc,
        options
      );
      const result = await sellerCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.send(result);
    });

    // users route

    // admin varified routes
    app.get("/allbuyers", verifyJwt, verifyAdmin, async (req, res) => {
      const query = {
        role: "buyer",
      };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/allsellers", verifyJwt, verifyAdmin, async (req, res) => {
      const query = {
        role: "seller",
      };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/users/:id", verifyJwt, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    app.put("/users/:id", verifyJwt, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          isSellerVerified: true,
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc, options);
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

    // check if the user is admin or not

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.isAdmin });
    });

    // check if the user is seller or not

    app.get("/users/seller/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      if (user?.role === "seller") {
        return res.send({ isSeller: true });
      } else {
        return res.send({ isSeller: false });
      }
    });

    // payment

    app.post("/create-payment-intent", async (req, res) => {
      const price = req.body.resalePrice;
      const amount = parseInt(price) * 100;
      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
  } finally {
  }
}

run().catch((err) => console.log(err));

app.get("/", (req, res) => {
  res.send("server suru hoitasi");
});

app.listen(port);
