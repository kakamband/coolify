const buildPacks = require("../buildPacks");
const { saveAppLog, saveServerLog } = require("../../logging");
const Deployment = require('../../../models/Deployment')
/* const { checkImageAvailable, execShellAsync } = require("./common"); */

module.exports = async function (config) {
  const repoId = config.repository.id
  const branch = config.repository.branch
  const deployId = config.general.random
  const execute = buildPacks[config.buildPack];
  if (execute) {
    try {
      await Deployment.findOneAndUpdate(
        { repoId, branch, deployId },
        { repoId, branch, deployId, progress: 'inprogress' })

      await saveAppLog("Work-work.", config);
      try {
        await execute(config);
        await saveAppLog("Work-work done.", config);
        await Deployment.findOneAndUpdate(
          { repoId, branch, deployId },
          { repoId, branch, deployId, progress: 'done' })
      } catch (error) {
        await saveServerLog(error)
        await Deployment.findOneAndUpdate(
          { repoId, branch, deployId },
          { repoId, branch, deployId, progress: 'failed' })
          throw new Error(error);
      }
    } catch (error) {
      await Deployment.findOneAndUpdate(
        { repoId, branch, deployId },
        { repoId, branch, deployId, progress: 'failed' })
      //throw new Error(error);
    }
  } else {
    await Deployment.findOneAndUpdate(
      { repoId, branch, deployId },
      { repoId, branch, deployId, progress: 'failed' })
    console.error("No buildpack found.");
    throw new Error("No buildpack found.");
  }
};
