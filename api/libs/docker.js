const Dockerode = require('dockerode')
const { saveAppLog } = require("./logging");

const docker = {
  engine: new Dockerode({
    socketPath: process.env.DOCKER_ENGINE,
  }),
  network: process.env.DOCKER_NETWORK
}
async function streamEvents(stream, config) {
  try {
    await new Promise((resolve, reject) => {
      docker.engine.modem.followProgress(stream, onFinished, onProgress);
      function onFinished(err, res) {
        if (err) reject(err);
        resolve(res);
      }
      function onProgress(event) {
        saveAppLog(event.stream || event.error, config)
        if (event.error) {
          reject(event.error);
        }
      }
    });
  } catch (error) {
    throw new Error(error);
  }
}

 
module.exports = { streamEvents, docker };
