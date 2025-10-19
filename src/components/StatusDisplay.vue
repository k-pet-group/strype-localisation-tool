<template>
    <div class="status-container functional-container">
        <span :class="{'status-msg': true, 'status-error': appStore.isStatusError, 'status-OK': appStore.isStatusFinshed}">{{ status }}</span>
        <span v-if="showClose" class="close-btn" @click="onCloseStatusDisplay">×</span>
    </div>
</template>

<script lang="ts">
import { useStore } from "@/stores/store";
import { mapStores } from "pinia";
import { CustomEventTypes } from "@/helpers/common";
import Vue from "vue";

export default Vue.extend({
    name: "StatusDisplay",

    props:{
        showClose: Boolean,
    },

    computed: {
        ...mapStores(useStore),

        status(): string {
            return this.appStore.status;
        },
    },

    mounted() {
        // When the component is mounted, we can show the status (because it's in the DOM)
        // So we start the first action: checking the access to github works.
        this.$emit(CustomEventTypes.checkGitHubRepBasicsRequested);
    },

    methods: {
        onCloseStatusDisplay() {
            this.$emit(CustomEventTypes.statusDisplayOffRequested);
        },
    },
});
</script>

<style>
.status-container {
    border-color: blueviolet !important;    
    margin-bottom: 5px;
}

.status-msg {
    white-space: pre-wrap;
}

.status-error {
    color: red;
}

.status-OK {
    color: green;
}


.close-btn {
  float: right;
  cursor: pointer;
  font-weight: bold;
  font-size: 1.2em;
  color: white;
  background-color: red;
  padding: 0px 4px;
  border: rgb(214, 77, 14) solid 1px;
  border-radius: 5px;
}
</style>

