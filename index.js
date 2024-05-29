const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
var jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;
// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.grteoyu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// custom midlw=eware verify token
const verifytoken = (req, res, next) => {
  // console.log("inside verifytoken middleware", req.headers.authorization);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorised access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  // console.log("get token", token);
  jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorised access" });
    }
    req.decoded = decoded;
    console.log("from verifytoken decoded", decoded);
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("bistroDb").collection("users");
    const menuCollection = client.db("bistroDb").collection("menu");
    const reviewsCollection = client.db("bistroDb").collection("reviews");
    const cartsCollection = client.db("bistroDb").collection("carts");

    // custom middleware
    // custom middleware
    // verify token middlwware

    // verify admin after checking verfytoken
    const verifyadmin = async (req, res, next) => {
      const email = req.decoded.email;
      console.log("verify admin ", email);
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      console.log("inside verifyadmin", isAdmin);
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // jwt related api

    app.post("/jwt", async (req, res) => {
      const userinfo = req.body;
      console.log("inside jwt", userinfo);
      const token = await jwt.sign(userinfo, process.env.ACCESS_SECRET_TOKEN, {
        expiresIn: "4h",
      });
      // console.log(token);

      res.send({ token });
    });

    // user related api

    app.get("/users", verifytoken, verifyadmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // check admin
    app.get("/users/admin/:email", verifytoken, async (req, res) => {
      const email = req.params.email;
      console.log("inside useAdmin route", req.decoded.email);
      console.log("inside useAdmin params", email);

      if (email !== req.decoded.email) {
        return res.status(401).send({
          message: "Unauthorize access",
        });
      }
      const query = {
        email: email,
      };
      console.log(query);
      const user = await userCollection.findOne(query);
      console.log("inside useAdmin route", user);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.post("/users", async (req, res) => {
      // INSERT EMAIL IF USER DOESNOT EXIST
      // you can do this in many ways
      // 1. unique email in database 2. upsert 3. simple we will follow the num 3 way in this case

      const user = req.body;
      const query = {
        email: user.email,
      };
      const isUserExist = await userCollection.findOne(query);
      if (isUserExist) {
        return res.send({
          message: "user already exist ",

          insertedId: null,
        });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.delete("/users/:id", verifytoken, verifyadmin, async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // make admin role
    app.patch(
      "/users/admin/:id",
      verifytoken,
      verifyadmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    // menu related api

    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);
      res.send(result);
    });
    app.patch("/menu/:id", verifytoken, verifyadmin, async (req, res) => {
      const id = req.params.id;
      const item = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image,
        },
      };
      const result = await menuCollection.updateOne(filter, updatedoc);
      res.send(result);
    });

    app.delete("/menu/:id", verifytoken, verifyadmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/menu", verifytoken, verifyadmin, async (req, res) => {
      const menuItem = req.body;
      const result = await menuCollection.insertOne(menuItem);
      res.send(result);
    });

    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });

    //carts collection
    app.get("/carts", async (req, res) => {
      const userEmail = req.query?.email;

      const filter = { email: userEmail };

      const result = await cartsCollection.find(filter).toArray();
      res.send(result);
    });
    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartsCollection.insertOne(cartItem);
      res.send(result);
    });
    // delete a item from my cart
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("bistro boss is running!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
