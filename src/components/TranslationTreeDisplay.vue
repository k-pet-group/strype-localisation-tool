<template>
  <div>
    <TranslationLabelTreeNode v-show="!appStore.translations[translationGroup].value[translationLabelNodeKey].isHidden" v-for="(translationLabelNode,translationLabelNodeKey, index) in translationLabelTreeNodes" :translation-group="translationGroup"
      :level="1" :index="index" :key="translationGroup+'.'+translationLabelNodeKey" :path="translationLabelNodeKey.toString()" :indexedPath="index.toString()" :is-expanded="false" :label="translationLabelNodeKey"
      :ref="setNodeRef(index.toString())" :onlyShowUntranslatedNodes="onlyShowUntranslatedNodes" :englishInternalNode="translationLabelNode" :localeInternalNode="appStore.translations[translationGroup].value[translationLabelNodeKey]" />
  </div>
</template>

<script lang="ts">
import { useStore } from "@/stores/store";
import { mapStores } from "pinia";
import { cleanTranslationsLabelTreeRefs, CustomEventTypes, getReferencedTranslationTreeDisplayComponent, getTranslationLabelNodeComponentIndexedPath, getTranslationLabelNodeComponentRef, setReferencedTranslationTreeDisplayComponent } from "@/helpers/common";
import type { TranslationLabelsTree } from "@/helpers/types";
import TranslationLabelTreeNode from "@/components/TranslationLabelTreeNode.vue";
import Vue from "vue";

export default Vue.extend({
    name: "TranslationTreeDisplay",

    components: {
        TranslationLabelTreeNode,
    },

    props: {
        translationGroup: {type: String, required: true},
        onlyShowUntranslatedNodes: {type: Boolean, required: true},
    },

    computed: {
        ...mapStores(useStore),

        translationLabelTreeNodes():  TranslationLabelsTree {
            // We know the start of a translation group is ALWAYS containing a nest
            return this.appStore.englishContent[this.translationGroup].value as TranslationLabelsTree;
        },
    },

    data: function() {
        return {
            CustomEventTypes, // Just to be able to use in template
            resetKey: 0, // This is used to make sure the nodes are ALWAYS regenerated when we update the tree so node refs are always in line with the tree.
        };
    },

    watch:{
        translationGroup() {
            // When the translation group has changed (and nodes have updated) we clean the empty refs, and we always select the first element of the nodes
            cleanTranslationsLabelTreeRefs().then(() => {
                (getReferencedTranslationTreeDisplayComponent()?.$refs[getTranslationLabelNodeComponentRef("0")] as InstanceType<typeof TranslationLabelTreeNode>[])[0].selectNode();
                this.appStore.isChangingTranslationGroup = false;
            });        
        },
    },

    created() {
        // Register ourselves to the app
        setReferencedTranslationTreeDisplayComponent(this);
    },

    methods: {
        getTranslationLabelNodeComponentIndexedPath(parentPath: string, index: number){
            return getTranslationLabelNodeComponentIndexedPath(parentPath, index);
        },

        setNodeRef(indexedPath: string){
            return getTranslationLabelNodeComponentRef(indexedPath);
        },       
    },
});
</script>

<style>

</style>

