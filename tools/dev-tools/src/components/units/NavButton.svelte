<script>
  import { withProjection, createDispatch } from '@coriolis/coriolis-svelte'

  import { currentViewName } from '../../projections/currentViewName'
  import { viewChanged } from '../../events'

  export let view
  export let projection = currentViewName
  export let buildEvent = viewChanged

  const viewName$ = withProjection(projection)

  const navAction = createDispatch(() => buildEvent(view))
</script>

<button
  class="nav-button {$$props.class || ''}"
  on:click={navAction}
  disabled={$viewName$ === view}
>
  <slot />
</button>
