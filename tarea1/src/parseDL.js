export default function parseDL(content) {
  const archivo = {
    className: null,
    methods: [],
  };

  const lines = content.split("\n");

  for (const line of lines) {
    if (line.startsWith("@Path:")) {
      archivo.path = line.split(":")[1].trim();
    }

    if (line.startsWith("@Class:")) {
      archivo.className = line.split(":")[1].trim();
    }

    if (line.startsWith("@Method:")) {
      const name = line.match(/@Method:(\w+)/)[1];
      const params = line
        .match(/\((.*?)\)/)[1]
        .split(",")
        .map((p) => p.trim().split(":")[0]);

      archivo.methods.push({ name, params });
    }
  }

  return archivo;
}
