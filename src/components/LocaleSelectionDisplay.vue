<template>
    <div class="locale-selection-container">
        <div v-if="!isLocalTestVersion">
            <label for="localeSelect">Choose a locale:</label>
            <select id="localeSelect" v-model="chosenLocale">
                <option v-for="locale in appStore.locales" :key="locale" :value="locale">
                    {{ locale }}
                </option>
            </select>
            <br/>
            <span>OR give a new locale: </span>&nbsp;<input type="text" v-model="newLocale"/>
            <br/>
            <span class="not-implemented">OR use some existing translation files</span><span class="info-roundel" title="The tool will detect the locale and translation group (e.g. 'main' or 'mb') from your files.&#10;If the locale exists already in Strype, the tool will first retrieve its content online then apply your files' changes.">i</span><span>(not yet available)</span>
        </div>
        <div v-else>
            <span>Local test version: the locale is set to German</span>
        </div>
        <br/>
        <button @click="validateLocale" :disabled="!canValidateLocale">OK</button>
    </div>
  </template>

<script lang="ts">
import { useStore } from "@/stores/store";
import { mapStores } from "pinia";
import { CustomEventTypes, parseJSONToTranslationTree } from "@/helpers/common";
import type { TranslationLabelsTree } from "@/helpers/types";
import Vue from "vue";
import { IS_LOCAL_STANDALONE_TEST_VERSION, LOCALE_FOR_LOCAL_STANDALONE_TEST } from "@/main";
import testLocalData from "@/assets/test_local_data.json";

