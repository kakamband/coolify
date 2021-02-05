const fs = require("fs").promises;
const { checkImageAvailable } = require("../../common");
const { streamEvents, docker } = require("../../docker");

async function buildImage(config) {
    dockerFile = `
                # build
                FROM node:lts
                WORKDIR /usr/src/app
                COPY package*.json .
                `;
    if (config.build.installCmd) {
        dockerFile += `RUN ${config.build.installCmd}
                `;
    }
    dockerFile += `COPY . .
            RUN ${config.build.buildCmd}`;

    await fs.writeFile(`${config.general.workdir}/Dockerfile`, dockerFile);
    const stream = await docker.engine.buildImage(
        { src: ["."], context: config.general.workdir },
        { t: `${config.build.container.name}:${config.build.container.tag}` }
    );
    await streamEvents(stream, config);
}

module.exports = {
    buildImage
}