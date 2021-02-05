const { execShellAsync } = require("../common");
const Config = require("../../models/Config");
const Secret = require("../../models/Secret");
const merge = require("deepmerge");

async function generateConfiguration(config) {
  await getSecretsFromDatabase(config)
  await getConfigFromDatabase(config)
  await setDefaultConfiguration(config)
};

async function setDefaultConfiguration(config) {
  const { domain, pathPrefix, port } = config.publish;
  const { workdir, random } = config.general;

  // Default pathPrefix
  if (!pathPrefix) config.publish.pathPrefix = '/'

  // Generate valid name for the container
  config.build.container.name = domain.replace(/\//g, "-").replace(/\./g, "-");

  // Default ports
  if (!port) config.publish.port = config.buildPack === 'static' ? 80 : 3000

  // Generate a tag for the container (git commit sha)
  try {
    config.build.container.tag = (
      await execShellAsync(`cd ${workdir}/ && git rev-parse HEAD`)
    )
      .replace("\n", "")
      .slice(0, 7);
  } catch (error) {
    throw new Error(error);
  }
  if (config.previewDeploy) config.publish.previewDomain = `${random}.${config.publish.domain}`
}

async function getConfigFromDatabase(config) {
  try {
    const q = await Config.findOne({
      repoId: config.repository.id,
      branch: config.repository.branch,
    });
    if (q && Object.keys(q).length !== 0) {
      config.build = merge(config.build, q.build);
      config.publish = merge(config.publish, q.publish);
      config.buildPack = q.buildPack;
      config.previewDeploy = q.previewDeploy;
    } else {
      throw new Error("No configuration found!");
    }
  } catch (error) {
    if (error.stack) console.log(error.stack);
    throw new Error(error);
  }
};

async function getSecretsFromDatabase(config) {
  try {
    const q = await Secret.find({
      repoId: config.repository.id,
      branch: config.repository.branch,
    });
    if (q.length > 0) {
      for (const secret of q) {
        config.publish.secrets.push({
          name: secret.name,
          value: decryptData(secret.value),
        });
      }
    }
  } catch (error) {
    throw new Error(error);
  }
}

module.exports = { generateConfiguration }