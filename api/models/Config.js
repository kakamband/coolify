const mongoose = require("mongoose");

const configSchema = mongoose.Schema(
  {
    repoId: { type: Number, required: true },
    installationId: { type: Number, required: true },
    fullName: { type: String, required: true },
    branch: { type: String, required: true },
    buildPack: { type: String, required: true },
    previewDeploy: { type: Boolean, required: true, default: false },
    build: {
      baseDir: { type: String, default: null },
      installCmd: { type: String, default: null },
      buildCmd: { type: String, default: null },
    },
    publish: {
      publishDir: { type: String, default: null },
      domain: { type: String, default: null },
      pathPrefix: { type: String, default: null },
      port: { type: Number, default: null, required: true },
    },
  },
  { timestamps: true }
);
// const configModel = mongoose.model("config", configSchema);

// async function updateSchema() {
//   const update = await configModel.updateMany(
//     { previewDeploy: { $exists: false } },
//     { $set: { previewDeploy: false } },
//     { timestamps: false }
//   )
//   console.log(`configSchema updated for ${update.nModified} documents.`)
// }

// updateSchema()

module.exports = mongoose.model("config", configSchema)

