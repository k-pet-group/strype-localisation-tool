<template>
    <div class="locale-selection-container">
        <div v-if="isLocalTestVersion">
            <em>{{ `(Local test version: the locale is set to "${chosenLocale}"!)`}}</em>
        </div>
        <div v-else>
            <div class="english-reference-container">
                <span>English reference:</span>
                <input id="englishReferenceGitHubRadio" type="radio" :value="false" v-model="appStore.isEnglishReferenceFromLocalFiles"/>
                <label for="englishReferenceGitHubRadio">Strype on GitHub (main branch)</label>
                <input id="englishReferenceLocalRadio" type="radio" :value="true" v-model="appStore.isEnglishReferenceFromLocalFiles"/>
                <label for="englishReferenceLocalRadio">Local files</label>
                <template v-if="appStore.isEnglishReferenceFromLocalFiles">
                    <button id="pickEnglishFilesButton" title="Pick the English translations files (en_<translation group>.json)." @click="pickEnglishFiles">Pick English files</button>
                    <input type="file" accept=".json" multiple ref="englishFilesInput" @change="onSelectedEnglishFiles" />
                    <div v-for="tg in englishTranslationGroupsFromFiles" :key="`englishFromFile_${tg}`">
                        <span>{{ `en_${tg}.json` }}</span>
                        <div class="cross-symbol-container" @click="removeEnglishFileForTG(tg)">
                            <span title="Remove this file from the English reference.">❌</span>
                        </div>
                    </div>
                    <div v-if="englishTranslationGroupsFromFiles.length == 0"><em>No English files picked yet.</em></div>
                </template>
            </div>
            <hr class="english-reference-separator"/>
            <label for="localeSelect">Choose a locale:</label>
            <select id="localeSelect" v-model="chosenLocale">
                <option v-for="locale in appStore.locales" :key="locale" :value="locale">
                    {{ locale }}
                </option>
            </select>
            <br/>
            <span>OR give a new locale:</span><input type="text" v-model="newLocale"/>
        </div>
        <span>{{ `${(isLocalTestVersion) ? "Optionally" : "OR"} use some existing translations files` }}</span>
        <button id="pickTranslationsFilesButton" @click="pickTranslationFiles" :disabled="isEnglishReferenceMissing">Pick files</button>
        <br/>
        <button id="validateLocaleButton" @click="validateLocale()" :disabled="!canValidateLocale || isEnglishReferenceMissing">OK</button>
    </div>
</template>

<script lang="ts">
import { useStore } from "@/stores/store";
import { mapStores } from "pinia";
import { CustomEventTypes, isLocaleNameValid, parseJSONToTranslationTree, parseTranslationsFileName, readFileContent } from "@/helpers/common";
import type { TranslationLabelsTree } from "@/helpers/types";
import Vue from "vue";
import { LOCALE_FOR_LOCAL_STANDALONE_TEST } from "@/main";
import testLocalData from "@/assets/test_local_data.json";

