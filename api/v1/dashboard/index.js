const Config = require("../../models/Config");
const Deployment = require("../../models/Deployment");
const Dockerode = require("dockerode");
const dockerEngine = new Dockerode({
  socketPath: process.env.DOCKER_ENGINE,
});
module.exports = async function (fastify) {
  // TODO: Add this to fastify plugin
  fastify.get("/", async (request, reply) => {
    let onlyConfigured = await Config.find().select('-__v -_id')
    let underDeployment = await Deployment.find({progress: {$ne: 'done'}})
    const latestDeployments = await Deployment.aggregate([
      {
        $sort: { createdAt: -1 }
      },
      {
        $group:
        {
          _id: {
            repoId: '$repoId',
            branch: '$branch',
          },
          createdAt: { $last: '$createdAt' },
          progress: { $first: '$progress' }
        }
      }
    ])
    const services = await dockerEngine.listServices()

    let deployedApplications = services.filter(r => r.Spec.Labels.managedBy === 'coolify' && r.Spec.Labels.type === 'application')
    let deployedDatabases = services.filter(r => r.Spec.Labels.managedBy === 'coolify' && r.Spec.Labels.type === 'database')


    deployedApplications = [...new Map(deployedApplications.map(item => [item.Spec.Labels.domain, item])).values()];
    deployedApplications = deployedApplications.map(r => {
      onlyConfigured = onlyConfigured.filter(c => {
        // if (c.repoId === r.Spec.Labels.repoId && c.branch === r.Spec.Labels.branch) {
        //   return
        // }
        if (c.publish.domain !== r.Spec.Labels.domain) {
          let status = latestDeployments.find(l => r.Spec.Labels.repoId === l._id.repoId && r.Spec.Labels.branch === l._id.branch)
          if (status && status.progress) c.progress = status.progress
          return c
        }
      })
      let status = latestDeployments.find(l => r.Spec.Labels.repoId === l._id.repoId && r.Spec.Labels.branch === l._id.branch)
      if (status && status.progress) r.progress = status.progress
      return r
    })
    // console.log(underDeployment)
    return {
      applications: {
        deployed: deployedApplications,
        underDeployment
        // onlyConfigured
      },
      databases: {
        deployed: deployedDatabases
      }
    }
  });
};
