<template>
  <div>
    <svg-icon icon-class="github" @click="goto" />
  </div>
</template>

<script setup lang="ts">
const url = ref('https://github.com/luckykuang/infoq-scaffold-ai');

function goto() {
  window.open(url.value);
}
</script>
