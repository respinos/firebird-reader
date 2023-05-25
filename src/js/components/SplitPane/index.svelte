<script>
	import { createEventDispatcher } from 'svelte';
	import { constrain } from './utils.js';
	import { tooltip } from '../../lib/tooltip';

	/** @type {ReturnType<typeof createEventDispatcher<{ change: undefined }>>} */
	const dispatch = createEventDispatcher();

	/** @type {string | undefined} */
	export let id = undefined;

	/** @type {'horizontal' | 'vertical'} */
	export let type;

	/** @type {import('./types').Length} */
	export let pos = '50%';

	/** @type {import('./types').Length} */
	export let min = '0%';

	/** @type {import('./types').Length} */
	export let max = '100%';

	export let snap = '0%';

	export let disabled = false;

	/** @type {'min' | 'max'}*/
	export let priority = 'min';

	export let expanded = false;
	export let maximized = false;

	let className;
	export { className as class };

	/** @type {HTMLElement} */
	let container;

	let dragging = false;
	let w = 0;
	let h = 0;

	$: position = pos;

	// constrain position
	$: if (container) {
		const size = type === 'horizontal' ? w : h;
		position = constrain(container, size, min, max, position, priority);
	}

	/**
	 * @param {number} x
	 * @param {number} y
	 */
	function update(x, y) {
		if (disabled) return;

		const { top, left } = container.getBoundingClientRect();

		const pos_px = type === 'horizontal' ? x - left : y - top;
		const size = type === 'horizontal' ? w : h;

		position = pos.endsWith('%') ? `${(100 * pos_px) / size}%` : `${pos_px}px`;

		dispatch('change');
	}

	/**
	 * @param {HTMLElement} node
	 * @param {(event: PointerEvent) => void} callback
	 */
	function drag(node, callback) {
		/** @param {PointerEvent} event */
		const pointerdown = (event) => {
			
			if ( event.target.closest('button') ) {
				togglePane();
				return;
			}

			if (
				(event.pointerType === 'mouse' && event.button === 2) ||
				(event.pointerType !== 'mouse' && !event.isPrimary)
			)
				return;

			node.setPointerCapture(event.pointerId);

			event.preventDefault();

			dragging = true;

			const onpointerup = () => {
				dragging = false;

				node.setPointerCapture(event.pointerId);

				window.removeEventListener('pointermove', callback, false);
				window.removeEventListener('pointerup', onpointerup, false);
				snapPane();
			};

			window.addEventListener('pointermove', callback, false);
			window.addEventListener('pointerup', onpointerup, false);
		};

		node.addEventListener('pointerdown', pointerdown, { capture: true, passive: false });

		return {
			destroy() {
				node.removeEventListener('pointerdown', pointerdown);
			}
		};
	}

	let lastPos = null;
	function togglePane() {
		console.log("-- pos", position);
		if (lastPos === null) {
			lastPos = pos;
			position = '0%';
		} else {
			position = lastPos;
			lastPos = null;
		}
	}

	function snapPane() {
		if ( parseFloat(position, 10) <= parseFloat(snap, 10) ) {
			console.log('-- YES snap', position, snap);
			position = '0%';
		} else {
			console.log('-- DO NOT snap', position, snap);
		}
	}
</script>

<div
	data-pane={id}
	class="panes {type} {className}"
	class:maximized={maximized}
	class:expanded={maximized && expanded}
	bind:this={container}
	bind:clientWidth={w}
	bind:clientHeight={h}
	style="--pos: {position}"
>
	<div class="pane a" inert={maximized & !expanded ? true : null} >
		<slot name="a" />
	</div>

	<div class="pane">
		<slot name="b" />
	</div>

	{#if pos !== '0%' && pos !== '100%'}
		<div class="{type} divider" class:disabled class:collapsed={position == '0%'} use:drag={(e) => update(e.clientX, e.clientY, e)}>
			<button 
				type="button" 
				class="btn btn-lg btn-outline-dark shadow rounded-circle" 
				on:click={togglePane} 
				use:tooltip
				aria-label={position == '0%' ? 'Open sidebar' : 'Close sidebar'}>
				<i 
					class="fa-solid fa-arrow-right-from-bracket"  
					class:fa-flip-horizontal={position != '0%'}
					aria-hidden="true"></i>
			</button>
		</div>
	{/if}
</div>

{#if dragging}
	<div class="mousecatcher" />
{/if}

<style>

	.panes {
		--sp-thickness: var(--thickness, 8px);
		--sp-color: var(--color, transparent);
		display: grid;
		position: relative;
		width: 100%;
		height: 100%;

	}

	.panes.vertical {
		grid-template-rows: var(--pos) 1fr;
	}

	.panes.horizontal {
		grid-template-columns: var(--pos) 1fr;
	}

	.pane {
		width: 100%;
		height: 100%;
		overflow: auto;
		/* padding: 1rem; */
	}

	.pane.a {
		/* padding: 0.5rem 1rem; */
	}

	.pane > :global(*) {
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.mousecatcher {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
		background: rgba(255, 255, 255, 0.0001);
	}

	.divider {
		position: absolute;
		z-index: 10;
		touch-action: none !important;
	}

	.divider:hover {
		background: #ddd;
	}

	.divider::after {
		content: '';
		position: absolute;
		background-color: var(--sp-color);
	}

	.horizontal > .divider > button {
		position: absolute;
		top: 5%;
		left: 50%;
		transform: translateY(-50%) translateX(-50%);
		z-index: 10;
	}

	.horizontal > .divider.collapsed > button {
		transform: translateY(-50%) translateX(50%);
	}

	.horizontal > .divider {
		padding: 0 calc(0.5 * var(--sp-thickness));
		width: 2rem;
		height: 99%;
		cursor: ew-resize;
		left: var(--pos);
		transform: translate(calc(-0.5 * var(--sp-thickness) - 0rem), 0);
	}

	.horizontal > .divider.disabled {
		cursor: default;
	}

	.horizontal > .divider::after {
		left: 50%;
		top: 0;
		width: 1px;
		height: 100%;
	}

	.vertical > .divider {
		padding: calc(0.5 * var(--sp-thickness)) 0;
		width: 100%;
		height: 0;
		cursor: ns-resize;
		top: var(--pos);
		transform: translate(0, calc(-0.5 * var(--sp-thickness)));
	}

	.vertical > .divider.disabled {
		cursor: default;
	}

	.vertical > .divider::after {
		top: 50%;
		left: 0;
		width: 100%;
		height: 1px;
	}

	.panes.horizontal.maximized {
		grid-template-columns: 0% 100%;
	}

	.panes.horizontal.expanded {
		grid-template-columns: 100% 100%;
	}

	.panes.horizontal.expanded .pane.a {
		/* padding: 0.25rem 0.5rem; */
	}

	.panes.horizontal.maximized > .divider {
		display: none;
	}

	.btn-outline-dark {
		background: #fff;
	}

	.btn-outline-dark:hover {
		background-color: var(--bs-btn-hover-border-color);
	}

	/* @container container (max-width: 700px) {
		.container.horizontal {
			grid-template-columns: 0% 100%;
		}

		.container.horizontal.expanded {
			grid-template-columns: 100% 100%;
		}

		.horizontal > .divider {
			display: none;
		}

		button.expando {
			display: block;
		}
	} */


</style>
