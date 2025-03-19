const STORE_NAME = "internal-store";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: Record<string, any> = {
  state: {}
}

class BrowserStorage {
  constructor() {
    const store = localStorage.getItem(STORE_NAME)
    if (!store) localStorage.setItem(STORE_NAME, JSON.stringify(data));
  }

  set(key: string, value: string) {
    const internalStore = localStorage.getItem(STORE_NAME)
    const store = JSON.parse(internalStore!)
    store.state[key] = value
    localStorage.setItem(STORE_NAME, JSON.stringify(store))
  }

  get(key: string) {
    const internalStore = localStorage.getItem(STORE_NAME)
    const store = JSON.parse(internalStore!)
    return store.state[key] || null;
  }

  remove(key: string) {
    const internalStore = localStorage.getItem(STORE_NAME)
    const store = JSON.parse(internalStore!)
    delete store.state[key]
    localStorage.setItem(STORE_NAME, JSON.stringify(store))
  }
}

const browserStore = new BrowserStorage()
export default browserStore;