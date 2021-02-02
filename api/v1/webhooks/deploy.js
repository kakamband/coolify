const Dockerode = require("dockerode");
const getSecrets = require("../../libs/getSecret");
const getConfig = require("../../libs/getConfig");
const cloneRepository = require("../../libs/cloneRepository");
const generateConfig = require("../../libs/generateConfig");
const copyFiles = require("../../libs/copyFiles");
const buildContainer = require("../../libs/buildContainer");
const deploy = require("../../libs/deploy");
const cuid = require("cuid");
const Log = require('../../models/Log')
const Deployment = require('../../models/Deployment')
const Config = require('../../models/Config')
const dayjs = require('dayjs')
const crypto = require('crypto');
const { verifyUserId, execShellAsync } = require("../../libs/common");
const dockerEngine = new Dockerode({
  socketPath: process.env.DOCKER_ENGINE,
});
module.exports = async function (fastify) {
  // TODO: Add this to fastify plugin
  const postSchema = {
    body: {
      type: "object",
      properties: {
        ref: { type: "string" },
        repository: {
          type: "object",
          properties: {
            id: { type: "number" },
            full_name: { type: "string" },
          },
          required: ["id", "full_name"],
        },
        installation: {
          type: "object",
          properties: {
            id: { type: "number" },
          },
          required: ["id"],
        },
      },
      required: ["ref", "repository", "installation"],
    },
  };
  fastify.post("/", { schema: postSchema }, async (request, reply) => {

    if (request.headers.manual) {
      if (!await verifyUserId(request.headers.authorization)) {
        reply.code(500).send({ success: false, error: "Invalid request" });
        return
      }
    } else {
      const hmac = crypto.createHmac('sha256', fastify.config.GITHUP_APP_WEBHOOK_SECRET)
      const digest = Buffer.from('sha256=' + hmac.update(JSON.stringify(request.body)).digest('hex'), 'utf8')
      const checksum = Buffer.from(request.headers["x-hub-signature-256"], 'utf8')
      if (checksum.length !== digest.length || !crypto.timingSafeEqual(digest, checksum)) {
        reply.code(500).send({ success: false, error: "Invalid request" });
        return
      }
    }
    if (request.headers["x-github-event"] !== "push") {
      reply.code(500).send({ success: false, error: "Not a push event." });
      return;
    }
    const appId = request.headers["x-github-hook-installation-target-id"];
    const random = cuid();
    const ref = request.body.ref.split("/")
    let branch = null
    if (ref[1] === "heads") {
      branch = ref.slice(2).join('/')
    } else {
      return
    }
    const config = {
      repository: {
        installationId: request.body.installation.id,
        id: request.body.repository.id,
        name: request.body.repository.full_name,
        branch,
      },
      general: {
        random,
        workdir: `/tmp/${random}`,
      },
      build: {
        container: {
          name: "",
          tag: "",
        },
      },
      publish: {
        secrets: [],
      },
    };
    const repoId = config.repository.id
    const deployId = config.general.random
    const alreadyQueued = await Log.find({ repoId, branch, progress: { $eq: 'building' } })
    if (alreadyQueued.length > 0) {
      reply.code(200).send({ message: "Already queued." });
      return
    }

    reply.code(201).send({ message: "Added to the queue." });
    await new Deployment({
      repoId, branch, deployId
    }).save()

    await new Log({
      deployId,
      events: [`[INFO] ${dayjs().format('YYYY-MM-DD HH:mm:ss.SSS')} Queued.`]
    }).save()

    try {
      await getSecrets(config);
      await getConfig(config);

      // If domain changed, delete the old deployement
      await (await dockerEngine.listServices()).filter(r => r.Spec.Labels.managedBy === 'coolify' && r.Spec.Labels.type === 'application').map(async s => {
        const running = s.Spec.Labels
        if (running.domain !== config.publish.domain) {
          await execShellAsync(`docker stack rm ${s.Spec.Labels['com.docker.stack.namespace']}`)
        }
      })
      
      await cloneRepository(
        config,
        appId,
        fastify.config.GITHUB_APP_PRIVATE_KEY
      );
      await generateConfig(config);
      await copyFiles(config.general.workdir);
      await buildContainer(config, dockerEngine);
      await deploy(config, fastify.config.DOCKER_NETWORK);
    } catch (error) {
      console.log("webhook error");
      console.log(error);
    }
  });
};
