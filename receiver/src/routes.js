const fs = require("fs");
const path = require("path");
const router = require("express").Router();
const { formidable } = require("formidable");

router.get("/test", (req, res) => {
  res.send(`
    <h1>Hello hellooooo</h1>
    <form enctype="multipart/form-data" method="post" action="http://localhost:3050/upload">
      <input type="file" name="file" />
      <input type="submit" />
    </form>
  `);
});

router.post("/", async (req, res) => {
  const form = formidable({});
  form
    .parse(req, (err, fields, files) => {
      if (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
        return;
      }
      // Access the uploaded file
      const fileField = files.file;
      for (const file of fileField) {
        // Specify the destination directory to save the file
        const uploadDir = path.join(__dirname, ".." ,"uploads");

        // Create the directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir);
        }

        // Move the file to the destination directory
        const filePath = path.join(uploadDir, file.originalFilename);
        fs.renameSync(file.filepath, filePath);
      }

      res.status(200).send("File uploaded successfully");
    })
    .catch((err) => res.status(500).send("Internal Server Error"));
});

module.exports = router;
