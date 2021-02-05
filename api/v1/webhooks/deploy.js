const Dockerode = require("dockerode");
const cuid = require("cuid");
const crypto = require('crypto');
const { verifyUserId} = require("../../libs/common");
const ApplicationLog = require('../../models/ApplicationLog')
const { QnB } = require("../../libs/application");


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

    const ref = request.body.ref.split("/")
    let branch = null
    if (ref[1] === "heads") {
      branch = ref.slice(2).join('/')
    } else {
      return
    }
  
    const random = cuid();

    const config = {
      previewDeploy: false,
      repository: {
        installationId: request.body.installation.id,
        id: request.body.repository.id,
        name: request.body.repository.full_name,
        branch,
      },
      general: {
        random,
        workdir: `/tmp/${random}`,
        githubAppId: request.headers["x-github-hook-installation-target-id"]
      },
      build: {
        publishDir: "",
        container: {
          name: "",
          tag: "",
        },
      },
      publish: {
        previewDomain: null,
        secrets: [],
      },
    };
    const repoId = config.repository.id.toString()
    const alreadyQueued = await ApplicationLog.find({ repoId, branch, progress: { $eq: 'building' } })
    if (alreadyQueued.length > 0) {
      reply.code(200).send({ message: "Already in the queue." });
      return
    }
    QnB(config)
    reply.code(201).send({ message: "Deployment queued." });
  });
};
