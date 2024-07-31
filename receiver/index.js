require("dotenv");
const express = require("express");
const { json, urlencoded } = require("body-parser");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3050;

const router = require("./src/routes");

app.use(cors());
app.use("/upload", router);
app.get("/", (req, res) => {
  res.status(200).send("Hello World!");
});

app.listen(port, () => {
  console.log("Listening at port " + port + " access at http://localhost:" + port);
});
