const ApplicationLog = require("../models/ApplicationLog");
const ServerLog = require("../models/ServerLog");
const dayjs = require('dayjs')

function generateTimestamp() {
  return `[INFO] ${dayjs().format('YYYY-MM-DD HH:mm:ss.SSS')} `
}

async function saveAppLog(event, config) {
  try {
    const deployId = config.general.random;
    const repoId = config.repository.id;
    const branch = config.repository.branch;
    if (event && event !== "\n")  {
      const clearedEvent = generateTimestamp() + event.replace(/(\r\n|\n|\r)/gm, "")
      try {
        await new ApplicationLog({ repoId, branch, deployId, event: clearedEvent }).save()
      } catch (error) {
        console.log(error);
      }
    }
  } catch (error) {
    console.log(error);
    return error;
  }
}

async function saveServerLog (log, config) {
  console.log('-------')
  console.log(log)
  if (config) {
    const deployId = config.general.random;
    const repoId = config.repository.id;
    const branch = config.repository.branch;
    await new ApplicationLog({ repoId, branch, deployId, event: `[SERVER ERROR 😖]: ${log}`}).save()
  }
  await new ServerLog({ event: log.stack || log}).save()
  console.log('-------')
}

module.exports = {
  saveAppLog,
  saveServerLog
};
