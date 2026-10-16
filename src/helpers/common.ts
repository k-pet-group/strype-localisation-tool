import TranslationTreeDisplayComponent from "@/components/TranslationTreeDisplay.vue";
import type { TranslationLabelsTree } from "./types";
import { useStore } from "@/stores/store";
import Vue from "vue";

// List of custom events sent by different parts of the app
export enum CustomEventTypes {
    checkGitHubRepBasicsRequested = "StrypeLocalisationToolEvt1",
    localeSelectionRequested = "StrypeLocalisationToolEvt2",
    showLocalesComparisonToolRequested = "StrypeLocalisationToolEvt3",
    statusDisplayOffRequested = "StrypeLocalisationToolEvt4",
    showGenerateLocaleFilesRequested = "StrypeLocalisationToolEvt5",
    generateLocalFilesDisplayOffRequested = "StrypeLocalisationToolEvt6",
    showTranslationsFilesUploaderRequested = "StrypeLocalisationToolEvt7",
    proceedWithTranslationsFromFileRequested = "StrypeLocalisationToolEvt8",
}

export const isLocaleNameValid = (locale: string): boolean => {
    // This method checks the validatity of a locale (in Strype we expect them as a 2 chars code)
    return /^[a-z]{2}$/.test(locale.toLowerCase());
};

/* Part handling the translations files picked by the user */
export const parseTranslationsFileName = (fileName: string): {locale: string, translationGroup: string} => {
    // A Strype translations file name is formatted as "<locale>_<translation group>.json"
    const fileNameSplits = fileName.replace(/\.json$/,"").split("_");
    if(fileNameSplits.length != 2 || !fileName.endsWith(".json")){
        throw new Error(`The file name "${fileName}" isn't following the format expected for a Strype localisation file!`);
    }
    return {locale: fileNameSplits[0].toLowerCase(), translationGroup: fileNameSplits[1]};
};

export const readFileContent = (file: File): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
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
};
/* end of part about translations files picked by the user */


/* Part handling the conversion between the translation JSON files and the internal tree object
 * used in this app (that also carries information the node visibility in the UI).
 */
export const parseJSONToTranslationTree = (jsonFileTree: {[key: string]: any}): {value: TranslationLabelsTree, hasEmptyChild: boolean} => {
    const translationLabelsTree = {} as TranslationLabelsTree;
    let hasEmptyChild = Object.keys(jsonFileTree).length == 0;
    for(const labelKey in jsonFileTree){
        if(typeof jsonFileTree[labelKey] == "string"){
            // This is a leaf, we can directly add it in the tree
            const isEmpty = (jsonFileTree[labelKey].length == 0);
            translationLabelsTree[labelKey] = {value: jsonFileTree[labelKey], isEmpty: isEmpty};
            hasEmptyChild = hasEmptyChild || isEmpty;
        }
        else{
            // This is another node, we call a recursive method to handle it
            const returnedForChildren = parseJSONToTranslationTree(jsonFileTree[labelKey]);
            translationLabelsTree[labelKey] = returnedForChildren;
            hasEmptyChild = hasEmptyChild || returnedForChildren.hasEmptyChild;
        }
    }
    return {value: translationLabelsTree, hasEmptyChild: hasEmptyChild};
};

export const parseTranslationTreeToJSON = (tree: TranslationLabelsTree): {[key: string]: any} => {
    const jsonObject = {} as {[key: string]: any};
    Object.entries(tree).forEach(([translationKey, translationValue]) => {
        if(typeof translationValue.value == "string"){
            jsonObject[translationKey] = translationValue.value;
        }
        else{
            jsonObject[translationKey] = parseTranslationTreeToJSON(translationValue.value);
        }
    });
    return jsonObject;
};

/* end of part about conversion between JSON and internal tree object*/

// Part for getting/setting the labels node ref:
// the format of a ref is "labelNode_<indexedPath>", indexedPath is like "1_3_5".
export const translationLabelNodeRefPreamble = "_labelNode_";
export const getTranslationLabelNodeComponentRef = (indexedPath: string): string => {
    return useStore().currentTranslationGroup + translationLabelNodeRefPreamble + indexedPath;
};

