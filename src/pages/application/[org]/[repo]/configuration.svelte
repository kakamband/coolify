<script>
  import { onDestroy } from "svelte";
  import { session, fetch, savedBranch } from "../../../../store";
  import { params, goto } from "@roxi/routify";
  import Login from "../../../../components/Application/Login.svelte";
  import { fade } from "svelte/transition";
  import Loading from "../../../../components/Loading.svelte";
  import { toast } from "@zerodevx/svelte-toast";

  $: org = $params.org;
  $: repo = $params.repo;

  onDestroy(() => {
    $savedBranch = null;
  });

  let branch = $savedBranch || null;
  let installation, repoId, initialConfig;
  let activeTab = {
    general: true,
    buildStep: false,
    secrets: false,
  };
  let loading = {
    github: false,
    branches: false,
  };
  let branches = [];
  let repos = [];
  let config = {
    build: { required: false, baseDir: null, installCmd: null, buildCmd: null },
    publish: { publishDir: null, domain: null, pathPrefix: null, port: null },
    branch: null,
    buildPack: "static",
    repoId: null,
    createdAt: null,
    updatedAt: null,
  };

  let isConfigChanged = false;
  let isDomainMissing = false;

  let initialConfigValue = "Select a repository";
  let initialBranchValue = "Select a branch";

  let secrets = [];
  let secret = {
    name: null,
    value: null,
  };
  let foundSecret = {
    name: null,
    value: null,
  };

  // Check if the user changed anything in the loaded configuration.
  $: JSON.stringify(initialConfig) !== JSON.stringify(config)
    ? (isConfigChanged = true)
    : (isConfigChanged = false);

  function activateTab(tab) {
    if (activeTab.hasOwnProperty(tab)) {
      activeTab = {
        general: false,
        buildStep: false,
        secrets: false,
      };
      activeTab[tab] = true;
    }
  }

  async function deleteApp() {
    try {
      await $fetch(`/api/v1/config`, {
        method: "delete",
        body: {
          repoId,
          branch: config.branch,
        },
      });
      toast.push(`Successfully deleted the ${config.branch} branch.`);
      $goto("/dashboard");
    } catch (error) {
      console.log(error);
    }
  }

  function resetState() {
    activeTab = {
      general: true,
      buildStep: false,
      secrets: false,
    };
    branches = [];
    branch = "";
    secret = {
      name: null,
      value: null,
    };
    config = {
      build: {
        required: false,
        baseDir: null,
        installCmd: null,
        buildCmd: null,
      },
      publish: { publishDir: null, domain: null, pathPrefix: null, port: null },
      branch: null,
      buildPack: "static",
      repoId: null,
      createdAt: null,
      updatedAt: null,
    };
  }
  function modifyGithubAppConfig() {
    const left = screen.width / 2 - 1020 / 2;
    const top = screen.height / 2 - 618 / 2;
    const newWindow = open(
      `https://github.com/apps/${
        import.meta.env.VITE_GITHUB_APP_NAME
      }/installations/new`,
      "Install App",
      "resizable=1, scrollbars=1, fullscreen=0, height=1000, width=1020,top=" +
        top +
        ", left=" +
        left +
        ", toolbar=0, menubar=0, status=0"
    );
    const timer = setInterval(async () => {
      if (newWindow.closed) {
        clearInterval(timer);
        loading.github = true;
        resetState();
        repoId = initialConfigValue;
        await loadGithubRepositories();
        loading.github = false;
      }
    }, 100);
  }
  function installGithubApp() {
    const left = screen.width / 2 - 1020 / 2;
    const top = screen.height / 2 - 618 / 2;
    const newWindow = open(
      `https://github.com/apps/${
        import.meta.env.VITE_GITHUB_APP_NAME
      }/installations/new`,
      "Install App",
      "resizable=1, scrollbars=1, fullscreen=0, height=1000, width=1020,top=" +
        top +
        ", left=" +
        left +
        ", toolbar=0, menubar=0, status=0"
    );
    const timer = setInterval(async () => {
      if (newWindow.closed) {
        clearInterval(timer);
        if (newWindow.document.URL.split("?")[1].split("=")[1]) {
          $session.githubAppToken = newWindow.document.URL.split("?")[1].split(
            "="
          )[1];
          loading.github = true;
          await loadGithubRepositories();
          loading.github = false;
        }
      }
    }, 100);
  }
  async function loadGithubRepositories() {
    if ($session.githubAppToken) {
      const { installations } = await $fetch(
        "https://api.github.com/user/installations"
      );
      if (installations.length === 0) {
        return false;
      }
      const { repositories } = await $fetch(
        `https://api.github.com/user/installations/${installations[0].id}/repositories?per_page=10000`
      );
      installation = installations[0];
      repos = repositories;
      const found = repos.find((r) => r.full_name === `${org}/${repo}`);
      if (found && found.id) {
        repoId = found.id;
        loadBranches();
      } else {
        $goto("/application/new/start/configuration");
      }
      return true;
    }
  }

  async function loadConfiguration() {
    if (repoId !== initialConfigValue && repoId !== undefined) {
      const data = await $fetch(
        `/api/v1/config?repoId=${repoId}&branch=${branch}`
      );
      if (data) {
        config = data;
        initialConfig = JSON.parse(JSON.stringify(data));
        await loadSecrets();
      } else {
        config = {
          build: {
            required: false,
            baseDir: null,
            installCmd: null,
            buildCmd: null,
          },
          publish: { publishDir: null, domain: null, pathPrefix: null },
          branch,
          buildPack: "static",
          repoId,
          createdAt: null,
          updatedAt: null,
        };
      }
    }
  }
  async function loadBranches() {
    const repo = repos.find((r) => r.id === repoId);
    loading.branches = true;
    resetState();
    branches = await $fetch(
      `https://api.github.com/repos/${repo.owner.login}/${repo.name}/branches`
    );
    loading.branches = false;
    if ($savedBranch) {
      branch = $savedBranch;
      loadConfiguration();
    }
  }
  async function saveSecret() {
    const found = secrets.find((s) => s.name === secret.name);
    if (!found) {
      await $fetch(`/api/v1/secret`, { body: { ...secret, repoId, branch } });
      await loadSecrets();
      foundSecret = secret = {
        name: null,
        value: null,
      };
    } else {
      foundSecret = found;
    }
  }
  async function saveConfig(isToast = true) {
    if (config.publish.domain) {
      const repo = repos.find((r) => r.id === repoId);
      config.fullName = `${repo.owner.login}/${repo.name}`;
      config.installationId = installation.id;
      try {
        config = await $fetch(`/api/v1/config`, {
          body: { ...config, branch },
        });
        initialConfig = JSON.parse(JSON.stringify(config));
        isToast && toast.push(`Configuration saved.`);
        return true
      } catch (error) {
        isToast && toast.push(error.error || "Something is NOT okay. Are you okay?");
        return false
      }
    } else {
      isDomainMissing = true;
      activateTab("general");
      return false
    }
  }
  async function loadSecrets() {
    secrets = await $fetch(`/api/v1/secret?repoId=${repoId}&branch=${branch}`);
  }
  async function removeSecret(name) {
    await $fetch(`/api/v1/secret`, {
      method: "delete",
      body: {
        repoId,
        branch,
        name,
      },
    });
    await loadSecrets();
  }
  async function queueDeployment() {
    if (! await saveConfig(false)) {
      return
    }
    const repo = repos.find((r) => r.id === repoId);
    const body = {
      ref: `refs/heads/${config.branch}`,
      repository: {
        id: repoId,
        full_name: `${repo.owner.login}/${repo.name}`,
      },
      installation: {
        id: installation.id,
      },
    };
    const response = await $fetch(`/api/v1/webhooks/deploy`, {
      body,
      headers: {
        Manual: true,
        "X-GitHub-Hook-Installation-Target-ID": installation.app_id,
        "X-GitHub-Event": "push",
      },
    });
    toast.push(response.message);
  }
  async function changePreviewDeploys(value) {
    settings[value] = !settings[value];
    await $fetch(`/api/v1/settings`, {
      body: {
        ...settings,
      },
    });
    toast.push("Configuration saved.");
  }
