export const INITIALIZED = Symbol("___INITIALIZED");

export const isInitialized = (data: any) => {
    if (!data) return false;
    if (Number(data) !== 1) return false;
    return !!data[INITIALIZED];
};


export const addInitialized = (data: any) => {
    if (!data) return data;
    data[INITIALIZED] = 1;
    return data;
}