export const getTranslationLabelNodeComponentIndexedPath = (parentPath: string, index: number): string => {
    return parentPath + ((parentPath.length > 0) ? "_" : "") + index;
};

export const getNormalisedVisibleTreeNodeRefsKVP = (refKPVs: [string, any][]): [string, any][] => {
    // By normalise we mean sorting the refs in order and making sure the value of the ref is an object and not an array (we get array if ref is set in a v-for).
    // First we only keep tree node references
    refKPVs = refKPVs.filter(((nodeRefKVP) => {
        const component = (Array.isArray(nodeRefKVP[1])) ? nodeRefKVP[1][0] : nodeRefKVP[1];
        return nodeRefKVP[0].startsWith(useStore().currentTranslationGroup + translationLabelNodeRefPreamble) && !component.isHidden;
    }));
    
    // Sorting means we make sure the order of refs is logic (same as the tree, as the indexed path would suggest).
    return refKPVs.sort(([ref1Name], [ref2Name]) => {
        const ref1Parts = ref1Name.replace(new RegExp(`^.+${translationLabelNodeRefPreamble}`), "").split("_").map(Number);
        const ref2Parts = ref2Name.replace(new RegExp(`^.+${translationLabelNodeRefPreamble}`), "").split("_").map(Number);
        for (let i = 0; i < Math.max(ref1Parts.length, ref2Parts.length); i++) {
            const ref1PartVal = ref1Parts[i] ?? -1;
            const ref2PartVal = ref2Parts[i] ?? -1;
            if (ref1PartVal !== ref2PartVal){
                return ref1PartVal - ref2PartVal;
            }
        }
        return 0;
    })
        .map(([key, ref]) => [key, Array.isArray(ref) ? ref[0] : ref]);
};

// We have a small accessor for getting the Tree component easily where the references above are registered
let translationTreeDisplayComponent = undefined as undefined | InstanceType<typeof TranslationTreeDisplayComponent>;
export const setReferencedTranslationTreeDisplayComponent = (component: InstanceType<typeof TranslationTreeDisplayComponent>):void => {
    translationTreeDisplayComponent = component;
};

export const getReferencedTranslationTreeDisplayComponent = (): undefined | InstanceType<typeof TranslationTreeDisplayComponent> => {
    return translationTreeDisplayComponent;
};

export const cleanTranslationsLabelTreeRefs = (): Promise<void> => {
    return new Promise<void>((resolve) => {
        Vue.nextTick(() => {
            const treeRefs = getReferencedTranslationTreeDisplayComponent()?.$refs;
            if(treeRefs){
                for(const refName in treeRefs){
                    if(!refName.startsWith(`${useStore().currentTranslationGroup}${translationLabelNodeRefPreamble}`) || treeRefs[refName] == undefined || (treeRefs[refName] as any[]).length == 0){
                        delete treeRefs[refName];
                    }
                }
                resolve();
            }
        });
    });    
};
/* end dealing with refs */
/* Part for handling the whitespaces at the edges of a label value (they are invisible in HTML) */
export interface EdgeWhitespacesSplitValue {
    leading: string,
    core: string,
    trailing: string,
}

export const splitEdgeWhitespaces = (value: string): EdgeWhitespacesSplitValue => {
    // Note: the "\n" have been replaced by ⏎ before we get here, so they are not considered as whitespaces.
    const match = value.match(/^(\s*)([\s\S]*?)(\s*)$/) as RegExpMatchArray;
    return {leading: match[1], core: match[2], trailing: match[3]};
};

export const describeEdgeWhitespaces = (whitespaces: string, position: "leading" | "trailing"): string => {
    // Gives a human readable description, like "2 trailing spaces" (if there are other whitespaces than spaces, we use a generic term)
    const count = whitespaces.length;
    const term = (/^ *$/.test(whitespaces)) ? "space" : "whitespace character";
    return `${count} ${position} ${term}${(count != 1) ? "s" : ""}`;
};
/* end dealing with whitespaces at the edges */
