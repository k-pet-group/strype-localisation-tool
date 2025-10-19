<template>
    <div class="locale-comp-container functional-container">
        <label for="translationGroupSelect">Translation group name:</label>
        <select id="translationGroupSelect" v-model="currentTranslationGroup" @change="resetTranslations">
            <template v-for="translationGroup in appStore.translationGroups">
                <option :key="translationGroup" :value="translationGroup">
                    {{ translationGroup }}
                </option>
            </template>
        </select> 
        <input id="onlyShowUntranslatedNodesCheckBox" type="checkbox" v-model="onlyShowUntranslatedNodes" />
        <label for="onlyShowUntranslatedNodesCheckBox"><b>Only show (new) entries that are not translated.</b></label>
        <button class="blue-button" @click="onGenerateTranslationFilesButtonClicked">Generate translations files</button>
        <div class="comparator-container">
            <div class="values-container">
                <div>
                    <span v-if="hasTranslationLabelNodeChildren">This node has children: get inside to find a translation.</span>
                    <span v-else>English (reference): </span>
                    <br/>
                    <span :class="{invisible: hasTranslationLabelNodeChildren}">{{ 'Translation for '+appStore.locale + ':'}}</span>
                </div>                    
                <div class="values-translation-container">
                    <span :class="{invisible: hasTranslationLabelNodeChildren}">{{ (hasTranslationLabelNodeChildren)? "" : currentEnglishLabelsTreeNodeVal }}</span>
                    <input :class="{reduced: hasTranslationLabelNodeChildren}" type="text" v-model="currentLocaleLabelsTreeNodeVal"
                        @keydown="onUpDownKeyInTranslationInput" :readonly="hasTranslationLabelNodeChildren"/>
                </div>
            </div>
            <div class="labels-container">
                <TranslationTreeDisplay :translation-group="currentTranslationGroup" :onlyShowUntranslatedNodes="onlyShowUntranslatedNodes" />
            </div>            
        </div>
    </div>
  </template>

<script lang="ts">
import { useStore } from "@/stores/store";
import { mapStores } from "pinia";
import TranslationTreeDisplay from "@/components/TranslationTreeDisplay.vue";
import type TranslationLabelTreeNodeComponent from "@/components/TranslationLabelTreeNode.vue";
import { CustomEventTypes, getNormalisedVisibleTreeNodeRefsKVP, getReferencedTranslationTreeDisplayComponent } from "@/helpers/common";
import type { TranslationLabelsTree } from "@/helpers/types";
import Vue from "vue";

