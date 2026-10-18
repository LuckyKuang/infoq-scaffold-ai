<template>
  <el-scrollbar ref="scrollContainerRef" :vertical="false" class="scroll-container" @wheel.prevent="handleScroll">
    <slot />
  </el-scrollbar>
</template>

<script setup lang="ts">
import { RouteLocationNormalized } from 'vue-router';
import { useTagsViewStore } from '@/store/modules/tagsView';

const tagAndTagSpacing = ref(4);

const scrollContainerRef = ref<ElScrollbarInstance>();
const scrollWrapper = computed(() => scrollContainerRef.value?.$refs.wrapRef);

onMounted(() => {
  scrollWrapper.value?.addEventListener('scroll', emitScroll, true);
});
onBeforeUnmount(() => {
  scrollWrapper.value?.removeEventListener('scroll', emitScroll);
});

const handleScroll = (e: WheelEvent) => {
  const wheelEvent = e as WheelEvent & { wheelDelta?: number };
  const eventDelta = wheelEvent.wheelDelta || -wheelEvent.deltaY * 40;
  const $scrollWrapper = scrollWrapper.value;
  $scrollWrapper.scrollLeft = $scrollWrapper.scrollLeft + eventDelta / 4;
};
const emits = defineEmits(['scroll']);
const emitScroll = () => {
  emits('scroll');
};

const tagsViewStore = useTagsViewStore();
const visitedViews = computed(() => tagsViewStore.visitedViews);

const moveToTarget = (currentTag: RouteLocationNormalized) => {
  const $container = scrollContainerRef.value?.$el;
  const $containerWidth = $container.offsetWidth;
  const $scrollWrapper = scrollWrapper.value;

  let firstTag = null;
  let lastTag = null;

  // find first tag and last tag
  if (visitedViews.value.length > 0) {
    firstTag = visitedViews.value[0];
    lastTag = visitedViews.value[visitedViews.value.length - 1];
  }

  if (firstTag === currentTag) {
    $scrollWrapper.scrollLeft = 0;
  } else if (lastTag === currentTag) {
    $scrollWrapper.scrollLeft = $scrollWrapper.scrollWidth - $containerWidth;
  } else {
    const tagListDom = Array.from(document.getElementsByClassName('tags-view-item')) as HTMLElement[];
    const currentIndex = visitedViews.value.findIndex((item) => item === currentTag);
    const prevTag = tagListDom.find((item) => item.dataset.path === visitedViews.value[currentIndex - 1]?.path);
    const nextTag = tagListDom.find((item) => item.dataset.path === visitedViews.value[currentIndex + 1]?.path);

    // the tag's offsetLeft after of nextTag
    const afterNextTagOffsetLeft = nextTag ? nextTag.offsetLeft + nextTag.offsetWidth + tagAndTagSpacing.value : 0;

    // the tag's offsetLeft before of prevTag
    const beforePrevTagOffsetLeft = prevTag ? prevTag.offsetLeft - tagAndTagSpacing.value : 0;
    if (nextTag && afterNextTagOffsetLeft > $scrollWrapper.scrollLeft + $containerWidth) {
      $scrollWrapper.scrollLeft = afterNextTagOffsetLeft - $containerWidth;
    } else if (prevTag && beforePrevTagOffsetLeft < $scrollWrapper.scrollLeft) {
      $scrollWrapper.scrollLeft = beforePrevTagOffsetLeft;
    }
  }
};

defineExpose({
  moveToTarget
});
</script>

<style lang="scss" scoped>
.scroll-container {
  white-space: nowrap;
  position: relative;
  overflow: hidden;
  width: 100%;
  :deep(.el-scrollbar__bar) {
    bottom: 0px;
  }
  :deep(.el-scrollbar__wrap) {
    height: 49px;
  }
}
</style>
