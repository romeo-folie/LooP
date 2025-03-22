import _ from "lodash";

const STORE_NAME = "internal-store";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: Record<string, any> = {
  state: {
    notifications: [],
  },
};

class BrowserStorage {
  constructor() {
    const store = localStorage.getItem(STORE_NAME);
    if (!store) localStorage.setItem(STORE_NAME, JSON.stringify(data));
  }

  set(key: string, value: unknown) {
    const internalStore = localStorage.getItem(STORE_NAME);
    const store = JSON.parse(internalStore!);
    if (Array.isArray(store.state[key]) && _.isPlainObject(value)) {
      if (store.state[key].length) {
        const exists = _.some(store.state[key], value as object);
        if (exists) return;
        store.state[key] = [...store.state[key], value];
      } else {
        store.state[key] = [value];
      }
    } else {
      store.state[key] = value;
    }
    localStorage.setItem(STORE_NAME, JSON.stringify(store));
  }

  get(key: string) {
    const internalStore = localStorage.getItem(STORE_NAME);
    const store = JSON.parse(internalStore!);
    return store.state[key] || null;
  }

  remove(key: string) {
    const internalStore = localStorage.getItem(STORE_NAME);
    const store = JSON.parse(internalStore!);
    delete store.state[key];
    localStorage.setItem(STORE_NAME, JSON.stringify(store));
  }
}

const browserStore = new BrowserStorage();
export default browserStore;