export default Vue.extend({
    name: "LocalesComparisonDisplay",

    components: {
        TranslationTreeDisplay,
    },

    destroyed(){
        // If the component is destroyed, for example when it's hidden to make place for GenerateLocaleFilesDisplay
        // we should clear off the options in the select element, because they are not properly removed by Vue and 
        // we get duplicates if this component is shown again.

    },

    computed: {
        ...mapStores(useStore),

        currentTranslationGroup: {
            get() {
                return this.appStore.currentTranslationGroup;
            },
            set(value: string) {          
                this.appStore.currentTranslationGroup = value;
            },
        },

        currentEnglishLabelsTreeNodeVal() {
            if(this.appStore.currentTranslationLabelKeyPath.length == 0){
                return "";
            }
            
            let treeNodeVal = this.appStore.englishContent[this.appStore.currentTranslationGroup].value as TranslationLabelsTree;
            const labelPathKeys = this.appStore.currentTranslationLabelKeyPath.split(".");
            labelPathKeys.forEach((key) => {
                treeNodeVal = treeNodeVal[key].value as TranslationLabelsTree;
            });

            let toReturn: TranslationLabelsTree | string = treeNodeVal;
            if(typeof treeNodeVal == "string"){
                // Transform the "\n" input to a visual indicator (because it doesn't show in HTML)
                toReturn = (treeNodeVal as string).replace("\n", "⏎");
            }
            return toReturn;
        },

        hasTranslationLabelNodeChildren(): boolean {       
            return (typeof this.currentEnglishLabelsTreeNodeVal != "string");
        },

        currentLocaleLabelsTreeNodeVal: {
            get() {
                // NOTE: the translations tree is already prepared for the locale with the missing keys and empty values before being used.
                if(this.appStore.currentTranslationLabelKeyPath.length == 0){
                    return "";
                }
                
                let treeNodeVal = this.appStore.translations[this.appStore.currentTranslationGroup].value as TranslationLabelsTree;
                const labelPathKeys = this.appStore.currentTranslationLabelKeyPath.split(".");
                labelPathKeys.forEach((key) => {                
                    treeNodeVal = treeNodeVal[key].value as TranslationLabelsTree;
                });            
              
                let toReturn: TranslationLabelsTree | string = treeNodeVal;
                if(typeof treeNodeVal == "string"){
                    // Transform the "\n" input to this visual indicator: ⏎ (because it doesn't show in HTML)
                    toReturn = (treeNodeVal as string).replace("\n", "⏎");
                }
                return toReturn;
            },
            set(value: string) {
                let treeNode = this.appStore.translations[this.appStore.currentTranslationGroup].value as TranslationLabelsTree;
                const labelPathKeys = this.appStore.currentTranslationLabelKeyPath.split(".");
                const lastKey = labelPathKeys.pop() as string;
                labelPathKeys.forEach((key) => {
                    treeNode = treeNode[key].value as TranslationLabelsTree;
                });

                // Set the value
                this.$set(treeNode[lastKey], "value", value);

                // Update the isEmpty status accordingly
                this.$set(treeNode[lastKey], "isEmpty", (value.length == 0));
            },
        },

    },

    data: function() {
        return {
            CustomEventTypes, // Just to be able to use in template
            currentTranslationLabelNodePath: "",
            onlyShowUntranslatedNodes: false,
        };
    },

    methods: {
        onGenerateTranslationFilesButtonClicked(){
            this.$emit(CustomEventTypes.showGenerateLocaleFilesRequested);
        },

        resetTranslations(){
            this.appStore.currentTranslationLabelKeyPath = "";
            this.appStore.isChangingTranslationGroup = true;
        },

        onUpDownKeyInTranslationInput(event: KeyboardEvent){
            // We have a special case when up/down or left/right keys are pressed from the translation input field:
            // we want to allow the translation label tree to be navigated still; this allows an easier
            // interaction between the 2 elements (input and tree) --> no need to click back and forth between the 2 all the time.
            if(["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(event.key)){
                // Look up the current node to relay the event ()
                const allVisibleRefsNodesRefs = getNormalisedVisibleTreeNodeRefsKVP(Object.entries(getReferencedTranslationTreeDisplayComponent()?.$refs as Record<string, any>));
                const selectedNodeComponentRef = allVisibleRefsNodesRefs.find(([key, component]) => (component as InstanceType<typeof TranslationLabelTreeNodeComponent>).isSelected);
                if(selectedNodeComponentRef){                    
                    const selectedNodeComponent = (selectedNodeComponentRef[1] as InstanceType<typeof TranslationLabelTreeNodeComponent>);
                    // We only handle the left/right keys IF THE NODE IS ANOTHER TREE LEVEL
                    if(selectedNodeComponent.isLeaf && (event.key == "ArrowLeft" || event.key == "ArrowRight")){
                        return;
                    }
                    selectedNodeComponent.handleKeyDown(new KeyboardEvent("keydown", {key: event.key}));
                    // Once the event has been dispatched to the node, we need to wait a bit and get back to the input we were on...
                    this.$nextTick(() => (event.target as HTMLInputElement)?.focus());
                }

                event.preventDefault();
                event.stopImmediatePropagation();
                event.stopPropagation();
            }
        }, 
    },
});
</script>

<style>
.locale-comp-container > select {
    margin-left: 5px;
}

.locale-comp-container > button {
  float: right;
}

.locale-comp-container > input[type="checkbox"] {
    margin-left: 50px;
}

.comparator-container {
    width: 100%;
    max-height: 550px;
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;    
}


.comparator-container > div {
    width: 100%;    
}

.labels-container {
    border: gainsboro 1px solid;
    display: flex;
    flex-direction: column;
    overflow: auto;
}

.values-container {
    display: flex;
    border: red 1px solid;
    padding: 2px 0px;

}

.values-container > div {
    margin-left: 5px;
}

.values-translation-container {
    flex-grow: 2;
    display: flex;
    flex-direction: column;
}


.values-translation-container> input {
    flex-grow: 2;
    margin-right: 5px;
}

.values-translation-container > input.reduced {
    flex-grow: 1;
    width: 0;
    border-color: transparent;
    cursor: default;
    outline: none;
}

.invisible {
  color: transparent;
}
</style>

