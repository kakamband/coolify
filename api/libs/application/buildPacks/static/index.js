const fs = require("fs").promises;
const { checkImageAvailable } = require("../../../common");
const { buildImage } = require("../../build/helpers");
const { streamEvents, docker } = require("../../../docker");

module.exports = async function (config) {
  if (!config.build.installCmd) config.build.installCmd = "yarn install";

  // const onlyConfigurationChanged = await checkImageAvailable(
  //   `${config.build.container.name}:${config.build.container.tag}`,
  //   engine
  // );
  if (config.build.buildCmd) await buildImage(config)

  dockerFile = `# production stage
    FROM nginx:stable-alpine
    COPY nginx.conf /etc/nginx/nginx.conf
    `;
  if (config.build.buildCmd) {
    dockerFile += `COPY --from=${config.build.container.name}:${config.build.container.tag} /usr/src/app/${config.build.publishDir} /usr/share/nginx/html`;
  } else {
    dockerFile += "COPY . /usr/share/nginx/html";
  }

  dockerFile += `
      EXPOSE 80
      CMD ["nginx", "-g", "daemon off;"]`;
  await fs.writeFile(`${config.general.workdir}/Dockerfile`, dockerFile);

  const stream = await docker.engine.buildImage(
    { src: ["."], context: config.general.workdir },
    { t: `${config.build.container.name}:${config.build.container.tag}` }
  );
  await streamEvents(stream, config);
};
