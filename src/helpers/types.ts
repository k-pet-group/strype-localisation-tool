export interface TranslationLabelsTree {
  [key: string]: {
    value: string | TranslationLabelsTree,
    isHidden?: boolean
    isEmpty?: boolean, // for string content indication if empty ("")
    hasEmptyChild?: boolean // for tree content, indication if one child, even in a deeper level, is empty
  };
}
