<template>
  <div class="tree-node-container">
    <div>
      <div :class="{'tree-node-label-container':true, highlighted: isSelected, empty: isEmpty, 'has-empty-child': hasEmptyChild}" tabindex="-1" @click="selectNode" @keydown="handleKeyDown">
        <span :class="{'tree-node-select-arrow': true, 'invisible': !isSelected}" :style="{marginRight: (10*level-5)+'px'}">&rarr;</span>
        <span>{{ label }}</span>
        <span v-if="!isLeaf" class="tree-node-toggle" @click="toggleExpand">{{ toggleIconStr }}</span>        
      </div>
      <div v-if="!isLeaf && isExpanded">
        <TranslationLabelTreeNode v-show="!localeInternalNode.value[translationLabelNodeKey].isHidden" v-for="(translationLabelNode,translationLabelNodeKey, index) in translationLabelTreeNodes" :translation-group="translationGroup" :label="translationLabelNodeKey"
          :level="level + 1" :index="index" :key="translationGroup+'.'+path+'.'+translationLabelNodeKey" :englishInternalNode="translationLabelNode" :localeInternalNode="localeInternalNode.value[translationLabelNodeKey]" 
          :path="path+'.'+translationLabelNodeKey" :indexedPath="childIndexedPath(index)" :is-expanded="false" :onlyShowUntranslatedNodes="onlyShowUntranslatedNodes"  /> 
      </div>
      </div>
  </div>
</template>

<script lang="ts">
import { useStore } from "@/stores/store";
import { mapStores } from "pinia";
import { CustomEventTypes, getReferencedTranslationTreeDisplayComponent, getTranslationLabelNodeComponentIndexedPath, getTranslationLabelNodeComponentRef, getNormalisedVisibleTreeNodeRefsKVP } from "@/helpers/common";
import type TranslationLabelTreeNodeComponent from "@/components/TranslationLabelTreeNode.vue";
import Vue, {type PropType} from "vue";
import type { TranslationLabelsTree } from "@/helpers/types";

