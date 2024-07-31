const { default: axios } = require("axios");
const http = require("http");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");

const fileName = "Lorem Ipsum Video.mp4";
const filePath = path.resolve(__dirname, "..", "upload", fileName);
const file = fs.createReadStream(filePath);
const form = new FormData();
form.append("file", file);

axios({
  url: "http://localhost:3050/upload",
  method: "POST",
  maxBodyLength: Infinity,
  data: form,
  headers: {
    ...form.getHeaders(),
  },
})
  .then((res) => {
    console.log("Success");
  })
  .catch((error) => {
    console.log(error.message);
  });
// (async function () {
//   uploader.upload(filePath, {
//     name: fileName,
//   });
// })();
