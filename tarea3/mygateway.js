import http from "http";

class Gateway {
  constructor() {}

  add_router() {
    http
      .createServer(async (req, res) => {
        switch (req.url) {
          case "/refugio":
            // Handle /refugio route
            break;
          default:
            res.writeHead(404);
            res.end("Not Found");
        }
      })
      .listen(8080, "0.0.0.0");
  }
}
