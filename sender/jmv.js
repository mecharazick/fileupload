require("dotenv");
const fs = require("fs");
const { default: axios } = require("axios");
const http = require("http");
const path = require("path");

const config = {
  email: process.env.user || "",
  password: process.env.password || "",
  resource: process.env.resource || "",
};

class JMV {
  email;
  password;
  resource;
  token;
  authenticating = false;
  isAuthenticated = false;
  baseUrl = "http://api.jmvstream.com/v1";
  openApi = axios.create({
    baseURL: this.baseUrl,
  });
  protectedApi = axios.create({
    baseURL: this.baseUrl,
    httpAgent: new http.Agent({ keepAlive: true }),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  endpoints = {
    authenticate: "/authenticate",
    createUpload: "/videos",
    uploadVideo: "/videos/uploads",
    verifyUpload: "/videos/uploads",
    getLinkPlayer: "/players",
    getFolder: "/folders",
  };
  constructor(credentials) {
    if (!credentials) throw new Error("Must provide credentials");
    if (typeof credentials === "object") {
      if (!credentials.email || !credentials.password || !credentials.resource)
        throw new Error("Must provide email, password and resource");
      const { email, password, resource } = credentials;
      if (!!email && !!password && !!resource) {
        this.email = email;
        this.password = password;
        this.resource = resource;
        this.authenticate();
      }
    }
    return;
  }
  initialize(credentials) {
    if (!credentials) throw new Error("Must provide credentials");
    const { email, password, resource } = credentials;
    this.email = email;
    this.password = password;
    this.resource = resource;
    this.authenticate();
  }
  async authenticate(options) {
    if (
      (this.authenticating && !options.authenticationOwner) ||
      this.isAuthenticated
    )
      return;
    this.authenticating = true;
    if (typeof options === "object" && options.retries && options.retries > 5) {
      return;
    }
    try {
      const body = {
        email: this.email,
        password: this.password,
        resource: this.resource,
      };
      const res = await this.openApi.post(this.endpoints.authenticate, body);
      const data =
        typeof res.data === "string" ? await JSON.parse(res.data) : res.data;
      const token = data.token;
      this.token = `Bearer ${token}`;
      this.protectedApi.defaults.headers.common["Authorization"] = this.token;
      this.authenticating = false;
      this.isAuthenticated = true;
      return;
    } catch (err) {
      console.log(err.message);
      this.authenticate({
        retries: (typeof options === "object" && options.retries + 1) || 1,
        authenticationOwner: true,
      });
    }
  }
  /*Upload é um método recursivo que em caso de erro se chama novamente 
  para tentar terminar o envio do arquivo a partir do ponto em que houve erro
  */
  async upload(filePath, params, startcb, progresscb, endcb) {
    if (typeof filePath === "string") {
      if (params.size) {
        params.size = params.size - params.startOffset;
      } else {
        params.size = fs.statSync(filePath).size;
      }
    } else {
      throw new Error("File path must be string");
    }
    if (!params.startOffset || params.startOffset === 0) {
      params.startOffset = 0;
      const video_id = await this.createUploadAPI(params);
      params.video_id = video_id;
    }
    const fileStream = fs.createReadStream(filePath, {
      start: params.startOffset,
      end: params.size - 1,
    });
    fileStream
      .on(
        "open",
        async function () {
          console.log("Starting Read Stream", params.name);
          this.uploadAPI(fileStream, params, endcb);
          startcb && startcb(null, { ...params });
        }.bind(this)
      )
      .on("data", () => {
        progresscb && progresscb(null, { ...params });
      })
      .on("end", () => {
        console.log("Finished Read Stream", params.name);
        fileStream.close();
      })
      .on(
        "error",
        async function (err) {
          fileStream.close();
          startcb && startcb(err);
          const uploadStatus = await this.uploadStatusAPI(params.video_id);
          if (uploadStatus["Upload-Offset"] !== uploadStatus["Upload-length"]) {
            params.startOffset = uploadStatus["Upload-Offset"];
            this.upload(filePath, params, startcb, progresscb, endcb);
          }
        }.bind(this)
      );
  }
  delete(videoId) {}
  listVideos() {}
  async createUploadAPI(params) {
    const nameBase64 = Buffer.from(params.name, "binary").toString("base64");
    const headers = {
      ["Tus-Resumable"]: "1.0.0",
      ["Upload-Length"]: params.size,
      ["Upload-Metadata"]: `filename ${nameBase64}`,
    };
    if (params.albumId) {
      headers["gallery"] = params.albumId;
    }
    const res = await this.protectedApi.post(
      this.endpoints.createUpload,
      {},
      {
        headers: headers,
      }
    );
    const video_id = this.getVideoId(res.headers["location"]);
    return video_id;
  }
  async uploadAPI(data, params, cb) {
    const nameBase64 = Buffer.from(params.name, "binary").toString("base64");
    const headers = {
      ["Tus-Resumable"]: "1.0.0",
      ["Content-Type"]: "application/offset+octet-stream",
      ["Content-Length"]: params.size,
      ["Upload-Metadata"]: `filename ${nameBase64}`,
      ["Upload-Offset"]: params.startOffset,
    };
    if (params.albumId) {
      headers["gallery"] = params.albumId;
    }
    try {
      const ep = this.endpoints.uploadVideo + `/${params.video_id}`;
      console.log("Enviando", params);
      const res = await this.protectedApi.patch(ep, data, {
        headers: headers,
      });
      console.log("Enviado", res?.request?.headers, res?.status, res?.data);
      cb && cb(null, params);
    } catch (err) {
      console.log(
        "Upload error: ",
        err.message,
        "; Response Status",
        err.response?.status
      );
      if (err.response?.status === 401) {
        this.isAuthenticated = false;
        await this.authenticate();
        this.uploadAPI(data, params, cb);
      } else {
        cb && cb(err);
      }
    }
  }
  async uploadStatusAPI(video_id) {
    const resp = await this.protectedApi.head(
      this.endpoints.verifyUpload + `/${video_id}`
    );
    return resp.data;
  }
  getVideoId(fileServerPath) {
    const divider = "/";
    const pathArray = fileServerPath.split(divider);
    const video_id = pathArray[pathArray.length - 1];
    return video_id;
  }
}

const jmvClient = new JMV(config);

setTimeout(() => {
  const file = "Lorem Ipsum Video.mp4";
  const filePath = path.resolve("..", "upload", file);
  const params = {};
  params.name = file;
  jmvClient.upload(filePath, params);
}, 1000 * 5);
