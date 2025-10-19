<template>
  <div class="generate-files-container functional-container">
    <span class="close-btn" @click="onCloseStatusDisplay">×</span>
    <input id="keepOrphanTranslationsCheckBox" type="checkbox" v-model="keepOrphanTranslations" />
    <label for="keepOrphanTranslationsCheckBox">Keep translations whose key no longer exists in English ("orphan translations")</label>
    <br/><br/>
    <span>Translation group to generate:</span>
    <div v-for="tg in appStore.translationGroups" :key="'generate_for_'+tg" class="translation-groups-container">
        <input :id="getTranslationGroupCheckBoxId(tg)" type="checkbox" checked @change="checkHasTranslationGroupSelected"/>
        <label :for="getTranslationGroupCheckBoxId(tg)" type="checkbox">{{tg}}</label>
    </div>
    <br/><br/>
    <button :disabled="hasNoTranslationGroupSelected" class="blue-button" @click="onDownloadTranslationFilesButtonClicked">Download files</button>
    <span class="note">(Note that empty translations will not show in the files.)</span>
  </div>
</template>

<script lang="ts">
import { CustomEventTypes, parseTranslationTreeToJSON } from "@/helpers/common";
import type { TranslationLabelsTree } from "@/helpers/types";
import { useStore } from "@/stores/store";
import { mapStores } from "pinia";
import Vue from "vue";

export default Vue.extend({
    name: "GenerateLocaleFilesDisplay",

    computed: {
        ...mapStores(useStore),
    },

    data: function() {
        return {
            keepOrphanTranslations: false,
            hasNoTranslationGroupSelected: false,
        };
    },

    methods: {
        getTranslationGroupCheckBoxId(translationGroup: string): string {
            return `generateFor${translationGroup}checkbox`;
        },

        checkHasTranslationGroupSelected(){
            const checkboxes = Array.from(document.querySelectorAll(".generate-files-container input[type='checkbox']")) as HTMLInputElement[];
            this.hasNoTranslationGroupSelected = !checkboxes.some((checkbox) => checkbox.checked);
        },

        prepareTree(): TranslationLabelsTree{
            // We prepare the tree and check a things: 
            // - we only keep the translation groups we need and replace ⏎ to the "\n"
            // - we discard any empty string entry and sub tree levels that have no child at all
            // - if needed, we remove the orphan entries of the tree.
            const treeCopy = JSON.parse(JSON.stringify(this.appStore.translations)) as TranslationLabelsTree;

            const cleanUpTree = (treeAtLevel: TranslationLabelsTree, referenceEnglishAtLevel: TranslationLabelsTree) => {
                Object.entries(treeAtLevel).forEach(([oneTreeLevelKey, oneTreeLevelValue]) => {
                    if(!this.keepOrphanTranslations && !referenceEnglishAtLevel[oneTreeLevelKey]){
                        delete treeAtLevel[oneTreeLevelKey];
                    }
                    else if(typeof oneTreeLevelValue.value != "string"){
                        cleanUpTree(oneTreeLevelValue.value, referenceEnglishAtLevel[oneTreeLevelKey].value as TranslationLabelsTree);
                        // If that that we end up with an empty node (no child) we just get rid of that level too
                        if(Object.keys(oneTreeLevelValue.value).length == 0){
                            delete treeAtLevel[oneTreeLevelKey];
                        }
                    }
                    else if(oneTreeLevelValue.value.length == 0){
                        delete treeAtLevel[oneTreeLevelKey];
                    }
                    else{
                        // We have a string value that is not empty, we make sure we remove all the ⏎ we added inside the labels for visibility
                        treeAtLevel[oneTreeLevelKey].value = (treeAtLevel[oneTreeLevelKey].value as string).replace("⏎", "\n");
                    }
                });                
            };

            // Keeping the requested translation groups:
            for(const translationGroup in this.appStore.translations){
                if(!(document.getElementById(this.getTranslationGroupCheckBoxId(translationGroup)) as HTMLInputElement).checked){
                    delete treeCopy[translationGroup];
                }
                else{
                    // Remove empty strings and orphans (for this translation group that we keep) if requested                        
                    cleanUpTree(treeCopy[translationGroup].value as TranslationLabelsTree, this.appStore.englishContent[translationGroup].value as TranslationLabelsTree);                        
                }
            }
            
            return treeCopy;
        },

        onDownloadTranslationFilesButtonClicked(){
            // We need to remove some things of the translations unless the checkbox to keep orphans has been unchecked.
            const localeTranslationsAsJSONReady = parseTranslationTreeToJSON(this.prepareTree());
            // Then generate the downloads of the files
            Object.entries(localeTranslationsAsJSONReady).forEach(([translationGroup, translations]) => {
                const fileName = `${this.appStore.locale}_${translationGroup}.json`;
                const blob = new Blob([JSON.stringify(translations)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url); // Clean up
            });

        },

        onCloseStatusDisplay() {
            this.$emit(CustomEventTypes.generateLocalFilesDisplayOffRequested);
        },
    },
});
</script>

<style>
.translation-groups-container {    
    padding-left: 5px;

}

.generate-files-container > button:disabled {
    background-color:gainsboro;
    color: grey;
    cursor: default;
}

.generate-files-container > .note {
    color: grey;
    margin-left: 5px;
}
</style>