export default Vue.extend({
    name: "LocaleSelectionDisplay",

    mounted(){
        if(this.isLocalTestVersion){
            this.chosenLocale = LOCALE_FOR_LOCAL_STANDALONE_TEST;
        }
    },

    computed: {
        ...mapStores(useStore),

        isLocalTestVersion(): boolean {
            return import.meta.env.VITE_IS_LOCAL_STANDALONE_TEST_VERSION == "true";
        },

        englishTranslationGroupsFromFiles(): string[] {
            return Object.keys(this.appStore.englishFromLocalFiles).sort();
        },

        isEnglishReferenceMissing(): boolean {
            // When the English reference is to be taken from local files, we need at least one file.
            return this.appStore.isEnglishReferenceFromLocalFiles && this.englishTranslationGroupsFromFiles.length == 0;
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
                this.canValidateLocale = (isLocaleNameValid(newValue) && !this.appStore.locales.includes(newValue.toLowerCase()));
            }
            else{
                this.canValidateLocale = (this.newLocale.length > 0);
            }
        },
    },

    methods: {
        validateLocale(forcedLocale?: string) {
            // A locale has been chosen or created and if created value, we have a 2 chars code (see in watcher)
            // We retrieve the English data, and if chose value, the other locale.
            // And if all good, we save the locale to work with in the state.
            const localesToFetch = ["en"];
            
            // This is used for proceeding with the locale/translations retrieved when uploading translations files.
            if(forcedLocale){
                if(this.appStore.locales.includes(forcedLocale)){
                    this.chosenLocale = forcedLocale;
                }
                else{
                    this.newLocale = forcedLocale;
                }
            }

            if(this.chosenLocale.length > 0) {
                localesToFetch.push(this.chosenLocale);
            }

            const localeFetchDone = () => {
                // When we have the data from GitHub we can...
                // ... set the current locale
                this.appStore.locale = (this.chosenLocale.length > 0) ? this.chosenLocale : this.newLocale.toLowerCase();
                //... use the data provided by file if any 
                this.addTranslationsFromFile();
                //... add all missing labels/values in the translation state object + set the "isEmpty" field from locale to English (for us to know easily)
                // (either because some don't exist in an existing locale, or because we're creating a new locale...)
                this.fillMissingTranslationsAndSetIsEmpty();
                // ... set the status as complete and allow for it to be close
                this.appStore.status = "Ready for you to translate!" + ((this.appStore.isEnglishReferenceFromLocalFiles) ? " (English reference from local files)" : "");
                this.appStore.isStatusFinshed = true;
                // ... emit event to show the translation tool
                this.$emit(CustomEventTypes.showLocalesComparisonToolRequested);
            };

            if(this.isLocalTestVersion){
                this.prepareDataFromLocalStandaloneTestFiles();
                localeFetchDone();
            }
            else{
                const englishRetrieval = (this.appStore.isEnglishReferenceFromLocalFiles)
                    ? Promise.resolve(this.prepareEnglishFromLocalFiles())
                    : this.retrieveLocale(localesToFetch[0], true);
                englishRetrieval.then((firstRetrieveOK) => {
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

        addTranslationsFromFile(atCurrentNode?: {inFromFile: Record<string, unknown>, inTranslations: TranslationLabelsTree}){
            // The translation data is simple JSON formatted. We parse it and replace/add any translations it contains.
            if(atCurrentNode){
                Object.keys(atCurrentNode.inFromFile).forEach((entryKey) => {
                    const entryValue = atCurrentNode.inFromFile[entryKey];
                    const isEntryValueString = (typeof entryValue == "string");
                    // This key entry doesn't exist: we can add with its potential children.
                    // If it already exists in the translations: we either replace the value if we're on a leaf
                    // or continue parsing if we are not.
                    const entryKeyExistsInTranslations = !!atCurrentNode.inTranslations[entryKey];
                    if(!entryKeyExistsInTranslations || isEntryValueString){
                        if(entryKeyExistsInTranslations){
                            atCurrentNode.inTranslations[entryKey].value = entryValue as string;
                        }
                        else {
                            const value = (isEntryValueString)
                                ? {value: entryValue, isEmpty: false} 
                                : parseJSONToTranslationTree(entryValue as {[key: string]: any});
                            this.$set(atCurrentNode.inTranslations, entryKey, value);
                        }
                    }
                    else{
                        this.addTranslationsFromFile({inFromFile: atCurrentNode.inFromFile[entryKey] as Record<string, unknown>, inTranslations: atCurrentNode.inTranslations[entryKey].value as TranslationLabelsTree});
                    }
                });        
            }
            else{
                this.addTranslationsFromFile({inFromFile: this.appStore.translationsFromFile, inTranslations: this.appStore.translations});
            }
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

        prepareEnglishFromLocalFiles(): boolean {
            // The English reference is entirely taken from the files picked by the user (nothing is retrieved from GitHub for English):
            // the translation groups are those of the picked files. The content has been parsed as JSON when the files were picked.
            this.appStore.status = "Preparing English (reference) data from local files...";
            try{
                this.englishTranslationGroupsFromFiles.forEach((translationGroup) => {
                    this.appStore.translationGroups.push(translationGroup);
                    this.$set(this.appStore.englishContent, translationGroup, {value: parseJSONToTranslationTree(this.appStore.englishFromLocalFiles[translationGroup] as {[key: string]: any}).value});
                });
                return true;
            }
            catch{
                this.appStore.status = "Error preparing the English (reference) data from the local files.\nCheck the files and reload this page to try again.";
                this.appStore.isStatusError = true;
                return false;
            }
        },

        pickEnglishFiles() {
            (this.$refs.englishFilesInput as HTMLInputElement)?.click();
        },

        async onSelectedEnglishFiles() {
            const filesInput = this.$refs.englishFilesInput as HTMLInputElement;
            const errors = [] as string[];
            for(const file of Array.from(filesInput.files ?? [])){
                try{
                    const {locale, translationGroup} = parseTranslationsFileName(file.name);
                    if(locale != "en"){
                        throw new Error(`The file "${file.name}" is not an English translations file.`);
                    }
                    if(this.appStore.englishFromLocalFiles[translationGroup] != undefined){
                        throw new Error(`An English file has already been picked for the translation group "${translationGroup}".`);
                    }
                    const jsonFileContent = JSON.parse(await readFileContent(file));
                    if(typeof jsonFileContent != "object" || jsonFileContent == null || Array.isArray(jsonFileContent)){
                        throw new Error(`The file "${file.name}" doesn't contain translations.`);
                    }
                    this.$set(this.appStore.englishFromLocalFiles, translationGroup, jsonFileContent);
                }
                catch(error){
                    errors.push((error instanceof SyntaxError) ? `The file "${file.name}" isn't a valid JSON file.` : String((error as Error).message ?? error));
                }
            }
            //reset the input file element value to empty (so further changes can be notified)
            filesInput.value = "";
            if(errors.length > 0){
                alert(errors.join("\n"));
            }
        },

        removeEnglishFileForTG(translationGroup: string) {
            this.$delete(this.appStore.englishFromLocalFiles, translationGroup);
        },

        pickTranslationFiles() {
            this.$emit(CustomEventTypes.showTranslationsFilesUploaderRequested, {detail: true});
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

.locale-selection-container > div > select,
.locale-selection-container > div > input {
    margin-left: 5px;
}

.locale-selection-container > div > input {
    margin-top: 2px;
}

.locale-selection-container > div > span {
    vertical-align: middle;
}

.english-reference-separator {
    border: none;
    border-top: 1px solid black;
    margin: 10px 0px;
}

.english-reference-container > input[type=file] {
    display: none;
}

#pickEnglishFilesButton,
#pickTranslationsFilesButton {
    margin-left: 5px;
    margin-top: 2px;
}

#validateLocaleButton {
    margin-top: 10px;
}
</style>