export default Vue.extend({
    name: "LocaleSelectionDisplay",

    mounted(){
        if(this.isLocalTestVersion){
            this.chosenLocale = LOCALE_FOR_LOCAL_STANDALONE_TEST;
            this.validateLocale();
        }
    },

    computed: {
        ...mapStores(useStore),

        isLocalTestVersion(): boolean {
            return IS_LOCAL_STANDALONE_TEST_VERSION;
        },
    },

    data: function() {
        return {
            chosenLocale: "",
            newLocale: "",
            canValidateLocale: false,
        };
    },

    watch: {
        chosenLocale(newValue: string) {
            if(newValue.length > 0){
                this.newLocale = "";
                this.canValidateLocale = true;
            }
            else{
                this.canValidateLocale = (this.chosenLocale.length > 0);
            }
        },

        newLocale(newValue: string) {
            if(newValue.length > 0){
                this.chosenLocale = "";
                // A new locale cannot be an existing locale
                // Note sure about that, but for now we only accept locales as a 2 chars code
                // (is that actually a requirement in Strype?)
                this.canValidateLocale = (/^[a-z]{2}$/.test(newValue.toLowerCase()) && !this.appStore.locales.includes(newValue.toLowerCase()));
            }
            else{
                this.canValidateLocale = (this.newLocale.length > 0);
            }
        },
    },

    methods: {
        validateLocale() {
            // A locale has been chosen or created and if created value, we have a 2 chars code (see in watcher)
            // We retrieve the English data, and if chose value, the other locale.
            // And if all good, we save the locale to work with in the state.
            const localesToFetch = ["en"];
            if(this.chosenLocale.length > 0) {
                localesToFetch.push(this.chosenLocale);
            }

            const localeFetchDone = () => {
                // When we have the data from GitHub we can...
                // ... set the current locale
                this.appStore.locale = (this.chosenLocale.length > 0) ? this.chosenLocale : this.newLocale.toLowerCase();
                //.. add all missing labels/values in the translation state object + set the "isEmpty" field from locale to English (for us to know easily)
                // (either because some don't exist in an existing locale, or because we're creating a new locale...)
                this.fillMissingTranslationsAndSetIsEmpty();
                // ... set the status as complete and allow for it to be close
                this.appStore.status = "Ready for you to translate!";
                this.appStore.isStatusFinshed = true;
                // ... emit event to show the translation tool
                this.$emit(CustomEventTypes.showLocalesComparisonToolRequested);
            };

            if(this.isLocalTestVersion){
                this.prepareDataFromLocalStandaloneTestFiles();
                localeFetchDone();
            }
            else{
                this.retrieveLocale(localesToFetch[0], true).then((firstRetrieveOK) => {
                    if(firstRetrieveOK){
                        if(localesToFetch.length > 1){
                            this.retrieveLocale(localesToFetch[1], false).then((secondRetrieveOK) => {
                                if(secondRetrieveOK){
                                    localeFetchDone();
                                }
                            });
                        }
                        else {
                            // A new locale is to be created: we prepare an empty object for this locale.
                            localeFetchDone();
                        }
                    }
                });
            }
        },

        retrieveLocale(locale: string, isEnglish: boolean): Promise<boolean>{
            this.appStore.status = `Retrieving ${(!isEnglish) ?  `"${locale}"` : "English (reference)"} data...`;
            const errorMsgLocaleTemplate = "Error retrieving the data for {locale}.\nContact the Strype team (contact on https://strype.org).";
            return fetch("https://api.github.com/repos/k-pet-group/Strype/contents/src/localisation/"+locale)
                .then((value) => {
                    if(value.status != 200){
                        this.appStore.status =  value.status + "\n" + errorMsgLocaleTemplate.replace("{locale}", (!isEnglish) ? `"${locale}"` : "English (reference)");
                        this.appStore.isStatusError = true;
                        return false;
                    }
                        
                    return value.json().then((content) => {                            
                        try{
                            // Get each translation files (for each translation group) 
                            // and we keep the list of the groups updated in state for reference.
                            const fetches = content.map((gitEntry: any) => {
                                const fileName = gitEntry.name as string;
                                if (!/[a-zA-Z]{2}_[a-zA-Z]+\.json/.test(fileName)){
                                    throw Error();
                                }
                                
                                const translationGroup = fileName.substring(fileName.indexOf("_") + 1, fileName.length - ".json".length);
                                if(isEnglish){
                                    this.appStore.translationGroups.push(translationGroup);
                                }
                                
                                // Get the translation file stuff
                                return fetch(gitEntry.download_url)
                                    .then((value) => {
                                        return value.json().then((fileContent) => {
                                            try{
                                                if(isEnglish){
                                                    this.$set(this.appStore.englishContent, translationGroup, {value: parseJSONToTranslationTree(fileContent).value});
                                                }
                                                else{
                                                    this.$set(this.appStore.translations, translationGroup, {value: parseJSONToTranslationTree(fileContent).value});
                                                }
                                                return true;
                                            }
                                            catch {
                                                // Show error
                                                this.appStore.status = errorMsgLocaleTemplate.replace("{locale}", (!isEnglish) ? `"${locale}"` : "English (reference)");
                                                this.appStore.isStatusError = true;
                                                return false;
                                            }
                                        });
                                    })
                                    .catch(() => {
                                        // Show error
                                        this.appStore.status = errorMsgLocaleTemplate.replace("{locale}", (!isEnglish) ? `"${locale}"` : "English (reference)");
                                        this.appStore.isStatusError = true;
                                        return false;
                                    });
                            });
                        
                            return Promise.all(fetches).then((fetchesResults: boolean[]) => !fetchesResults.some((res) => !res));
                        }
                        catch{
                            // Show error
                            this.appStore.status = errorMsgLocaleTemplate.replace("{locale}", (!isEnglish) ? `"${locale}"` : "English (reference)");
                            this.appStore.isStatusError = true;
                            return false;
                        }
                    });                    
                })
                .catch((reason) => {
                    this.appStore.status =  "\nError:" + reason + "\n" + errorMsgLocaleTemplate.replace("{locale}", (!isEnglish) ? `"${locale}"` : "English (reference)");
                    this.appStore.isStatusError = true;
                    return false;
                });
        },

        fillMissingTranslationsAndSetIsEmpty(params?: { forKey: string, localeParentTreeNode: TranslationLabelsTree, englishParentTreeNode: TranslationLabelsTree}): boolean{
            // We check everything against English: the translations groups, each key, and each key value.
            // Inexistant translation values are set to "". 
            // Note that if something exists in the translation that doesn't match English, we keep it for now.
            let hasEmptyChild = false; // Even if we check that already, since we add new things in the locale translation tree we need to set hasEmptyChildren
            if(params) {
                const {forKey, localeParentTreeNode, englishParentTreeNode} = params;
                const hasEnglishKeyGotChildrenLabels = (typeof englishParentTreeNode[forKey].value != "string");
                // If the key doesn't exist, we set it to "" or  {}, depending on the nature of its value in the English version.
                if(localeParentTreeNode[forKey] == undefined){
                    this.$set(localeParentTreeNode, forKey, (hasEnglishKeyGotChildrenLabels) ? {value: {}, hasEmptyChild: true} : {value: "", isEmpty: true});
                    this.$set(localeParentTreeNode[forKey], "isEmpty", localeParentTreeNode[forKey].isEmpty??false);
                    this.$set(localeParentTreeNode[forKey], "hasEmptyChild", localeParentTreeNode[forKey].hasEmptyChild??false);
                    hasEmptyChild = true;
                }
                else if(typeof localeParentTreeNode[forKey].value == "string" && localeParentTreeNode[forKey].value.length == 0){
                    // It's unlikely the translation file contains an empty string when it was saved, but we still check.
                    this.$set(localeParentTreeNode[forKey], "isEmpty", true);
                    hasEmptyChild = true;
                }
                
                // If there are children in the English version for this key, we get inside...
                if(hasEnglishKeyGotChildrenLabels){
                    Object.keys(englishParentTreeNode[forKey].value).forEach((deeperLevelKey) => {
                        if(this.fillMissingTranslationsAndSetIsEmpty({forKey: deeperLevelKey, localeParentTreeNode: localeParentTreeNode[forKey].value as TranslationLabelsTree, englishParentTreeNode: englishParentTreeNode[forKey].value as TranslationLabelsTree})){
                            this.$set(localeParentTreeNode[forKey], "hasEmptyChild", true);
                        }
                    });
                }
                return hasEmptyChild;
            }
            else{
                // The entry point of the check: we look at all the translation groups.
                this.appStore.translationGroups.forEach((translationGroup) => {
                    if(this.appStore.translations[translationGroup] == undefined){
                        // We know a translation group should contain some children, so we use an empty object as default value
                        this.$set(this.appStore.translations, translationGroup,  {value: {}}); 
                    } 
                    Object.keys(this.appStore.englishContent[translationGroup].value).forEach((firstLevelKey) => {
                        this.fillMissingTranslationsAndSetIsEmpty({forKey: firstLevelKey, localeParentTreeNode: this.appStore.translations[translationGroup].value as TranslationLabelsTree, englishParentTreeNode: this.appStore.englishContent[translationGroup].value as TranslationLabelsTree});
                    });                   
                });
                // This returned value doesn't matter for this starting case:
                return false;
            }
        },

        prepareDataFromLocalStandaloneTestFiles() {
            // The JSON file first level properties are the locales, then for each locale, the translation groups.
            // Each value for a translation group property is the locale file of that group.
            // We don't make tests for validity as it's a test version
            // Only make sure that the locale defined in main.ts and set to this.chosenLocale exists in the test file data.
            // English (will set the reference for the translation groups).
            // (Note that the test file may contain outdated data, it doesn't get updated when Strype is updated.)
            for(const translationGroup in testLocalData.en){
                this.appStore.translationGroups.push(translationGroup);
                this.appStore.englishContent[translationGroup] = {value: parseJSONToTranslationTree((testLocalData.en as Record<string, any>)[translationGroup]).value};
            }
            
            // Other locale:
            this.appStore.translationGroups.forEach((translationGroup) => {
                if((testLocalData as Record<string, any>)[this.chosenLocale][translationGroup]){
                    this.$set(this.appStore.translations, translationGroup, {value: parseJSONToTranslationTree((testLocalData as Record<string, any>)[this.chosenLocale][translationGroup]).value});
                }
            });
        },
    },
});
</script>

<style>
.locale-selection-container {
    border: 2px black solid;
    border-radius: 5px;
    width: 100;
    padding: 10px;
    background-color: #afd9ec;
}

.locale-selection-container > select {
    margin-left: 10px;
}

.locale-selection-container > input {
    margin-top: 2px;
}

.locale-selection-container > button {
    margin-top: 10px;
}

.not-implemented {
    color: #aaa;
}

.info-roundel {    
  display: inline-block;
  margin: 2px;
  background-color: #007bff;
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  text-align: center;
  line-height: 24px;
  font-weight: bold;  
}

</style>

