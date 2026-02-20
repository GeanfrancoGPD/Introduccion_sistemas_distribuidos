import fs from "fs";
import parseDL from "./src/parseDL.js";
import generateServer from "./src/generateServer.js";
import generateClient from "./src/generateClient.js";

const content = fs.readFileSync("calc.dl", "utf8");
const data = parseDL(content);

console.log(data);

generateServer(data);
generateClient(data);