export default Vue.extend({
    name: "TranslationLabelTreeNode",

    props: {
        label: {type: String, required: true},
        translationGroup: {type: String, required: true},
        onlyShowUntranslatedNodes: {type: Boolean, required: true},
        path: {type: String, required: true},
        indexedPath: {type: String, required: true},
        level: {type: Number, required: true},
        index: {type: Number, required: true},
        englishInternalNode: {type: Object as PropType<TranslationLabelsTree>, required: true},
        localeInternalNode: {type: Object as PropType<TranslationLabelsTree>, required: true},
    },

    computed: {
        ...mapStores(useStore),

        isLeaf(): boolean{
            return typeof this.englishInternalNode.value == "string";
        },

        isEmpty(): boolean {
            // This is indicating whether the translation for a node (therefore, for a leaf) is empty (i.e. as "")
            return !!this.localeInternalNode.isEmpty;
        },

        hasEmptyChild(): boolean {
            // This is indicating whether this node contains any empty child (therefore, not for a leaf)
            return !!this.localeInternalNode.hasEmptyChild;
        },

        isHidden(): boolean {
            return !!this.localeInternalNode.isHidden;
        },

        isSelected(): boolean{
            return (this.appStore.currentTranslationLabelKeyPath == this.path);
        },

        toggleIconStr(): string {
            return (this.isExpanded) ? "[-]" : "[+]";
        },

        translationLabelTreeNodes(): TranslationLabelsTree {
            if(this.isLeaf){
                return {};
            }

            let tree = this.appStore.englishContent[this.translationGroup];
            const pathKeys = this.path.split(".");
            pathKeys.forEach((pathKey) => {
                tree = (tree.value as TranslationLabelsTree)[pathKey];
            });
            return tree.value as TranslationLabelsTree;
        },
    },

    data: function() {
        return {
            CustomEventTypes, // Just to be able to use in template
            isExpanded: false,
        };
    },

    watch: {
        onlyShowUntranslatedNodes(newValue){
            // We update the node's visibility depending on the change of the corresponding watched value.
            let needsToHide = false;

            if(newValue){
                // Need to hide nodes that are not empty/have no empty child
                needsToHide = (typeof this.localeInternalNode.value == "string") ? !this.localeInternalNode.isEmpty : !this.localeInternalNode.hasEmptyChild;         
            }
            
            this.$set(this.localeInternalNode, "isHidden", needsToHide);        
        },

        isEmpty(newValue){
            // When the corresponding watched value has changed, we need to trigger a check its parent's "hasEmptyChild", which in turn will bubble up.
            // If isEmpty has changed to "true", we don't check for the siblings state: the parent node is by default having one empty child now.
            // If we are in a level 1 node, we don't have anything to check.
            if(this.level > 1){
                const parentNode = this.$parent as InstanceType<typeof TranslationLabelTreeNodeComponent>;
                if(newValue){
                    this.$set(parentNode.localeInternalNode, "hasEmptyChild", true);
                }
                else{
                    // We need to check all the parent's children to find out if that parent still has any empty children.
                    const hasParentGotEmptyChild = parentNode.$children.some((child) => {
                        const childComponent = (child as InstanceType<typeof TranslationLabelTreeNodeComponent>);
                        return childComponent.isEmpty || childComponent.hasEmptyChild;
                    });
                    this.$set(parentNode.localeInternalNode, "hasEmptyChild", hasParentGotEmptyChild);
                }
            }
        },

        hasEmptyChild(){
            // When the corresponding watched value has changed, we bubble up to our ancestor (unless now we've reached to top of the tree..)
            if(this.level > 1){
                const parentNode = this.$parent as InstanceType<typeof TranslationLabelTreeNodeComponent>;          
                const hasParentGotEmptyChild = parentNode.$children.some((child) => {
                    const childComponent = (child as InstanceType<typeof TranslationLabelTreeNodeComponent>);
                    return childComponent.isEmpty || childComponent.hasEmptyChild;
                });
                this.$set(parentNode.localeInternalNode, "hasEmptyChild", hasParentGotEmptyChild);
            }
        },      
    },

    created(){
        // When a *sub* node is created, it registers itself to the refs of THE TREE.
        // We use the refs in relation with the TREE because then we can easily handle navigation.
        // (Just to make sure we avoid bugs, we still check the referenced component exists...)
        const treeComponent = getReferencedTranslationTreeDisplayComponent();
        if(this.level > 1 && treeComponent) {
            treeComponent.$refs[getTranslationLabelNodeComponentRef(this.indexedPath)] = this;
            // Also, it may not have the right "isHidden" value yet because "isHidden" relies on the change of "onlyShowUntranslatedNodes" (which wouldn't change when expanding the parent)
            this.$set(this.localeInternalNode, "isHidden", this.onlyShowUntranslatedNodes && ((typeof this.localeInternalNode.value == "string") ? !this.localeInternalNode.isEmpty : !this.localeInternalNode.hasEmptyChild));
        }
    },

    destroyed(){
        // When a *sub* node is destroyed, it de-registers itself to the refs of THE TREE.
        // We use the refs in relation with the TREE because then we can easily handle navigation.
        // (Just to make sure we avoid bugs, we still check the referenced component exists...)
        const treeComponent = getReferencedTranslationTreeDisplayComponent();
        if(treeComponent && !this.appStore.isChangingTranslationGroup) {
            delete treeComponent.$refs[getTranslationLabelNodeComponentRef(this.indexedPath)];
        }
    },
    
    methods: {
        selectNode(){
            this.appStore.currentTranslationLabelKeyPath = this.path;
            (this.$el.querySelector(".tree-node-label-container") as HTMLDivElement).focus();
        },

        toggleExpand(){
            this.isExpanded = !this.isExpanded;
        },

        childIndexedPath(childIndex: number): string {
            return getTranslationLabelNodeComponentIndexedPath(this.indexedPath, childIndex);
        },

        handleKeyDown(event: KeyboardEvent){
            // When the tree display gets a keyboard event, we need to navigate between
            // the labels (nodes) for up/down/page up/page down/home/end, expand/collapse a node that has children
            // (left/right) or navigate if it's a leaf...
            if(!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight","Home", "End", "PageUp", "PageDown"].includes(event.key)){
                // Any other key not mentioned above doesn't do anything
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            event.stopPropagation();

            // The navigation logic entirely relies on the refs given to each node.
            const isTryingToMoveDown = (event.key == "ArrowDown" || (event.key == "ArrowRight" && (this.isLeaf || (!this.isLeaf && this.isExpanded)))), 
                isTryingToMoveUp = (event.key == "ArrowUp" || (event.key == "ArrowLeft" && (this.isLeaf || (!this.isLeaf && !this.isExpanded)))), 
                isTryingToExpand = (event.key == "ArrowRight" && !this.isLeaf && !this.isExpanded),
                isTryingToCollapse = (event.key == "ArrowLeft" && !this.isLeaf && this.isExpanded),
                isTryingToMoveStart = (event.key == "Home"),
                isTryingToMoveEnd = (event.key == "End"),
                isTrypingToScrollUp = (event.key == "PageUp"),
                isTrypingToScrollDown = (event.key == "PageDown");

            const treeDisplayComponent = getReferencedTranslationTreeDisplayComponent();
            if(treeDisplayComponent == undefined || (Object.keys(treeDisplayComponent.$refs).length) == 0){
                return;
            }
          
            const allVisibleNodeRefsKVP = getNormalisedVisibleTreeNodeRefsKVP(Object.entries(treeDisplayComponent.$refs as {[key: string]: any}));
            const currentNodeIndexInTree = allVisibleNodeRefsKVP.findIndex(([refName]) => refName == getTranslationLabelNodeComponentRef(this.indexedPath));
            // Move 1 up or down
            if(isTryingToMoveUp || isTryingToMoveDown){
                if(currentNodeIndexInTree > -1 &&  ((isTryingToMoveUp && currentNodeIndexInTree > 0) || (isTryingToMoveDown && currentNodeIndexInTree < allVisibleNodeRefsKVP.length - 1))){
                    // Get the value part ([1]) of the key/value entry (value is the node component)
                    (allVisibleNodeRefsKVP[(isTryingToMoveUp) ? currentNodeIndexInTree - 1 : currentNodeIndexInTree + 1][1] as InstanceType<typeof TranslationLabelTreeNodeComponent>).selectNode();
                }
                return;
            }

            // Move start or end
            if(isTryingToMoveStart || isTryingToMoveEnd){
                const isGoingToStart = (event.key == "Home");
                (allVisibleNodeRefsKVP[(isGoingToStart) ? 0 : allVisibleNodeRefsKVP.length - 1][1] as InstanceType<typeof TranslationLabelTreeNodeComponent>).selectNode();
                return;
            }

            // Get in/out (i.e. we expand/collapse the sub tree and get to the inner/outer node)
            if(isTryingToExpand || isTryingToCollapse){
                this.toggleExpand();
                return;
            }

            // "Scrolling" up/dow: this less straight forward than the other case. 
            // We try to detect the amout of nodes that are currently showing inside the tree container to offset the selection by the same at max.
            // Because the container can change size, we cannot know how many nodes it can holds at one moment in time, that's why we find that out every time.
            if(isTrypingToScrollUp || isTrypingToScrollDown){
                const containerH = document.querySelector(".labels-container")?.clientHeight;
                const oneNodeH = document.querySelector(".tree-node-container")?.clientHeight;
                if(containerH && oneNodeH){
                    const approxNberOfVisibleNodesInPage = Math.floor(containerH / oneNodeH);
                    (allVisibleNodeRefsKVP[(isTrypingToScrollUp) 
                        ? (((currentNodeIndexInTree - approxNberOfVisibleNodesInPage) >= 0) ? (currentNodeIndexInTree - approxNberOfVisibleNodesInPage) : 0) 
                        : (((currentNodeIndexInTree + approxNberOfVisibleNodesInPage) < allVisibleNodeRefsKVP.length) ? (currentNodeIndexInTree + approxNberOfVisibleNodesInPage) : allVisibleNodeRefsKVP.length - 1)][1] as InstanceType<typeof TranslationLabelTreeNodeComponent>)
                        .selectNode();
                }
            }
        },
    },
});
</script>

<style>
.tree-node-container {
  width: 100%;
}

.tree-node-label-container {
  cursor: default;
}

.tree-node-label-container.empty {
  background-color: rgba(255, 0, 0, 0.65);
}

.tree-node-label-container.has-empty-child {
  background-color: rgba(255, 187, 1, 0.925);
}

.tree-node-label-container.highlighted {
  background-color: rgb(209, 218, 250);
}

.tree-node-select-arrow {
  font-weight: bolder;
  margin-left: 5px; /* margin right is computed in style, as it depends on the level */
}

.tree-node-toggle {
  margin-left: 5px;
  cursor: pointer;
}
</style>

