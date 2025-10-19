import { createPinia, PiniaVuePlugin } from "pinia";
import App from "@/App.vue";
import Vue from "vue";

export const IS_LOCAL_STANDALONE_TEST_VERSION = false;
export const LOCALE_FOR_LOCAL_STANDALONE_TEST = "de";

// Use a Pinia store (instead of Vuex store, because it handles type inferrence better)
Vue.use(PiniaVuePlugin);
const pinia = createPinia();
Vue.config.productionTip = false;

export const vm = new Vue({
    pinia,
    render: (h) => h(App),
});
vm.$mount("#app");