<script context="module">
  import { withProjection, createStoreAPIProvider } from '@coriolis/coriolis-svelte'

  const {
    setStoreAPI,
    shareStoreAPI
  } = createStoreAPIProvider()

  export { setStoreAPI }
</script>
<script>
  import * as componentIndex from './views/componentIndex'
  import DevToolsButton from './units/DevToolsButton.svelte'

  import { enabledViewName } from '../projections/enabledViewName'

  shareStoreAPI()

  const CurrentView$ = withProjection(enabledViewName)
</script>

{#if $CurrentView$}
  <svelte:component this={componentIndex[$CurrentView$]} />
{:else}
  <DevToolsButton />
{/if}
