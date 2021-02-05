const dayjs = require('dayjs')

const { saveServerLog } = require('../logging')
const { docker } = require('../docker')
const { execShellAsync } = require('../common');

const cloneRepository = require("./github/cloneRepository");
const { generateConfiguration } = require("./configuration");
const copyFiles = require("./deploy/copyFiles");
const buildContainer = require("./build/container");
const deploy = require("./deploy/deploy");
const Deployment = require('../../models/Deployment');
const ApplicationLog = require('../../models/ApplicationLog');

async function QnB(config) {
    try {
        const repoId = config.repository.id.toString()
        const branch = config.repository.branch
        const deployId = config.general.random
        await new Deployment({
            repoId, branch, deployId
        }).save()

        await new ApplicationLog({
            deployId,
            event: `[INFO] ${dayjs().format('YYYY-MM-DD HH:mm:ss.SSS')} Queued.`
        }).save()

        await cloneRepository(config);
        await generateConfiguration(config);

        // If domain changed, delete the old deployments
        await (await docker.engine.listServices()).filter(r => r.Spec.Labels.managedBy === 'coolify' && r.Spec.Labels.type === 'application').map(async s => {
            const running = s.Spec.Labels
            if (running.repoId === repoId && running.branch === branch) {
                console.log(running.domain, config.publish.domain)
                if (running.domain !== config.publish.domain) {
                    await execShellAsync(`docker stack rm ${s.Spec.Labels['com.docker.stack.namespace']}`)
                }
            }

        })
        await copyFiles(config);
        await buildContainer(config);
        await deploy(config);
    } catch (error) {
        await saveServerLog(error, config)
    }
}

module.exports = { QnB }
