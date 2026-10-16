import type { TranslationLabelsTree} from "@/helpers/types";
import { defineStore } from "pinia";

export const useStore = defineStore("app", {
    state: () => {
        return {
            status: "Wait for page initialisation...",
            isStatusError: false,
            isStatusFinshed: false,
            locales: [] as string[],
            locale: "",
            translationGroups: [] as string[], // should be ["main", "mb",...] BASED ON ENGLISH LANGUAGE
            currentTranslationGroup : "main", // default value
            currentTranslationLabelKeyPath: "",
            englishContent: {} as TranslationLabelsTree, // the english content...
            isEnglishReferenceFromLocalFiles: false, // when true, the English reference is taken from files picked by the user instead of Strype's GitHub repository
            englishFromLocalFiles: {} as Record<string, unknown>, // the English files content picked by the user - JSON format, properties are the translation groups
            translations: {} as TranslationLabelsTree, // contains the translations, properties are the translation groups, and in each the equivalent of the translation file. 
            isChangingTranslationGroup: false, // flag used for avoiding messing up refs when changing the target group
            translationsFromFile: {}, // use to store the translations loaded from a file - JSON format, will only be used to generate the final translations state property
        };
    },
});
