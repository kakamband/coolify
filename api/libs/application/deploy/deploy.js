const yaml = require("js-yaml");
const { execShellAsync } = require("../../common");
const { docker } = require('../../docker')
const { saveAppLog } = require("../../logging");
const fs = require('fs').promises

module.exports = async function (config) {
  try {
    const generateEnvs = {};
    for (const secret of config.publish.secrets) {
      generateEnvs[secret.name] = secret.value;
    }
    const containerName = config.previewDeploy ? config.general.random : config.build.container.name
    const previewDomain = config.publish.previewDomain || config.publish.domain
    const stack = {
      version: "3.8",
      services: {
        [containerName]: {
          image: `${config.build.container.name}:${config.build.container.tag}`,
          networks: [`${docker.network}`],
          environment: generateEnvs,
          deploy: {
            replicas: 1,
            update_config: {
              parallelism: 0,
              delay: "10s",
              order: "start-first",
            },
            rollback_config: {
              parallelism: 0,
              delay: "10s",
              order: "start-first",
            },
            labels: [
              "managedBy=coolify",
              "type=application",
              "branch=" + config.repository.branch,
              "org=" + config.repository.name.split('/')[0],
              "repo=" + config.repository.name.split('/')[1],
              "repoId=" + config.repository.id,
              "domain=" + config.publish.domain,
              "isPreviewDeploy=" + config.previewDeploy,
              "previewDomain=" + previewDomain,
              "pathPrefix=" + config.publish.pathPrefix,
              "traefik.enable=true",
              "traefik.http.services." +
              config.build.container.name +
              `.loadbalancer.server.port=${config.publish.port}`,
              "traefik.http.routers." +
              config.build.container.name +
              ".entrypoints=websecure",
              "traefik.http.routers." +
              config.build.container.name +
              ".rule=Host(`" +
              previewDomain +
              "`) && PathPrefix(`" +
              config.publish.pathPrefix +
              "`)",
              "traefik.http.routers." +
              config.build.container.name +
              ".tls.certresolver=letsencrypt",
              "traefik.http.routers." +
              config.build.container.name +
              ".middlewares=global-compress",
            ],
          },
        },
      },
      networks: {
        [`${docker.network}`]: {
          external: true,
        },
      },
    };
    await fs.writeFile(`${config.general.workdir}/stack.yml`, yaml.dump(stack))
    await execShellAsync(
      `cat ${config.general.workdir}/stack.yml |docker stack deploy -c - ${containerName}`
    );
    await saveAppLog("Published!", config);
  } catch (error) {
    await saveAppLog(`Error occured during deployment: ${error.message}`, config)
    throw new Error(error);
  }
};
