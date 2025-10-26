<template>
    <div class="locale-selection-container translations-file-uploader-container">
        <span>{{ `Locale detected: ${detectedLocale}`}}</span>
        <div v-for="tg in translationGroupsFromFiles" :key="`translationsUploader_${tg}`">
            <b>{{ `Translations added for the translation group "${tg}"` }}</b>
            <div class="cross-symbol-container" @click="removeTranslationsForTG(tg)">
                <span title="Reset translations for this translation group.">❌</span>
            </div>
        </div>
        <button title="Upload a translations file content." @click="uploadFile">&#10133;</button>
        <input type="file" accept=".json" ref="importFileInput" @change="onSelectedFile" />
        <br/>
        <div>
        <button @click="leaveDisplay(false)" :disabled="translationGroupsFromFiles.length == 0">OK</button>
        <button id="cancelTranslationsFilesButton" @click="leaveDisplay(true)">Cancel</button>
        </div>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import { useStore } from "@/stores/store";
import { mapStores } from "pinia";
import { CustomEventTypes, isLocaleNameValid } from "@/helpers/common";
import { LOCALE_FOR_LOCAL_STANDALONE_TEST } from "@/main";

export default Vue.extend({
    name: "TranslationsFileUploaderDisplay",
    
    computed: {
        ...mapStores(useStore),
    },
    
    data: function() {
        return {
            detectedLocale: "-",
            translationGroupsFromFiles: [] as string[],

        };        
    },

    watch: {
        translationGroupsFromFiles(newValue) {
            // If no files are set, the detected locale is reset
            if(newValue.length == 0){
                this.detectedLocale = "-";
            }
        },
    },
    
    methods: {
        uploadFile(){
            (this.$refs.importFileInput as HTMLInputElement)?.click();
        },

        async onSelectedFile(){
            const files = (this.$refs.importFileInput as HTMLInputElement).files;
            if(files){
                const fileName = files[0].name;
                const fileNameSplits = fileName.replace(/\.json$/,"").split("_");
                
                try{
                    // Already we can tell if the file name format isn't as we expect.
                    if(fileNameSplits.length != 2 || !fileName.endsWith(".json")){
                        throw new Error("The file name isn't following the format expected for a Strype localisation file!");
                    }

                    // Then we retrieve the file content
                    const fileContent = await this.readFileContent(files[0]);
                    const jsonFileContent = JSON.parse(fileContent);

                    // Then we check that...
                    // ... the locale from that file name is the same as current detected locale OR valid if it's the first time we got one
                    const localeFromFile = fileNameSplits[0].toLowerCase();
                    if(this.detectedLocale != "-"){
                        if(this.detectedLocale != localeFromFile){
                            throw new Error(`The current locale was detected as "${this.detectedLocale}" but the uploaded file is for "${localeFromFile}".`);
                        }
                    }
                    else if(!isLocaleNameValid(localeFromFile)){
                        throw new Error(`The locale "${localeFromFile}" detected from the file name isn't a valid locale name.`);
                    }
                    else if(localeFromFile == "en"){
                        // We don't allow overwritting English !
                        throw new Error("The English locale cannot be edited with this tool.");
                    }
                    else if(import.meta.env.VITE_IS_LOCAL_STANDALONE_TEST_VERSION == "true" && localeFromFile != LOCALE_FOR_LOCAL_STANDALONE_TEST){
                        // A special case for testing standalone mode: we make sure the file is in line with this mode's locale.
                        throw new Error(`The locale "${localeFromFile}" detected from the file name shoud match the locale used for the locale standalone test mode !!`);
                    }

                    // ... the translation group name from that file name isn't already provided
                    const tg = fileNameSplits[1];
                    if(this.translationGroupsFromFiles.includes(tg)){
                        throw new Error(`Translations has already been retrieve from a file for the translation group "${tg}"`);
                    }
                   

                    // All good, we can save the content in the state and the locale + translation group in this component's data
                    this.detectedLocale = localeFromFile;
                    this.translationGroupsFromFiles.push(tg);
                    this.$set(this.appStore.translationsFromFile, tg, jsonFileContent);
                }
                catch(_){
                    alert(_);
                }
                finally{
                    //reset the input file element value to empty (so further changes can be notified)
                    (this.$refs.importFileInput as HTMLInputElement).value = "";   
                }
            }
        },

        async readFileContent(file: File): Promise<string> {
            const result = await new Promise<string>((resolve, reject) => {
                const fileReader = new FileReader();
                fileReader.onload =  (evt) => {
                    const text = evt.target?.result;
                    if(typeof text === "string"){
                        resolve(text);
                    }
                    else {
                        reject("the file content cannot be interpreted as a JSON content file");
                    }
                };
                fileReader.readAsText(file, "UTF-8");
            });

            return result;    
        },

        removeTranslationsForTG(targetGroup: string){
            // Delete the target group and its content from the state
            this.$delete(this.appStore.translationsFromFile, targetGroup);
            // Delete the target group from this component's data   
            const tgIndex = this.translationGroupsFromFiles.indexOf(targetGroup);
            this.translationGroupsFromFiles.splice(tgIndex, 1);
        },

        leaveDisplay(cancelling: boolean){
            if(cancelling){
                // We remove any translations from file before closing the box
                this.appStore.translationsFromFile = {};
                this.$emit(CustomEventTypes.showTranslationsFilesUploaderRequested, {detail: false});
            }
            else{
                // We let the locale selection tool that a locale is ready from the files and we should proceed
                this.$emit(CustomEventTypes.proceedWithTranslationsFromFileRequested, {detail: this.detectedLocale});
            }            
        },
    },    
});
</script>

<style>
.translations-file-uploader-container >  button {
    margin-top: 5px;
    display: block;
}

.translations-file-uploader-container >  input[type=file] {
    display: none;
}

.cross-symbol-container {
    display: inline-block;
    width: 0px;
    margin-left: 5px;
    cursor: pointer;
}

#cancelTranslationsFilesButton {
    display: inline;
    margin-left: 5px;
}
</style>