</script>

<div>
  {#if !$session.githubAppToken}
    <Login />
  {:else}
    {#await loadGithubRepositories()}
      <Loading message={"Loading Github..."} />
    {:then}
      <div class="text-4xl font-bold tracking-tight pb-6 text-center">
        Configuration
      </div>
      <!-- <div
        class="text-xs font-bold tracking-tight pb-6 text-center text-gray-500"
      >
        {org}/{repo}
      </div> -->
      {#if repos && repos.length > 0 && !loading.github}
        <div
          class="text-center space-y-2 max-w-2xl md:mx-auto mx-6 pt-6 pb-4"
          in:fade={{ duration: 100 }}
        >
          <div class="grid grid-cols-1">
            <label for="repository">Organization / Repository</label>
            <div class="grid grid-cols-4">
              <!-- svelte-ignore a11y-no-onchange -->
              <select
                id="repository"
                class:cursor-not-allowed={org !== "new" && repo !== "start"}
                class="col-span-2"
                bind:value={repoId}
                on:change={() => loadBranches()}
                disabled={org !== "new" && repo !== "start"}
              >
                <option selected disabled>{initialConfigValue}</option>
                {#each repos as repo}
                  <option value={repo.id}>
                    {repo.owner.login}
                    /
                    {repo.name}
                  </option>
                {/each}
              </select>
              <button
                class="button col-span-1 ml-2"
                on:click={modifyGithubAppConfig}
                >Configure on
                <svg
                  class="w-6 inline-block mx-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fill-rule="evenodd"
                    d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
                    clip-rule="evenodd"
                  />
                </svg></button
              >
              <button
                class={config.branch == null && isConfigChanged
                  ? "button cursor-not-allowed bg-transparent border-transparent  ml-2 bg-red-500 opacity-25"
                  : "button  bg-red-500 col-span-1 ml-2 hover:bg-red-400"}
                disabled={config.branch == null && isConfigChanged}
                on:click={deleteApp}
                >Delete
              </button>
            </div>
          </div>
          {#if loading.branches}
            <div class="grid grid-cols-1">
              <label for="branch">Branch</label>
              <select disabled>
                <option selected>Loading branches</option>
              </select>
            </div>
          {:else if repoId !== initialConfigValue && repoId !== undefined}
            <div class="grid grid-cols-1">
              <label for="branch">Branch</label>
              <!-- svelte-ignore a11y-no-onchange -->
              <select
                id="branch"
                bind:value={branch}
                on:change={() => loadConfiguration()}
              >
                <option disabled selected>{initialBranchValue}</option>
                {#each branches as branch}
                  <option value={branch.name}>{branch.name}</option>
                {/each}
              </select>
            </div>
            <div class="py-4">
              {#if config.branch}
                {#if isConfigChanged}
                { #if org === 'new' && repo === 'start' }
                <button
                class="button p-2 px-10 bg-green-600 hover:bg-green-500"
                on:click={queueDeployment}>Deploy Application</button
              >
                  {:else}
                  <button
                    class="button p-2 px-10 bg-blue-600 hover:bg-blue-500"
                    on:click={saveConfig}>Save Configuration</button
                  >
                  {/if}
                {:else}
                  <button
                    class="button p-2 px-10 bg-green-600 hover:bg-green-500"
                    on:click={queueDeployment}>Deploy Application</button
                  >
                {/if}
              {/if}
            </div>
          {/if}
        </div>
      {:else if loading.github}
        <Loading message={"Loading Github..."} />
      {:else}
        <div class="text-center py-10">
          <button class="button p-2 px-10" on:click={installGithubApp}
            >Install & Authorize</button
          >
        </div>
      {/if}
    {/await}
    {#if config.branch}
      <div class="block text-center pb-2">
        <nav
          class="flex space-x-4 justify-center font-bold tracking-tight text-xl text-gray-500"
          aria-label="Tabs"
        >
          <div
            on:click={() => activateTab("general")}
            class:border-transparent={!activeTab.general}
            class:border-blue-500={activeTab.general}
            class:text-gray-200={activeTab.general}
            class="px-3 py-2 cursor-pointer border-b-4"
          >
            General
          </div>
          <div
            on:click={() => activateTab("buildStep")}
            class:border-transparent={!activeTab.buildStep}
            class:border-blue-500={activeTab.buildStep}
            class:text-gray-200={activeTab.buildStep}
            class="px-3 py-2 cursor-pointer border-b-4"
          >
            Build Step
          </div>
          <div
            on:click={() => activateTab("secrets")}
            class:border-transparent={!activeTab.secrets}
            class:border-blue-500={activeTab.secrets}
            class:text-gray-200={activeTab.secrets}
            class="px-3 py-2 cursor-pointer border-b-4"
          >
            Secrets
          </div>
        </nav>
      </div>
      <div class="mx-2 md:mx-10 h-271">
        <div class="px-4 py-5 sm:p-6 h-full">
          {#if activeTab.general}
            <div>
              <div
                class="grid grid-cols-1 text-sm space-y-2 max-w-2xl md:mx-auto mx-6 pb-6 auto-cols-max"
              >
                <label for="buildPack">Build Pack</label>
                <select id="buildPack" bind:value={config.buildPack}>
                  <option selected>static</option>
                  <option>nodejs</option>
                </select>
              </div>
              <div
                class="grid grid-cols-2 space-y-2 max-w-2xl md:mx-auto mx-6 justify-center items-center"
              >
                <label for="Domain">Domain</label>
                <input
                  class:placeholder-red-500={isDomainMissing}
                  class:border-red-500={isDomainMissing}
                  on:focus={() => (isDomainMissing = false)}
                  id="Domain"
                  bind:value={config.publish.domain}
                  placeholder="eg: coollabs.io (without www and http/https)"
                />
                <label for="Path">Path Prefix</label>
                <input
                  id="Path"
                  bind:value={config.publish.pathPrefix}
                  placeholder="/"
                />
                <label for="publishDir">Publish Directory</label>
                <input
                  id="publishDir"
                  bind:value={config.publish.publishDir}
                  placeholder="/"
                />
                {#if config.buildPack !== "static"}
                  <label for="Port">Port</label>
                  <input
                    id="Port"
                    bind:value={config.publish.port}
                    placeholder={config.buildPack === "static" ? "80" : "3000"}
                  />
                {/if}
                <!-- {#if config.buildPack === "static"}
                  <div class="text-base font-bold text-white pt-2">
                    Preview Deploys
                  </div>
                  <button
                    type="button"
                    on:click={() =>
                      (config.previewDeploy = !config.previewDeploy)}
                    aria-pressed="false"
                    class="relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
                    class:bg-green-600={config.previewDeploy}
                    class:bg-coolgray-300={!config.previewDeploy}
                  >
                    <span class="sr-only">Use setting</span>
                    <span
                      class="pointer-events-none relative inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200"
                      class:translate-x-5={config.previewDeploy}
                      class:translate-x-0={!config.previewDeploy}
                    >
                      <span
                        class="ease-in duration-200 absolute inset-0 h-full w-full flex items-center justify-center transition-opacity"
                        class:opacity-0={config.previewDeploy}
                        class:opacity-100={!config.previewDeploy}
                        aria-hidden="true"
                      >
                        <svg
                          class="bg-white h-3 w-3 text-red-600"
                          fill="none"
                          viewBox="0 0 12 12"
                        >
                          <path
                            d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                      </span>
                      <span
                        class="ease-out duration-100 absolute inset-0 h-full w-full flex items-center justify-center transition-opacity"
                        aria-hidden="true"
                        class:opacity-100={config.previewDeploy}
                        class:opacity-0={!config.previewDeploy}
                      >
                        <svg
                          class="bg-white h-3 w-3 text-green-600"
                          fill="currentColor"
                          viewBox="0 0 12 12"
                        >
                          <path
                            d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z"
                          />
                        </svg>
                      </span>
                    </span>
                  </button>
                {/if} -->
              </div>
            </div>
          {:else if activeTab.buildStep}
            <div
              class="grid grid-cols-1 space-y-2 max-w-2xl md:mx-auto mx-6 text-center"
            >
              <label for="buildCommand">Build Command</label>
              <input
                id="buildCommand"
                bind:value={config.build.buildCmd}
                placeholder="eg: yarn build"
              />

              <label for="installCommand">Install Command</label>
              <input
                id="installCommand"
                bind:value={config.build.installCmd}
                placeholder="eg: yarn install"
              />

              <label for="baseDir">Base Directory</label>
              <input
                id="baseDir"
                bind:value={config.build.baseDir}
                placeholder="/"
              />
            </div>
          {:else if activeTab.secrets}
            <div class="space-y-2 max-w-2xl md:mx-auto mx-6 text-center">
              <div class="text-left text-base font-bold">New secret</div>
              <div class="grid md:grid-flow-col grid-flow-row gap-2">
                <input
                  id="secretName"
                  bind:value={secret.name}
                  placeholder="Name"
                />
                <input
                  id="secretValue"
                  bind:value={secret.value}
                  placeholder="Value"
                />
                <button class="button p-1 w-20" on:click={saveSecret}
                  >Save</button
                >
              </div>

              {#if secrets.length > 0}
                {#each secrets as s}
                  <div class="grid md:grid-flow-col grid-flow-row gap-2">
                    <input
                      id={s.name}
                      value={s.name}
                      disabled
                      class="bg-transparent border-transparent"
                      class:border-red-600={foundSecret.name === s.name}
                    />
                    <input
                      id={s.createdAt}
                      value="ENCRYPTED"
                      disabled
                      class="bg-transparent border-transparent"
                    />
                    <button
                      class="button p-1 w-20 hover:bg-red-500 hover:text-white"
                      on:click={() => removeSecret(s.name)}>Delete</button
                    >
                  </div>
                {/each}
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style lang="postcss">
  input {
    @apply border-2 border-black text-sm rounded-md p-2 bg-coolgray-300;
  }
  select {
    @apply border-2 border-black bg-coolgray-300 text-sm rounded-md p-2;
  }
  label {
    @apply text-left text-base font-bold;
  }
  .button {
    @apply border border-black rounded-md text-sm font-medium bg-coolgray-300;
  }
  .button:hover {
    @apply bg-coolgray-200;
  }
  .h-271 {
    min-height: 271px;
  }
</style>
