<script>
    export let applications;
    import { savedBranch } from "../../store";
    import { url, goto } from "@roxi/routify/runtime";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();
    function switchTo(application) {
        const { branch, org, repo, to } = application;
        $savedBranch = branch;
        if (to === "logs") {
            $goto(`/application/:org/:repo/logs`, {
                org,
                repo,
            });
        } else {
            $goto(`/application/:org/:repo/configuration`, {
                org,
                repo,
            });
        }
    }
</script>

<div class="flex items-center pb-6 px-5 justify-center">
    <div class="text-4xl font-bold tracking-tight">Applications</div>
    <a
        class="mx-2 flex items-center justify-center h-8 w-8 bg-blue-600 border border-black rounded-md text-white hover:bg-blue-500"
        href={$url("/application/new/start/configuration")}
        ><svg
            class="w-6"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
        >
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
        </svg></a
    >
    <button
        class="flex items-center justify-center h-8 w-8 bg-green-600 border border-black rounded-md text-white hover:bg-green-500"
        on:click={() => dispatch("loadDashboard")}
        ><svg
            class="w-6"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
        >
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
        </svg></button
    >
</div>
{#if applications.deployed.length > 0}
    <div class="flex flex-row flex-wrap gap-4 justify-center items-center mx-6">
        {#each applications.deployed as application}
            <div
                class="rounded-md p-4 tracking-tight bg-coolgray-300 border-2 shadow"
                class:border-yellow-300={application.progress === "inprogress"}
                class:border-red-600={application.progress === "failed"}
                class:border-black={application.progress === "done" ||
                    !application.progress}
            >
                <div class="font-medium text-center text-xl">
                <a class="hover:underline"  href={"https://" + application.Spec.Labels.domain}>
                    {application.Spec.Labels.domain}
                </a>
            </div>

                <div class="text-xs text-center">
                    {application.Spec.Labels.org}/{application.Spec.Labels
                        .repo}:{application.Spec.Labels.branch}
                </div>
                <div class="text-xs text-center">
                    {#if application.Spec.Labels.pathPrefix != null && application.Spec.Labels.pathPrefix !== "/"}
                        {application.Spec.Labels.pathPrefix}
                    {/if}
                </div>
                <div
                    class="text-xs space-x-2 text-center font-medium tracking-tight pt-6"
                >
                    <!-- <a
              href="https://{application.Spec.Labels.domain}"
              class="border-b-2 border-transparent hover:border-blue-500"
              >Open</a
            > -->
                    {#if application.Spec.Labels.isPreviewDeploy == 'true'}
                        <button
                            class="border-b-2 font-medium border-transparent hover:border-blue-500"
                            >Preview Deploys</button
                        >
                    {/if}
                    <button
                        class="border-b-2 font-medium border-transparent hover:border-blue-500"
                        on:click={() =>
                            switchTo({
                                branch: application.Spec.Labels.branch,
                                org: application.Spec.Labels.org,
                                repo: application.Spec.Labels.repo,
                                to: "configuration",
                            })}>Configure & Deploy</button
                    >
                    <button 
                        class="border-b-2 font-medium border-transparent hover:border-blue-500 cursor-pointer"
                        on:click={() =>
                            switchTo({
                                branch: application.Spec.Labels.branch,
                                org: application.Spec.Labels.org,
                                repo: application.Spec.Labels.repo,
                                to: "logs",
                            })}
                    >
                        Logs
                    </button>
                </div>
            </div>
        {/each}
    </div>
{/if}
<!-- {#if applications.underDeployment.length > 0}
{JSON.stringify(applications.underDeployment)}
{/if} -->
<!-- {#if applications.onlyConfigured.length > 0}
    <div class="text-base font-bold tracking-tight px-5 py-3 text-center">
        Configured
    </div>
    <div class="flex flex-row flex-wrap gap-4 justify-center items-center mx-6">
        {#each applications.onlyConfigured as config}
            <div
                class="rounded-md p-4 tracking-tight bg-coolgray-300 border-2 shadow"
                class:border-yellow-300={config.progress === "inprogress"}
                class:border-red-600={config.progress === "failed"}
                class:border-black={config.progress === "done" ||
                    !config.progress}
            >
                <div class="font-medium text-center text-xl">
                    {config.publish.domain}
                </div>
                <div class="text-xs text-center">{config.branch}</div>
                <div class="text-xs text-center">
                    {#if config.publish.pathPrefix != null && config.publish.pathPrefix !== "/"}
                        {config.publish.pathPrefix}
                    {/if}
                </div>
                <div
                    class="text-xs space-x-2 text-center font-medium tracking-tight pt-6"
                >
                    <button
                        class="border-b-2 font-medium border-transparent hover:border-blue-500"
                        on:click={() =>
                            switchTo({
                                branch: config.branch,
                                org: config.fullName.split("/")[0],
                                repo: config.fullName.split("/")[1],
                                to: "configuration",
                            })}>Configure & Deploy</button
                    >
                </div>
            </div>
        {/each}
    </div>
{/if} -->
