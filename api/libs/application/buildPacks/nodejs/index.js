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

  let dockerFile = `# production stage
      FROM node:lts
      WORKDIR /usr/src/app
      `;
  if (config.build.buildCmd) {
    dockerFile += `COPY --from=${config.build.container.name}:${config.build.container.tag} /usr/src/app/${config.build.publishDir} /usr/src/app`;
  } else {
    dockerFile += `COPY . ./`;
  }
  if (config.build.installCmd) {
    dockerFile += `
      RUN ${config.build.installCmd}
      `;
  }
  dockerFile += `
        EXPOSE ${config.publish.port}
        CMD [ "yarn", "start" ]`;

  await fs.writeFile(`${config.general.workdir}/Dockerfile`, dockerFile);
  const stream = await docker.engine.buildImage(
    { src: ["."], context: config.general.workdir },
    { t: `${config.build.container.name}:${config.build.container.tag}` }
  );
  await streamEvents(stream, config);
};
