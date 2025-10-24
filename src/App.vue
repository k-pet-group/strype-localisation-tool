<template>
  <div>
    <div class="header-container">
      <a href="https://strype.org" target="_blank">
        <img src="@/assets/Strype-logo-name.png" alt="Strype"/>
      </a>
      <h1>Locale file generator tool</h1>
      <a href="https://github.com/k-pet-group/strype-localisation-tool" target="_blank">Instructions</a>
    </div>
    <hr/>
    <span v-if="isLocalTestVersion" class="important-notice-msg">THIS IS A TEST VERSION WITH STANDALONE FILE ACCESS.</span>
    <StatusDisplay v-show="showStatusDisplay" :show-close="showStatusDisplayClose" @[CustomEventTypes.checkGitHubRepBasicsRequested]="checkGithubRepContent" @[CustomEventTypes.statusDisplayOffRequested]="showStatusDisplay=false;explicitHideStatusDisplay=true;" />
    <LocaleSelectionDisplay v-if="showLocaleSelectionDisplay" @[CustomEventTypes.showLocalesComparisonToolRequested]="onRequestShowLocalesCompTool" />
    <LocalesComparisonDisplay v-if="showLocalesCompDisplay" @[CustomEventTypes.showGenerateLocaleFilesRequested] = "onRequestShowHideGenerateFiles(true)" />
    <GenerateLocaleFilesDisplay v-if="showGenerateLocaleFilesDisplay" @[CustomEventTypes.generateLocalFilesDisplayOffRequested] = "onRequestShowHideGenerateFiles(false)"/>
  </div> 
</template>

<script lang="ts">
import { useStore } from "@/stores/store";
import { mapStores } from "pinia";
import { CustomEventTypes, getReferencedTranslationTreeDisplayComponent, getTranslationLabelNodeComponentRef } from "./helpers/common";
import Vue from "vue";
import StatusDisplay from "./components/StatusDisplay.vue";
import LocaleSelectionDisplay from "@/components/LocaleSelectionDisplay.vue";
import LocalesComparisonDisplay from "@/components/LocalesComparisonDisplay.vue";
import type TranslationLabelTreeNodeComponent from "@/components/TranslationLabelTreeNode.vue";
import GenerateLocaleFilesDisplay from "@/components/GenerateLocaleFilesDisplay.vue";

export default Vue.extend({
    name: "App",

    components: {
        StatusDisplay,
        LocaleSelectionDisplay,
        LocalesComparisonDisplay,
        GenerateLocaleFilesDisplay,
    },

    computed: {
        ...mapStores(useStore),

        isLocalTestVersion(): boolean {
            return import.meta.env.VITE_IS_LOCAL_STANDALONE_TEST_VERSION == "true";
        },
    },

    data: function(){
        return {
            CustomEventTypes, // Just be used in templates
            showStatusDisplay: true,
            showStatusDisplayClose: false,
            explicitHideStatusDisplay: false,
            showLocaleSelectionDisplay: false,
            showLocalesCompDisplay: false,
            showGenerateLocaleFilesDisplay: false,
        };
    },

    methods: {
        checkGithubRepContent() {
            if(this.isLocalTestVersion){
                this.appStore.status = "Waiting for locale selection...";
                this.showLocaleSelectionDisplay = true;
                return;
            }
          
            const connectGHErrorMsg = "GitHub, the Strype repository from K-PET or the localisation folder cannot be reached.\nCheck the isssue and reload this page to try again.";
            const getLocalesErrorMsg = "It seems this webpage isn't retrieving languages properly.\nPlease contact the Strype team (contact on https://strype.org).";
            fetch("https://api.github.com/repos/k-pet-group/Strype/contents/src/localisation")
                .then((value) => {
                    if(value.status == 200){
                        // Access to GitHub works, we can exctract the languages
                        this.appStore.status = "Strype repository on GitHub is accessible. Preparing the list of existing locales...";
                        value.json().then((content) => {
                            try{
                                for(const lang of content){
                                    // Do not add English!
                                    if(lang.name != "en"){
                                        this.appStore.locales.push(lang.name);
                                    }
                                }
                                // Just for making sure we test some retrieved values to be sure they're locals...
                                if(!this.appStore.locales.includes("de") || !this.appStore.locales.includes("es") || !this.appStore.locales.includes("zh")) {
                                    // Reset the locales in the state
                                    this.appStore.locales.splice(0);
                                    // Show error
                                    this.appStore.status = getLocalesErrorMsg;
                                    this.appStore.isStatusError = true;
                                }
                                else{
                                    // Locales are retrieved, we can request which locale to use (or create new one)
                                    this.appStore.status = "Waiting for locale selection...";
                                    this.showLocaleSelectionDisplay = true;
                                }
                            }
                            catch{
                                // Show error
                                this.appStore.status = getLocalesErrorMsg;
                                this.appStore.isStatusError = true;
                            }
                        });
                    }
                    else{
                        this.appStore.status = connectGHErrorMsg + "\nError code: " + value.status;
                        this.appStore.isStatusError = true;
                    }
                })
                .catch((reason) => {
                    this.appStore.status = connectGHErrorMsg + "\nError:" + reason;
                    this.appStore.isStatusError = true;
                });
        },

        onRequestShowLocalesCompTool(){
            this.showStatusDisplayClose=true; 
            this.showLocaleSelectionDisplay=false;
            this.showLocalesCompDisplay=true;
            // Set the first entry of the translations as the selected entry
            this.$nextTick(() => {
                (getReferencedTranslationTreeDisplayComponent()?.$refs[getTranslationLabelNodeComponentRef("0")] as InstanceType<typeof TranslationLabelTreeNodeComponent>[])[0]
                    .selectNode();
            });
        },

        onRequestShowHideGenerateFiles(show: boolean){
            this.showGenerateLocaleFilesDisplay = show;
            this.showStatusDisplay = (!show && !this.explicitHideStatusDisplay);
            this.showLocalesCompDisplay = !show;
        },
    },
});
</script>

<style>
.header-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-container  img {
  width: calc(385px / 2.5);
  height: calc(128px / 2.5);
}

.important-notice-msg {
  font-weight: 900;
  color: red;
  margin: 30px;
  display: inline-block;
}

.functional-container  {
   border: 2px black solid;
    border-radius: 5px;
    width: 100;
    padding: 10px;
}

label, input, select {
  vertical-align: middle;
}

.blue-button {
  cursor: pointer;
  color: white;
  background-color: rgb(100, 146, 247);
  padding: 4px 4px;
  border: rgb(214, 207, 204) solid 1px;
  border-radius: 5px;
}
</style>

