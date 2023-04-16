<script context="module">
	/**
	 * the third argument for event bundler
	 * @see https://github.com/WICG/EventListenerOptions/blob/gh-pages/explainer.md
	 */
	const thirdEventArg = (() => {
		let result = false;

		try {
			const arg = Object.defineProperty({}, 'passive', {
				get() {
					result = { passive: true };
					return true;
				},
			});

			window.addEventListener('testpassive', arg, arg);
			window.remove('testpassive', arg, arg);
		} catch (e) { /* */
		}

		return result;
	})();
</script>

<script>
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import SizeAndPositionManager from '../lib/SizeAndPositionManager';
	import {
		DIRECTION,
		SCROLL_CHANGE_REASON,
		SCROLL_PROP,
		SCROLL_PROP_LEGACY,
	} from '../lib/constants';

	export let height;
	export let width = '100%';

	export let itemCount;
	export let itemSize;
	export let estimatedItemSize = null;
	export let stickyIndices = null;
	export let getKey = null;

	export let scrollDirection = DIRECTION.VERTICAL;
	export let scrollOffset = null;
	export let scrollToIndex = null;
	export let scrollToAlignment = null;
	export let scrollToBehaviour = 'instant';

	export let overscanCount = 3;

	const dispatchEvent = createEventDispatcher();

	export const sizeAndPositionManager = new SizeAndPositionManager({
		itemCount,
		itemSize,
		estimatedItemSize: getEstimatedItemSize(),
	});

	let wrapperHeight = 0;
	let mounted = false;
	let wrapper;
	let items = [];

	let state = {
		offset:             scrollOffset || (scrollToIndex != null && items.length && getOffsetForIndex(scrollToIndex)) || 0,
		scrollChangeReason: SCROLL_CHANGE_REASON.REQUESTED,
	};

	let prevState = state;
	let prevProps = {
		scrollToIndex,
		scrollToAlignment,
		scrollOffset,
		itemCount,
		itemSize,
		estimatedItemSize,
	};

	let styleCache = {};
	let wrapperStyle = '';
	let innerStyle = '';

	$: {
		/* listen to updates: */ scrollToIndex, scrollToAlignment, scrollOffset, itemCount, itemSize, estimatedItemSize;
		propsUpdated();
	}

	$: {
		/* listen to updates: */ state;
		stateUpdated();
	}

	$: {
		/* listen to updates: */ height, width, stickyIndices;
		if (mounted) recomputeSizes(0); // call scroll.reset;
	}

	// refresh(); // Initial Load

	onMount(() => {
		mounted = true;
	
		wrapperHeight = wrapper.clientHeight;
		refresh(); // Initial Load

		wrapper.addEventListener('scroll', handleScroll, thirdEventArg);

		if (scrollOffset != null) {
			scrollTo(scrollOffset);
		} else if (scrollToIndex != null) {
			scrollTo(getOffsetForIndex(scrollToIndex));
		}
	});

	onDestroy(() => {
		if (mounted) wrapper.removeEventListener('scroll', handleScroll);
	});


	function propsUpdated() {
		if (!mounted) return;

		const scrollPropsHaveChanged =
			      prevProps.scrollToIndex !== scrollToIndex ||
			      prevProps.scrollToAlignment !== scrollToAlignment;
		const itemPropsHaveChanged =
			      prevProps.itemCount !== itemCount ||
			      prevProps.itemSize !== itemSize ||
			      prevProps.estimatedItemSize !== estimatedItemSize;

		if (itemPropsHaveChanged) {
			sizeAndPositionManager.updateConfig({
				itemSize,
				itemCount,
				estimatedItemSize: getEstimatedItemSize(),
			});

			recomputeSizes();
		}

		if (prevProps.scrollOffset !== scrollOffset) {
			state = {
				offset:             scrollOffset || 0,
				scrollChangeReason: SCROLL_CHANGE_REASON.REQUESTED,
			};
		} else if (
			typeof scrollToIndex === 'number' &&
			(scrollPropsHaveChanged || itemPropsHaveChanged)
		) {
			state = {
				offset: getOffsetForIndex(
					scrollToIndex,
					scrollToAlignment,
					itemCount,
				),

				scrollChangeReason: SCROLL_CHANGE_REASON.REQUESTED,
			};
		}

		prevProps = {
			scrollToIndex,
			scrollToAlignment,
			scrollOffset,
			itemCount,
			itemSize,
			estimatedItemSize,
		};
	}

	function stateUpdated() {
		if (!mounted) return;

		const { offset, scrollChangeReason } = state;

		if (
			prevState.offset !== offset ||
			prevState.scrollChangeReason !== scrollChangeReason
		) {
			refresh();
		}

		if (prevState.offset !== offset && scrollChangeReason === SCROLL_CHANGE_REASON.REQUESTED) {
			scrollTo(offset);
		}

		prevState = state;
	}

	function refresh() {
		const { offset } = state;
		const { start, stop } = sizeAndPositionManager.getVisibleRange({
			containerSize: scrollDirection === DIRECTION.VERTICAL ? 
				wrapperHeight : 
				( width == 'auto' ? wrapper.clientWidth : width ),
			offset,
			overscanCount,
		});

		let updatedItems = [];

		const totalSize = sizeAndPositionManager.getTotalSize();
		if (scrollDirection === DIRECTION.VERTICAL) {
			let units = '';
			if (height.match(/^[0-9]+/)) { units = 'px'; }
			wrapperStyle = `height:${height}${units};width:${width};`;
			innerStyle = `flex-direction:column;height:${totalSize}px;`;
		} else {
			wrapperStyle = `height:${height};width:${width}px`;
			innerStyle = `min-height:100%;width:${totalSize}px;`;
		}

		const hasStickyIndices = stickyIndices != null && stickyIndices.length !== 0;
		if (hasStickyIndices) {
			for (let i = 0; i < stickyIndices.length; i++) {
				const index = stickyIndices[i];
				updatedItems.push({
					index,
					style: getStyle(index, true),
				});
			}
		}

		if (start !== undefined && stop !== undefined) {
			for (let index = start; index <= stop; index++) {
				if (hasStickyIndices && stickyIndices.includes(index)) {
					continue;
				}

				updatedItems.push({
					index,
					style: getStyle(index, false),
				});
			}

			setTimeout(() => {
				dispatchEvent('itemsUpdated', {
					start,
					end: stop,
				});
			}, 0)
		}

		items = updatedItems;
	}

	function gatherStats(state) {
		let offset = state.offset;
		const { start, stop } = sizeAndPositionManager.getVisibleRange({
			containerSize: scrollDirection === DIRECTION.VERTICAL ? 
				wrapperHeight : 
				( width == 'auto' ? wrapper.clientWidth : width ),
			offset,
			overscanCount,
		});

		let viewport = {
			top: wrapper.scrollTop,
			bottom: wrapper.scrollTop + wrapperHeight
		};

		for (let index = start; index <= stop; index++) {
			let x = sizeAndPositionManager.getSizeAndPositionForIndex(index);
			let elementPos = {
				top: x.offset,
				bottom: x.offset + x.size
			};
			// console.log("-- refresh", elementPos, viewport);
			let percentage;
			if ( viewport.top < elementPos.top && viewport.bottom > elementPos.bottom ) {
				percentage = wrapperHeight;
			} else if ( elementPos.top < viewport.top && elementPos.bottom > viewport.bottom ) {
				percentage = wrapperHeight;
			} else if ( elementPos.top < viewport.top ) {
				percentage = x.size - ( viewport.top - elementPos.top );
			} else if ( elementPos.bottom > viewport.bottom ) {
				percentage = x.size - ( elementPos.bottom - viewport.bottom );
			} else {
				percentage = x.size;
			}
			percentage = ( percentage / wrapperHeight ) * 100;

			state.stats.push({
				index: index,
				offset: x.offset,
				size: x.size,
				percentage: percentage
			});
		}
	}

	function scrollTo(value) {
		if ('scroll' in wrapper) {
			console.log("-- scrollTo", value);
			wrapper.scroll({
				[SCROLL_PROP[scrollDirection]]: value,
				behavior:                       scrollToBehaviour,
			});
		} else {
			wrapper[SCROLL_PROP_LEGACY[scrollDirection]] = value;
		}
	}

	export function recomputeSizes(startIndex = 0) {
		styleCache = {};
		sizeAndPositionManager.resetItem(startIndex);
		refresh();
	}

	function getOffsetForIndex(index, align = scrollToAlignment, _itemCount = itemCount) {
		if (index < 0 || index >= _itemCount) {
			index = 0;
		}

		let containerSize = scrollDirection === DIRECTION.VERTICAL ? height : width;
		if ( containerSize == 'auto' ) {
			containerSize = wrapperHeight;
		}

		return sizeAndPositionManager.getUpdatedOffsetForIndex({
			align,
			// containerSize: scrollDirection === DIRECTION.VERTICAL ? height : width,
			containerSize: containerSize,
			currentOffset: state.offset || 0,
			targetIndex:   index,
		});
	}

	function handleScroll(event) {
		const offset = getWrapperOffset();

		if (offset < 0 || state.offset === offset || event.target !== wrapper) return;

		state = {
			offset,
			scrollChangeReason: SCROLL_CHANGE_REASON.OBSERVED,
			stats: []
		};

		gatherStats(state);
		let stats = state.stats;

		dispatchEvent('afterScroll', {
			offset,
			stats,
			event,
		});
	}

	function getWrapperOffset() {
		return wrapper[SCROLL_PROP_LEGACY[scrollDirection]];
	}

	function getEstimatedItemSize() {
		return (
			estimatedItemSize ||
			(typeof itemSize === 'number' && itemSize) ||
			50
		);
	}

	function getStyle(index, sticky) {
		if (styleCache[index]) return styleCache[index];

		const { size, offset } = sizeAndPositionManager.getSizeAndPositionForIndex(index);

		let style;

		if (scrollDirection === DIRECTION.VERTICAL) {
			style = `left:0;width:100%;height:${size}px;`;

			if (sticky) {
				style += `position:sticky;flex-grow:0;z-index:1;top:0;margin-top:${offset}px;margin-bottom:${-(offset + size)}px;`;
			} else {
				style += `position:absolute;top:${offset}px;`;
			}
		} else {
			style = `top:0;width:${size}px;`;

			if (sticky) {
				style += `position:sticky;z-index:1;left:0;margin-left:${offset}px;margin-right:${-(offset + size)}px;`;
			} else {
				style += `position:absolute;height:100%;left:${offset}px;`;
			}
		}

		return styleCache[index] = style;
	}
</script>

<div bind:this={wrapper} class="virtual-list-wrapper" style={wrapperStyle}>
	<slot name="header" />

	<div class="virtual-list-inner" style={innerStyle}>
		{#each items as item (getKey ? getKey(item.index) : item.index)}
			<slot name="item" style={item.style} index={item.index} />
		{/each}
	</div>

	<slot name="footer" />
</div>

<style>
	.virtual-list-wrapper {
		overflow:                   auto;
		will-change:                transform;
		-webkit-overflow-scrolling: touch;

		min-height: 0;
		grid-row: 1/2;
	}

	.virtual-list-inner {
		position:   relative;
		display:    flex;
		width:      100%;
	}
</style>
